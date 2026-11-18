import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { GameEngine } from '../src/game';
import type { Action, RoomView } from '../src/multiplayer';
import type { CellNumber } from '../src/models';

export class RoomError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
interface Seat { name: string; token: string; userId?: number }
export interface Room {
  public: boolean; code: string; revision: number; seats: Seat[]; capacity: number;
  expansions: { bigMountain: boolean; greenValley: boolean };
  game: GameEngine | null; touched: number;
}
export function secret(): string { return randomBytes(32).toString('hex'); }
export function matches(a: string, b: string): boolean {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function nameOf(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 30) throw new RoomError('Use a name of 1–30 characters.');
  return value.trim();
}
export class Rooms {
  rooms = new Map<string, Room>();
  database?: DatabaseSync;
  constructor(databasePath?: string) {
    if (!databasePath) return;
    mkdirSync(dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, data TEXT NOT NULL)');
    for (const row of this.database.prepare('SELECT data FROM rooms').all()) {
      const saved = JSON.parse(String(row.data));
      saved.game = saved.game ? GameEngine.deserialize(JSON.stringify(saved.game)) : null;
      this.rooms.set(saved.code, saved);
    }
    this.prune();
  }
  private save(room: Room): void {
    if (!this.database) return;
    const data = JSON.stringify({ ...room, game: room.game?.state || null });
    this.database.prepare('INSERT INTO rooms (code, data) VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET data=excluded.data').run(room.code, data);
  }
  private commit(room: Room, next: Room): void {
    // Commit durable state first. A failed disk write leaves the live room unchanged.
    this.save(next); Object.assign(room, next);
  }
  close(): void { this.database?.close(); }

  create(input: Record<string, unknown>, userId?: number): { room: Room; token: string } {
    this.prune();
    if (this.rooms.size >= 500) throw new RoomError('Room limit reached. Try again later.', 503);
    const name = nameOf(input.name);
    const capacity = input.capacity;
    if (!Number.isInteger(capacity) || Number(capacity) < 2 || Number(capacity) > 5) throw new RoomError('Choose 2–5 seats.');
    let code: string;
    do { code = randomBytes(6).toString('hex').toUpperCase(); } while (this.rooms.has(code));
    const token = secret();
    const room: Room = { public: input.public === true, code, revision: 0, seats: [{ name, token, userId }], capacity: Number(capacity), expansions: {
      bigMountain: input.bigMountain === true, greenValley: input.greenValley === true,
    }, game: null, touched: Date.now() };
    this.save(room);
    this.rooms.set(code, room);
    return { room, token };
  }
  prune(): void {
    for (const [code, room] of this.rooms) if (Date.now() - room.touched > 24 * 60 * 60 * 1000) { this.database?.prepare('DELETE FROM rooms WHERE code = ?').run(code); this.rooms.delete(code); }
  }
  publicRooms() {
    this.prune();
    return [...this.rooms.values()].filter(room => room.public && !room.game && room.seats.length < room.capacity)
      .sort((a,b) => b.touched - a.touched).slice(0,100)
      .map(room => ({ code: room.code, players: room.seats.length, capacity: room.capacity, expansions: room.expansions }));
  }
  get(code: string): Room {
    this.prune();
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new RoomError('Room not found or expired.', 404);
    return room;
  }
  join(room: Room, name: unknown, userId?: number): string {
    const existing = userId === undefined ? undefined : room.seats.find(seat => seat.userId === userId);
    if (existing) return existing.token;
    if (room.game) throw new RoomError('This game has already started.', 409);
    if (room.seats.length >= room.capacity) throw new RoomError('This room is full.', 409);
    const token = secret();
    this.commit(room, { ...room, seats: [...room.seats, { name: nameOf(name), token, userId }], revision: room.revision + 1, touched: Date.now() });
    return token;
  }
  forUser(userId: number) {
    this.prune();
    return [...this.rooms.values()].flatMap(room => {
      const seat = room.seats.find(s => s.userId === userId);
      return seat ? [{ code: room.code, token: seat.token, started: !!room.game, finished: room.game?.state.gameOver || false }] : [];
    });
  }
  authorizeUser(room: Room, token: string, userId: number): void {
    const seat = room.seats[this.seat(room,token)];
    if (seat.userId !== userId) throw new RoomError('This seat belongs to another account.',403);
  }
  seat(room: Room, token: string): number {
    const seat = room.seats.findIndex(s => matches(s.token, token));
    if (seat < 0) throw new RoomError('Rejoin using your original browser or join a new room.', 401);
    return seat;
  }
  view(room: Room, token: string): RoomView {
    return { code: room.code, revision: room.revision, seats: room.seats.map(s => ({ name: s.name })),
      capacity: room.capacity, expansions: room.expansions, game: room.game?.state || null, you: this.seat(room, token) };
  }
  start(room: Room, token: string, revision: unknown): void {
    if (this.seat(room, token) !== 0) throw new RoomError('Only the host can start.', 403);
    this.revision(room, revision);
    if (room.game || room.seats.length < 2) throw new RoomError('At least two players must join before starting.', 409);
    const game = new GameEngine(room.seats.length, 10, 10, room.seats.map(s => s.name));
    game.configureExpansions(room.expansions); game.rollDice(() => randomInt(1, 7));
    this.commit(room, { ...room, game, revision: room.revision + 1, touched: Date.now() });
  }
  revision(room: Room, revision: unknown): void {
    if (revision !== room.revision) throw new RoomError('The room changed. Try your action again.', 409);
  }
  act(room: Room, token: string, revision: unknown, raw: unknown): void {
    const seat = this.seat(room, token); this.revision(room, revision);
    if (!room.game || room.game.state.gameOver) throw new RoomError('No active game.', 409);
    if (room.game.state.currentPlayerIndex !== seat) throw new RoomError('Wait for your turn.', 403);
    if (!raw || typeof raw !== 'object') throw new RoomError('Invalid action.');
    const a = raw as Action;
    // Apply to a copy: rejected actions can never partially mutate the room.
    const engine = GameEngine.deserialize(room.game.serialize());
    let ok = true;
    switch (a.type) {
      case 'select':
        if (!Number.isInteger(a.index) || a.index < 0 || a.index > 3 || engine.state.dice[a.index].used) ok = false;
        else engine.toggleDieSelection(a.index);
        break;
      case 'change':
        if (!Number.isInteger(a.index) || !Number.isInteger(a.value) || a.index < 0 || a.index > 3 || a.value < 1 || a.value > 6 || !engine.state.dice[a.index].canChange || engine.state.dice[a.index].used) ok = false;
        else engine.changeDieValue(a.index, a.value);
        break;
      case 'clear': engine.clearDiceSelection(); break;
      case 'move': ok = Number.isInteger(a.mountain) && a.mountain >= 5 && a.mountain <= 10 && engine.moveGoatUpMountain(a.mountain as CellNumber); break;
      case 'big': ok = typeof a.source === 'string' && engine.moveToBigMountain(a.target, a.source); break;
      case 'redeploy': ok = typeof a.source === 'string' && engine.redeployGoat(a.source, a.mountain as CellNumber); break;
      case 'end': engine.nextTurn(() => randomInt(1, 7)); break;
      default: ok = false;
    }
    if (!ok) throw new RoomError('That action is not available.');
    // Keep network snapshots bounded during long-running games.
    engine.state.gameLog = engine.state.gameLog.slice(-200);
    this.commit(room, { ...room, game: engine, revision: room.revision + 1, touched: Date.now() });
  }
}
