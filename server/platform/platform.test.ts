// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createGameServer, type GameDefinition, GameRooms, RoomError } from '.';

/** Nim: take 1–3 stones in turn; whoever takes the last stone wins. */
interface Nim {
  stones: number;
  turn: number;
  players: number;
  winner: number | null;
}
const nim: GameDefinition<Nim, { stones: number }> = {
  name: 'Nim',
  minPlayers: 2,
  maxPlayers: 4,
  options: (input) => {
    const stones = input.stones ?? 10;
    if (!Number.isInteger(stones) || Number(stones) < 3 || Number(stones) > 50)
      throw new RoomError('Choose 3–50 stones.');
    return { stones: Number(stones) };
  },
  setup: (players, options) => ({ stones: options.stones, turn: 0, players: players.length, winner: null }),
  activeSeats: (state) => (state.winner === null ? [state.turn] : []),
  isOver: (state) => state.winner !== null,
  apply(state, seat, raw) {
    const take = (raw as { take?: unknown }).take;
    if (!Number.isInteger(take) || Number(take) < 1 || Number(take) > Math.min(3, state.stones))
      throw new RoomError('Take 1–3 stones.');
    state.stones -= Number(take);
    if (state.stones === 0) state.winner = seat;
    else state.turn = (state.turn + 1) % state.players;
    return state;
  },
};

describe('game platform with another game', () => {
  it('runs a different game through rooms: options, turns, rejection without mutation, game over', () => {
    const rooms = new GameRooms(nim);
    expect(() => rooms.create({ name: 'A', capacity: 2, stones: 99 })).toThrow('3–50');
    expect(() => rooms.create({ name: 'A', capacity: 9 })).toThrow('2–4 seats');
    const { room, token } = rooms.create({ name: 'A', capacity: 2, stones: 4 });
    const guest = rooms.join(room, 'B');
    rooms.start(room, token, room.revision);
    expect(() => rooms.act(room, guest, room.revision, { take: 1 })).toThrow('turn');
    expect(() => rooms.act(room, token, room.revision, { take: 9 })).toThrow('1–3');
    expect(room.state).toEqual({ stones: 4, turn: 0, players: 2, winner: null });
    rooms.act(room, token, room.revision, { take: 3 });
    rooms.act(room, guest, room.revision, { take: 1 });
    expect(room.state?.winner).toBe(1);
    expect(() => rooms.act(room, token, room.revision, { take: 1 })).toThrow('No active game');
    rooms.close();
  });

  it('persists any game state and restores it after a restart', () => {
    const dir = mkdtempSync(join(tmpdir(), 'platform-'));
    try {
      const first = new GameRooms(nim, join(dir, 'rooms.sqlite'));
      const { room, token } = first.create({ name: 'A', capacity: 2 });
      first.join(room, 'B');
      first.start(room, token, room.revision);
      first.act(room, token, room.revision, { take: 2 });
      first.close();
      const second = new GameRooms(nim, join(dir, 'rooms.sqlite'));
      expect(second.get(room.code).state).toEqual({ stones: 8, turn: 1, players: 2, winner: null });
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('wakes long-polls on change, times out quietly, and reports health', async () => {
    const rooms = new GameRooms(nim);
    const server = createGameServer({ rooms });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const call = async (path: string, token?: string, data?: unknown) => {
      const res = await fetch(`${origin}/api${path}`, {
        method: data === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      return { status: res.status, data: await res.json() };
    };
    try {
      const host = await call('/rooms', undefined, { name: 'A', capacity: 2 });
      const code = host.data.room.code;
      const guest = await call(`/rooms/${code}/join`, undefined, { name: 'B' });
      // Guest waits at revision 1; the host's start must answer it immediately.
      const started = Date.now();
      const waiting = call(`/rooms/${code}?since=1`, guest.data.token);
      await new Promise((r) => setTimeout(r, 100));
      expect(rooms.stats().waiting).toBe(1);
      await call(`/rooms/${code}/start`, host.data.token, { revision: 1 });
      const woke = await waiting;
      expect(woke.data.revision).toBe(2);
      expect(woke.data.state.stones).toBe(10);
      expect(Date.now() - started).toBeLessThan(2000);
      expect(rooms.stats().waiting).toBe(0);
      // A stale `since` answers at once; an unknown seat is refused before waiting.
      expect((await call(`/rooms/${code}?since=0`, guest.data.token)).data.revision).toBe(2);
      expect((await call(`/rooms/${code}?since=2`, 'nope')).status).toBe(401);
      const health = await call('/health');
      expect(health.data).toMatchObject({ ok: true, game: 'Nim', rooms: 1, waiting: 0 });
    } finally {
      rooms.release();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rooms.close();
    }
  });
});
