# Game platform

`server/platform/` hosts any turn-based game with hidden-credential seats, invite codes, optional accounts, durable SQLite rooms and instant updates. `src/platform/` is the matching browser side. Neither imports anything from Mountain Goats.

| Piece | File | Owns |
| --- | --- | --- |
| `GameDefinition` | `server/platform/game.ts` | The contract a game implements |
| `GameRooms` | `server/platform/rooms.ts` | Rooms, seats, revisions, persistence, expiry, long-poll wakeups |
| `createGameServer`, `serve` | `server/platform/http.ts` | JSON API, rate limits, same-origin checks, static frontend, graceful shutdown |
| `Accounts` | `server/platform/accounts.ts` | Usernames, scrypt passwords, session cookies |
| `useRoom` | `src/platform/useRoom.ts` | Saved seat, create/join/resume/start/act, live room sync |
| Wire types | `src/platform/protocol.ts` | `RoomView`, `PublicRoom`, `Session`, … |

## Add a game

1. **Rules.** Describe the game as a `GameDefinition`. State must be plain JSON. `apply` gets a private copy of the state, so mutate it and return it; return `null` for a no-op; throw `RoomError` for an illegal move (the room is left untouched). Use the `random` argument for dice and shuffles, never `Math.random`, so the server stays the only source of chance.

   ```ts
   import { type GameDefinition, RoomError } from './platform';

   interface Nim { stones: number; turn: number; players: number; winner: number | null }

   export const nim: GameDefinition<Nim, { stones: number }> = {
     name: 'Nim',
     minPlayers: 2,
     maxPlayers: 4,
     options: (input) => ({ stones: Number.isInteger(input.stones) ? Number(input.stones) : 10 }),
     setup: (players, { stones }) => ({ stones, turn: 0, players: players.length, winner: null }),
     activeSeats: (s) => (s.winner === null ? [s.turn] : []),
     isOver: (s) => s.winner !== null,
     apply(s, seat, action) {
       const take = (action as { take?: unknown }).take;
       if (!Number.isInteger(take) || Number(take) < 1 || Number(take) > Math.min(3, s.stones))
         throw new RoomError('Take 1–3 stones.');
       s.stones -= Number(take);
       if (s.stones === 0) s.winner = seat;
       else s.turn = (s.turn + 1) % s.players;
       return s;
     },
   };
   ```

   For hidden information (hands, decks), add `view(state, seat)` and return what that seat may see.

2. **Server.** Bind rooms to the game and serve it:

   ```ts
   const rooms = new GameRooms(nim, process.env.DATABASE_PATH); // omit the path for in-memory rooms
   const server = createGameServer({ rooms, accounts: new Accounts(rooms.database!), mode: 'online' });
   serve(server, rooms, 3000, () => console.log('Nim on :3000'));
   ```

3. **Client.** Render from `room.state` and send actions:

   ```tsx
   const { room, create, join, start, act, busy, error } = useRoom<Nim, { stones: number }, { take: number }>({
     storageKey: 'nim-seat',
     enabled: true,
     account: { login: false, user: null },
     onSignedOut: () => {},
   });
   // create({ name, capacity: 2, stones: 15 }); act({ take: 2 });
   ```

`server/platform/platform.test.ts` runs exactly this Nim game through rooms, persistence and HTTP long-polling; it is the reference for a new game.

## Guarantees

- **One writer.** Every change goes through `GameRooms`; it is written to SQLite before it becomes live, then wakes waiting clients.
- **Revisions.** Each accepted change increments `revision`. Commands carry the revision they were based on; stale ones get 409 and the client refreshes.
- **Turn order.** Only seats in `activeSeats(state)` may act. Simultaneous-move games return several seats.
- **Credentials.** Seat tokens travel only in the `Authorization` header and never appear in a view.

## Limits

One process per database: rooms live in memory, so do not run replicas. Rooms expire 24 hours after their last change; there are at most 500 rooms and 2,000 open long-polls per process. Bodies are capped at 8 KiB; writes at 240 per client per minute (12 for sign-in).
