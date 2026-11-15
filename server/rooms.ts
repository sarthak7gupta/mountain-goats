import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { GameEngine } from '../src/game';
import type { Action, RoomView } from '../src/multiplayer';
import type { CellNumber } from '../src/models';

export class RoomError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
interface Seat { name: string; token: string }
export interface Room {
  code: string; revision: number; seats: Seat[]; capacity: number;
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
  create(input: Record<string, unknown>): { room: Room; token: string } {
    this.prune();
    if (this.rooms.size >= 500) throw new RoomError('Room limit reached. Try again later.', 503);
    const name = nameOf(input.name);
    const capacity = input.capacity;
    if (!Number.isInteger(capacity) || Number(capacity) < 2 || Number(capacity) > 5) throw new RoomError('Choose 2–5 seats.');
    let code: string;
    do { code = randomBytes(6).toString('hex').toUpperCase(); } while (this.rooms.has(code));
    const token = secret();
    const room: Room = { code, revision: 0, seats: [{ name, token }], capacity: Number(capacity), expansions: {
      bigMountain: input.bigMountain === true, greenValley: input.greenValley === true,
    }, game: null, touched: Date.now() };
    this.rooms.set(code, room);
    return { room, token };
  }
  prune(): void {
    for (const [code, room] of this.rooms) if (Date.now() - room.touched > 24 * 60 * 60 * 1000) this.rooms.delete(code);
  }
  get(code: string): Room {
    this.prune();
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new RoomError('Room not found or expired.', 404);
    return room;
  }
  join(room: Room, name: unknown): string {
    if (room.game) throw new RoomError('This game has already started.', 409);
    if (room.seats.length >= room.capacity) throw new RoomError('This room is full.', 409);
    const token = secret();
    room.seats.push({ name: nameOf(name), token }); room.revision++; room.touched = Date.now();
    return token;
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
    room.game = new GameEngine(room.seats.length, 10, 10, room.seats.map(s => s.name));
    room.game.configureExpansions(room.expansions); this.roll(room.game);
    room.revision++; room.touched = Date.now();
  }
  revision(room: Room, revision: unknown): void {
    if (revision !== room.revision) throw new RoomError('The room changed. Try your action again.', 409);
  }
  roll(engine: GameEngine): void {
    // Generate host-owned dice with the platform cryptographic RNG.
    for (const die of engine.state.dice) { die.value = randomInt(1, 7); die.locked = false; die.used = false; die.selected = false; die.canChange = false; }
    let first = true;
    for (const die of engine.state.dice) if (die.value === 1) { die.canChange = !first; first = false; }
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
      case 'end': engine.nextTurn(); if (!engine.state.gameOver) this.roll(engine); break;
      default: ok = false;
    }
    if (!ok) throw new RoomError('That action is not available.');
    // Keep network snapshots bounded during long-running games.
    engine.state.gameLog = engine.state.gameLog.slice(-200);
    room.game = engine; room.revision++; room.touched = Date.now();
  }
}
