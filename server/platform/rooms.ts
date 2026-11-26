import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { PublicRoom, RoomSummary, RoomView } from '../../src/platform/protocol';
import { type GameDefinition, type Random, RoomError } from './game';

export interface Seat {
  name: string;
  token: string;
  userId?: number;
}
export interface Room<State, Options> {
  code: string;
  public: boolean;
  revision: number;
  seats: Seat[];
  capacity: number;
  options: Options;
  state: State | null;
  touched: number;
}

const DAY = 24 * 60 * 60 * 1000;
const MAX_ROOMS = 500;
/** Open long-poll requests, across all rooms; beyond this a poll answers at once. */
const MAX_WAITERS = 2000;
const random: Random = { int: (min, max) => randomInt(min, max) };

export function secret(): string {
  return randomBytes(32).toString('hex');
}
export function matches(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function nameOf(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 30)
    throw new RoomError('Use a name of 1–30 characters.');
  return value.trim();
}

/**
 * Authoritative rooms for one game. Each room is changed only through this
 * class: every accepted change bumps the revision, is written to SQLite (when
 * a database path is given) before it becomes live, and wakes long-polls.
 * One process owns the rooms; do not run several replicas on one database.
 */
export class GameRooms<State, Options> {
  rooms = new Map<string, Room<State, Options>>();
  database?: DatabaseSync;
  private statements?: { upsert: StatementSync; remove: StatementSync };
  private waiters = new Map<string, Set<() => void>>();
  private waiting = 0;
  private sweeper: ReturnType<typeof setInterval>;

  constructor(
    public game: GameDefinition<State, Options>,
    databasePath?: string
  ) {
    if (databasePath) {
      if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
      this.database = new DatabaseSync(databasePath);
      this.database.exec(
        'PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, data TEXT NOT NULL)'
      );
      this.statements = {
        upsert: this.database.prepare(
          'INSERT INTO rooms (code, data) VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET data=excluded.data'
        ),
        remove: this.database.prepare('DELETE FROM rooms WHERE code = ?'),
      };
      for (const row of this.database.prepare('SELECT code, data FROM rooms').all()) {
        // One unreadable row must not stop the server from booting.
        try {
          const saved = JSON.parse(String(row.data));
          // Rooms saved before the platform split stored `game` and `expansions`.
          saved.state ??= saved.game ?? null;
          saved.options ??= saved.expansions ?? {};
          delete saved.game;
          delete saved.expansions;
          this.rooms.set(saved.code, saved);
        } catch {
          console.warn(`Skipping unreadable room ${String(row.code)}.`);
        }
      }
    }
    this.prune();
    // Expire idle rooms in the background instead of scanning on every request.
    this.sweeper = setInterval(() => this.prune(), 60_000);
    this.sweeper.unref();
  }

  close(): void {
    clearInterval(this.sweeper);
    this.release();
    this.database?.close();
  }

  private expired(room: Room<State, Options>): boolean {
    return Date.now() - room.touched > DAY;
  }
  private remove(code: string): void {
    this.statements?.remove.run(code);
    this.rooms.delete(code);
    this.notify(code);
  }
  prune(): void {
    for (const [code, room] of this.rooms) if (this.expired(room)) this.remove(code);
  }
  /** Write durably first: a failed disk write leaves the live room unchanged. */
  private commit(room: Room<State, Options>, next: Room<State, Options>): void {
    this.statements?.upsert.run(next.code, JSON.stringify(next));
    Object.assign(room, next);
    this.notify(room.code);
  }

  create(input: Record<string, unknown>, userId?: number) {
    this.prune();
    if (this.rooms.size >= MAX_ROOMS) throw new RoomError('Room limit reached. Try again later.', 503);
    const name = nameOf(input.name);
    const { minPlayers, maxPlayers } = this.game;
    const capacity = input.capacity;
    if (!Number.isInteger(capacity) || Number(capacity) < minPlayers || Number(capacity) > maxPlayers)
      throw new RoomError(`Choose ${minPlayers}–${maxPlayers} seats.`);
    let code: string;
    do code = randomBytes(6).toString('hex').toUpperCase();
    while (this.rooms.has(code));
    const token = secret();
    const room: Room<State, Options> = {
      code,
      public: input.public === true,
      revision: 0,
      seats: [{ name, token, userId }],
      capacity: Number(capacity),
      options: this.game.options(input),
      state: null,
      touched: Date.now(),
    };
    this.statements?.upsert.run(code, JSON.stringify(room));
    this.rooms.set(code, room);
    return { room, token };
  }
  get(code: string): Room<State, Options> {
    const room = this.rooms.get(code.toUpperCase());
    if (room && this.expired(room)) this.remove(room.code);
    else if (room) return room;
    throw new RoomError('Room not found or expired.', 404);
  }
  publicRooms(): PublicRoom<Options>[] {
    return [...this.rooms.values()]
      .filter((r) => r.public && !r.state && r.seats.length < r.capacity && !this.expired(r))
      .sort((a, b) => b.touched - a.touched)
      .slice(0, 100)
      .map((r) => ({ code: r.code, players: r.seats.length, capacity: r.capacity, options: r.options }));
  }
  forUser(userId: number): RoomSummary[] {
    return [...this.rooms.values()].flatMap((room) => {
      const seat = room.seats.find((s) => s.userId === userId);
      if (!seat || this.expired(room)) return [];
      return [
        {
          code: room.code,
          token: seat.token,
          started: !!room.state,
          finished: !!room.state && this.game.isOver(room.state),
        },
      ];
    });
  }
  join(room: Room<State, Options>, name: unknown, userId?: number): string {
    const existing = userId === undefined ? undefined : room.seats.find((s) => s.userId === userId);
    if (existing) return existing.token;
    if (room.state) throw new RoomError('This game has already started.', 409);
    if (room.seats.length >= room.capacity) throw new RoomError('This room is full.', 409);
    const token = secret();
    this.commit(room, {
      ...room,
      seats: [...room.seats, { name: nameOf(name), token, userId }],
      revision: room.revision + 1,
      touched: Date.now(),
    });
    return token;
  }
  seat(room: Room<State, Options>, token: string): number {
    const seat = room.seats.findIndex((s) => matches(s.token, token));
    if (seat < 0) throw new RoomError('Rejoin using your original browser or join a new room.', 401);
    return seat;
  }
  authorizeUser(room: Room<State, Options>, token: string, userId: number): void {
    const index = this.seat(room, token);
    // Seats saved before accounts existed have no owner: the first signed-in holder of the token claims it.
    if (room.seats[index].userId === undefined) {
      this.commit(room, {
        ...room,
        seats: room.seats.map((s, i) => (i === index ? { ...s, userId } : s)),
      });
      return;
    }
    if (room.seats[index].userId !== userId)
      throw new RoomError('This seat belongs to another account.', 403);
  }
  view(room: Room<State, Options>, token: string): RoomView<State, Options> {
    const you = this.seat(room, token);
    const state = room.state && this.game.view ? this.game.view(room.state, you) : room.state;
    return {
      code: room.code,
      revision: room.revision,
      seats: room.seats.map((s) => ({ name: s.name })),
      capacity: room.capacity,
      options: room.options,
      state,
      you,
    };
  }
  revision(room: Room<State, Options>, revision: unknown): void {
    if (revision !== room.revision) throw new RoomError('The room changed. Try your action again.', 409);
  }
  start(room: Room<State, Options>, token: string, revision: unknown): void {
    if (this.seat(room, token) !== 0) throw new RoomError('Only the host can start.', 403);
    this.revision(room, revision);
    if (room.state || room.seats.length < Math.max(2, this.game.minPlayers))
      throw new RoomError(`At least ${Math.max(2, this.game.minPlayers)} players must join before starting.`, 409);
    const state = this.game.setup(
      room.seats.map((s) => s.name),
      room.options,
      random
    );
    this.commit(room, { ...room, state, revision: room.revision + 1, touched: Date.now() });
  }
  act(room: Room<State, Options>, token: string, revision: unknown, action: unknown): void {
    const seat = this.seat(room, token);
    this.revision(room, revision);
    if (!room.state || this.game.isOver(room.state)) throw new RoomError('No active game.', 409);
    if (!this.game.activeSeats(room.state).includes(seat)) throw new RoomError('Wait for your turn.', 403);
    if (!action || typeof action !== 'object') throw new RoomError('Invalid action.');
    // The game works on a private copy: a rejected action can never partially change the room.
    const next = this.game.apply(structuredClone(room.state), seat, action, random);
    if (next === null) return;
    this.commit(room, { ...room, state: next, revision: room.revision + 1, touched: Date.now() });
  }

  /**
   * Resolve when the room changes, after `timeout` ms, or when `signal` aborts.
   * Long-polls are capped so a flood of open requests cannot exhaust the process.
   */
  waitForChange(room: Room<State, Options>, timeout: number, signal?: AbortSignal): Promise<void> {
    if (this.waiting >= MAX_WAITERS || signal?.aborted) return Promise.resolve();
    return new Promise((resolve) => {
      const set = this.waiters.get(room.code) ?? new Set();
      this.waiters.set(room.code, set);
      const done = () => {
        if (!set.delete(done)) return;
        clearTimeout(timer);
        signal?.removeEventListener('abort', done);
        if (!set.size) this.waiters.delete(room.code);
        this.waiting--;
        resolve();
      };
      const timer = setTimeout(done, timeout);
      signal?.addEventListener('abort', done);
      set.add(done);
      this.waiting++;
    });
  }
  private notify(code: string): void {
    for (const done of [...(this.waiters.get(code) ?? [])]) done();
  }
  /** Answer every open long-poll now (used on shutdown). */
  release(): void {
    for (const code of [...this.waiters.keys()]) this.notify(code);
  }
  stats() {
    return { rooms: this.rooms.size, waiting: this.waiting };
  }
}
