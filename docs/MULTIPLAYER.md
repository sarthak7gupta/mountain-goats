# Multiplayer versions

The PRs form a stack. Merge v1 → v2 → v3 → v4. Each version is independently runnable.

## v1 — Wi-Fi, no hosted backend

Use Node 22+ and pnpm 12. Run `pnpm install`, `pnpm build`, then `pnpm host` on the host computer. Open a printed **Join on this Wi-Fi** URL on every device, create a room, and share its invitation link. Allow the host through your firewall. Guest networks/client isolation can prevent LAN access. Keep the host awake: stopping it ends all rooms. A room expires after 24 hours without an accepted action or join.

The frontend can still be published as static files (including GitHub Pages at `/mountain-goats/`). A static web page cannot bind a listening socket or discover its private IP address. It provides instructions and an **Open host** address field; navigation to the LAN host avoids mixed-content fetches and browser private-network restrictions. No cloud service or login is involved in v1. The local host process is necessary to serve the app and arbitrate the game.

Use `PORT=4000 pnpm host` to choose another port. The host serves `dist`, including the existing GitHub Pages asset prefix. For frontend-only iteration use `pnpm dev` (port 3000); for multiplayer run the built app with `pnpm host`.

## Rules and expansions

[Rules reference](https://www.yucata.de/en/Rules/MountainGoats). [Publisher Big Mountain rules](https://www.ostia-spiele.de/files/Mountain%20Goats%20Spielregel%20Grosser%20Berg.pdf).

Rooms support 2–5 players, six goats each, with Big Mountain and Green Valley independently selectable before starting. Big Mountain relocates an existing goat to an empty space 11–24; ranking is per goat, including multiple goats of one player. Recall a goat to the foot of an empty ordinary mountain. Green Valley receives goats from exhausted summits; 5/6 score 3, 7/8 score 4, 9/10 score 5 at game end. Redeploying removes its eventual valley score. A completed token set claims the highest remaining bonus. Game end finishes the current round, with no extra turn for the starting player. Final expansion scores are applied once before winner tiebreakers.

## Protocol and limits

The host owns dice rolls, scores, turns and room state. A device receives a random 256-bit bearer credential for its seat, stored in its browser. Never put that credential in an invitation link. Room reads require it, and responses omit all credentials. The invite code authorizes joining an unstarted room; anyone who knows it may join. The host starts with at least two joined players, up to the configured capacity.

Every command carries the room revision; a stale or repeated command is rejected with 409. Rejected game actions run against a copy and cannot partially change the room. Polling every 1.2 seconds converges all clients; no client uploads a game snapshot. Refreshing recovers the same seat. Clearing browser data or choosing **Leave room** loses that seat in v1. Disconnected seats are retained to allow rejoining; there are no bots, turn timeouts or host reassignment. A player who leaves midgame can stall it; begin a new room if they cannot return.

The host caps rooms at 500, incoming bodies at 8 KiB, and mutations at 240 per IP per minute. Active game journals retain 200 entries. Only the current player may act, including expansion relocation. LAN credentials travel over local HTTP; use a trusted Wi-Fi network.

## Verification

`pnpm test` covers the existing game and components, expansion scoring and goat conservation, equal-turn ending, host authority, capacity, revisions, invalid commands, hidden credentials, and real HTTP clients (including concurrent requests, origin rejection and reconnect). `pnpm build` type-checks both client and server and builds the frontend.

Run `pnpm exec playwright install chromium` once, then `pnpm build` and `pnpm host` in one terminal and `node tests/browser.mjs` in another. This checks independent desktop/mobile browser contexts, invitations, expansion selection, host start, turn controls, synchronization, refresh/rejoin, console errors, and mobile overflow. `PLAYWRIGHT_MODULE` can point to a preinstalled Playwright module.

## v2 — Private rooms on a backend

Deploy the included Dockerfile to one Node/Docker service, expose port 3000 behind HTTPS, and attach a persistent volume at `/data`. Set `PUBLIC_ORIGIN=https://your-game.example` to the exact origin users open. Both frontend and API are served from that origin; no CORS or separate LAN address is needed. The existing static frontend still provides the LAN entry; online invitations must point to the backend deployment origin. No credentials or database subscription are required.

For a local backend check: `PUBLIC_ORIGIN=http://localhost:3000 pnpm start`. `DATABASE_PATH` defaults to `.data/rooms.sqlite` locally. Node 22.13+ is required for native SQLite. A deployment must use **one process / one replica**; room authority is in memory with SQLite persistence, so multiple processes would violate concurrency invariants. Do not use ephemeral storage for an online deployment.

Every accepted room mutation is saved atomically to SQLite before being acknowledged or applied to live state. WAL mode supports safe crash recovery. Rooms, seats, invite codes, game state and revisions survive a restart. Disk-write failures leave live state unchanged and return an error. Startup fails rather than silently discarding an unreadable database. Rooms still expire after 24 hours inactive. Stop the server before copying the database plus its WAL files, or use SQLite's backup facility; keep backups private because seat credentials grant control.

Build: `docker build -t mountain-goats .`; run with a mounted persistent volume, `MODE=online`, `PUBLIC_ORIGIN` and `DATABASE_PATH`. Provisioning a hosted service and DNS is a separate deployment action; this PR adds the deployable backend rather than selecting a paid host automatically.

## v3 — Public rooms, no login

Select **Public room** when creating an expedition to list it in **Open expeditions**. Guests enter a display name and choose a room. Private is the default. Only unstarted, non-full public rooms are discoverable; the list updates every five seconds and contains room options/counts, never seat credentials or private room codes. Choosing a stale room does not reserve a seat: the server checks capacity and whether the game started again at join time. Public rooms use the same durable store and authority as private rooms. Anyone can join a public lobby, so use a private room to play with a known group.

## v4 — Accounts

`MODE=online` now requires an account to create, join or play a room. Create one with a username (3–30 letters, numbers or underscores) and a password of 12–128 characters; no email is collected. LAN hosting (`pnpm host`) stays account-free.

- **Seats follow the account.** Every seat records its owner. **Your expeditions** lists your rooms on any signed-in device; choose **Resume** to continue. Joining a room you already sit in returns your existing seat, even after the game started.
- **Seat tokens are not enough.** In online mode every room request needs the session cookie; viewing or acting on a seat also needs its seat token, and that seat must belong to the signed-in account. A copied seat from another account is rejected and forgotten on that device.
- **Sessions.** Passwords are hashed with scrypt and a per-user salt; unknown usernames take the same time as wrong passwords. Session tokens are stored only as SHA-256 hashes, last 30 days, are capped at ten per account and travel in an `HttpOnly; SameSite=Strict` cookie (`Secure` when `PUBLIC_ORIGIN` is HTTPS). Signing out ends the session and drops the seat saved on that device.
- **Rate limits.** Sign-in and sign-up accept 12 attempts per client per minute; room writes accept 240. Behind a reverse proxy, set `TRUST_PROXY=1` so limits use the client address from `X-Forwarded-For` instead of the proxy's address. Do not set it when the server is exposed directly.

Browser check: build, start `PORT=3111 MODE=online PUBLIC_ORIGIN=http://localhost:3111 DATABASE_PATH=/tmp/goats-e2e.sqlite pnpm exec tsx server/http.ts`, then run `BASE=http://localhost:3111 node tests/browser-online.mjs`.
