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
