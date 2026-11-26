import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, resolve } from 'node:path';
import type { Accounts } from './accounts';
import { RoomError } from './game';
import type { GameRooms } from './rooms';

/** How long a long-poll waits for a change before answering with the current room. */
export const LONG_POLL_MS = 25_000;
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (Buffer.byteLength(data) > 8192) throw new RoomError('Request too large.', 413);
  }
  try {
    const value = JSON.parse(data || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new RoomError('Invalid JSON.');
  }
}
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
/** Addresses other devices on this network can use to reach the host. */
export function lanAddresses(port: number): string[] {
  return Object.values(networkInterfaces())
    .flatMap((list) => list || [])
    .filter((a) => a.family === 'IPv4' && !a.internal)
    .map((a) => `http://${a.address}:${port}`);
}
/** PUBLIC_ORIGIN as a browser sends it in the Origin header (no path or trailing slash). */
export function publicOrigin(): string | undefined {
  return process.env.PUBLIC_ORIGIN ? new URL(process.env.PUBLIC_ORIGIN).origin : undefined;
}

export interface GameServerOptions<State, Options> {
  rooms: GameRooms<State, Options>;
  /** Enables sign-in; every room request then requires an account. */
  accounts?: Accounts;
  /** Built frontend to serve. Default: ./dist */
  staticDir?: string;
  /** Path prefix the frontend was built with (e.g. `/my-game/`), stripped from asset URLs. */
  basePath?: string;
  /** `online` for an internet deployment; `lan` for a host on the local network. */
  mode?: 'lan' | 'online';
}

/**
 * HTTP API and static frontend for any GameDefinition. Same-origin JSON only;
 * room reads support `?since=<revision>` long-polling for instant updates.
 */
export function createGameServer<State, Options>({
  rooms,
  accounts,
  staticDir = 'dist',
  basePath = '/',
  mode = 'lan',
}: GameServerOptions<State, Options>) {
  const limits = new Map<string, { count: number; until: number }>();
  const root = resolve(staticDir);
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        if (req.method === 'POST') {
          if (!req.headers['content-type']?.startsWith('application/json'))
            throw new RoomError('Send JSON.', 415);
          // Same-origin API only. A deployed landing page navigates to the LAN URL.
          const origin = req.headers.origin;
          if (origin && origin !== publicOrigin() && origin !== `http://${req.headers.host}`)
            throw new RoomError('Open the game at the host address.', 403);
          // Behind a reverse proxy every socket is the proxy; TRUST_PROXY keys limits by the forwarded client.
          const forwarded = process.env.TRUST_PROXY
            ? String(req.headers['x-forwarded-for'] || '')
                .split(',')
                .pop()
                ?.trim()
            : '';
          const auth = url.pathname.startsWith('/api/auth/');
          const key = `${forwarded || req.socket.remoteAddress || 'unknown'}:${auth ? 'auth' : 'room'}`;
          const now = Date.now();
          if (limits.size > 1000) for (const [k, v] of limits) if (v.until < now) limits.delete(k);
          const limit = limits.get(key);
          if (!limit || limit.until < now) limits.set(key, { count: 1, until: now + 60000 });
          else if (++limit.count > (auth ? 12 : 240))
            throw new RoomError('Too many requests. Wait a minute.', 429);
        }
        const path = url.pathname;
        if (path === '/api/health' && req.method === 'GET') {
          rooms.database?.prepare('SELECT 1').get(); // Throws (500) if the database is unusable.
          return json(res, 200, { ok: true, game: rooms.game.name, ...rooms.stats() });
        }
        if (path === '/api/config' && req.method === 'GET')
          return json(
            res,
            200,
            mode === 'online'
              ? { mode, login: !!accounts }
              : { mode, login: !!accounts, lanUrls: lanAddresses(req.socket.localPort || 0) }
          );
        if (accounts) {
          if (path === '/api/auth/me' && req.method === 'GET') return json(res, 200, accounts.current(req));
          if (path === '/api/auth/logout' && req.method === 'POST') {
            accounts.logout(req);
            res.setHeader('Set-Cookie', accounts.cookie(''));
            return json(res, 200, { ok: true });
          }
          if ((path === '/api/auth/register' || path === '/api/auth/login') && req.method === 'POST') {
            const input = await body(req);
            const result = path.endsWith('/register') ? await accounts.register(input) : await accounts.login(input);
            res.setHeader('Set-Cookie', accounts.cookie(result.token));
            return json(res, 200, result.user);
          }
          if (path === '/api/my-rooms' && req.method === 'GET')
            return json(res, 200, rooms.forUser(accounts.require(req).id));
        }
        if (path === '/api/rooms' && req.method === 'GET') return json(res, 200, rooms.publicRooms());
        if (path === '/api/rooms' && req.method === 'POST') {
          const input = await body(req);
          const { room, token } = rooms.create(input, accounts?.require(req).id);
          return json(res, 201, { token, room: rooms.view(room, token) });
        }
        const match = path.match(/^\/api\/rooms\/([A-Z0-9]+)(?:\/(join|start|action))?$/i);
        if (!match) throw new RoomError('Not found.', 404);
        const user = accounts?.require(req);
        const room = rooms.get(match[1]);
        const token = req.headers.authorization?.replace(/^Bearer /, '') || '';
        if (user && match[2] !== 'join') rooms.authorizeUser(room, token, user.id);
        if (!match[2] && req.method === 'GET') {
          rooms.seat(room, token); // Reject unknown seats before holding a connection open.
          const since = Number(url.searchParams.get('since'));
          if (url.searchParams.has('since') && Number.isInteger(since) && room.revision <= since) {
            const closed = new AbortController();
            res.once('close', () => closed.abort());
            await rooms.waitForChange(room, LONG_POLL_MS, closed.signal);
            if (res.destroyed) return;
            const current = rooms.rooms.get(room.code);
            if (!current) throw new RoomError('Room not found or expired.', 404);
            return json(res, 200, rooms.view(current, token));
          }
          return json(res, 200, rooms.view(room, token));
        }
        if (req.method !== 'POST') throw new RoomError('Method not allowed.', 405);
        const input = await body(req);
        if (match[2] === 'join') {
          const joined = rooms.join(room, input.name, user?.id);
          return json(res, 200, { token: joined, room: rooms.view(room, joined) });
        }
        if (match[2] === 'start') rooms.start(room, token, input.revision);
        else if (match[2] === 'action') rooms.act(room, token, input.revision, input.action);
        else throw new RoomError('Not found.', 404);
        return json(res, 200, rooms.view(room, token));
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new RoomError('Method not allowed.', 405);
      let pathname: string;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        throw new RoomError('Not found.', 404);
      }
      if (basePath !== '/' && pathname.startsWith(basePath)) pathname = `/${pathname.slice(basePath.length)}`;
      if (pathname === '/') pathname = '/index.html';
      const file = resolve(root, `.${pathname}`);
      if (!file.startsWith(`${root}/`)) throw new RoomError('Not found.', 404);
      const data = await readFile(file).catch(() => {
        throw new RoomError('Build the frontend first: pnpm build', 404);
      });
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] || 'application/octet-stream',
        // Vite fingerprints everything under assets/; the HTML must always be revalidated.
        'Cache-Control': pathname.startsWith('/assets/')
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      if (!(error instanceof RoomError)) console.error(error);
      if (res.headersSent) return void res.end();
      json(res, error instanceof RoomError ? error.status : 500, {
        error: error instanceof RoomError ? error.message : 'Server error. Try again.',
      });
    }
  });
  // Long-polls hold a request for LONG_POLL_MS; keep idle sockets open a little longer.
  server.keepAliveTimeout = LONG_POLL_MS + 5000;
  return server;
}

/**
 * Start listening and stop cleanly on SIGTERM/SIGINT: answer open long-polls,
 * finish in-flight requests, then close the database.
 */
export function serve<State, Options>(
  server: ReturnType<typeof createServer>,
  rooms: GameRooms<State, Options>,
  port: number,
  onReady: () => void
): void {
  server.listen(port, '0.0.0.0', onReady);
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    rooms.release();
    server.close(() => {
      rooms.close();
      process.exit(0);
    });
    server.closeIdleConnections();
    // Never hang a deploy: force exit if a connection refuses to finish.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
