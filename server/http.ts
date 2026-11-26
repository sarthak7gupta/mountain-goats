import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Rooms, RoomError } from './rooms';
import { Accounts } from './accounts';

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let data = '';
  for await (const chunk of req) { data += chunk; if (Buffer.byteLength(data) > 8192) throw new RoomError('Request too large.', 413); }
  try { const value = JSON.parse(data || '{}'); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; }
  catch { throw new RoomError('Invalid JSON.'); }
}
/** Addresses other devices on this network can use to reach the host. */
export function lanAddresses(port: number): string[] {
  return Object.values(networkInterfaces()).flatMap(list => list || [])
    .filter(a => a.family === 'IPv4' && !a.internal).map(a => `http://${a.address}:${port}`);
}
/** PUBLIC_ORIGIN as a browser sends it in the Origin header (no path or trailing slash). */
function publicOrigin(): string | undefined {
  return process.env.PUBLIC_ORIGIN ? new URL(process.env.PUBLIC_ORIGIN).origin : undefined;
}
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value));
}
export function app(rooms = new Rooms(), accounts?: Accounts) {
  const limits = new Map<string, { count: number; until: number }>();
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        if (req.method === 'POST') {
          if (!req.headers['content-type']?.startsWith('application/json')) throw new RoomError('Send JSON.',415);
          // Same-origin API only. A deployed landing page navigates to the LAN URL.
          const origin = req.headers.origin;
          if (origin && origin !== publicOrigin() && origin !== `http://${req.headers.host}`) throw new RoomError('Open the game at the host address.', 403);
          // Behind a reverse proxy every socket is the proxy; TRUST_PROXY keys limits by the forwarded client.
          const forwarded = process.env.TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',').pop()?.trim() : '';
          const key = `${forwarded || req.socket.remoteAddress || 'unknown'}:${url.pathname.startsWith('/api/auth/') ? 'auth' : 'room'}`;
          const now = Date.now();
          if (limits.size > 1000) for (const [k,v] of limits) if (v.until < now) limits.delete(k);
          const limit = limits.get(key);
          if (!limit || limit.until < now) limits.set(key, { count: 1, until: now + 60000 });
          else if (++limit.count > (url.pathname.startsWith('/api/auth/') ? 12 : 240)) throw new RoomError('Too many requests. Wait a minute.', 429);
        }
        if (url.pathname === '/api/config' && req.method === 'GET') return json(res, 200, process.env.MODE === 'online' ? { mode: 'online', login: !!accounts } : { mode: 'lan', login: !!accounts, lanUrls: lanAddresses(req.socket.localPort || 0) });
        if (url.pathname === '/api/auth/me' && req.method === 'GET' && accounts) return json(res, 200, accounts.current(req));
        if (url.pathname === '/api/auth/logout' && req.method === 'POST' && accounts) {
          accounts.logout(req); res.setHeader('Set-Cookie', accounts.cookie('')); return json(res, 200, { ok: true });
        }
        if ((url.pathname === '/api/auth/register' || url.pathname === '/api/auth/login') && req.method === 'POST' && accounts) {
          const input = await body(req);
          const result = url.pathname.endsWith('/register') ? await accounts.register(input) : await accounts.login(input);
          res.setHeader('Set-Cookie', accounts.cookie(result.token)); return json(res, 200, result.user);
        }
        if (url.pathname === '/api/my-rooms' && req.method === 'GET' && accounts) return json(res, 200, rooms.forUser(accounts.require(req).id));
        if (url.pathname === '/api/rooms' && req.method === 'GET') return json(res, 200, rooms.publicRooms());
        if (url.pathname === '/api/rooms' && req.method === 'POST') {
          const input = await body(req); const { room, token } = rooms.create(input, accounts?.require(req).id);
          return json(res, 201, { token, room: rooms.view(room, token) });
        }
        const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)(?:\/(join|start|action))?$/i);
        if (!match) throw new RoomError('Not found.', 404);
        const user = accounts?.require(req);
        const room = rooms.get(match[1]);
        const token = req.headers.authorization?.replace(/^Bearer /, '') || '';
        if (user && match[2] !== 'join') rooms.authorizeUser(room, token, user.id);
        if (!match[2] && req.method === 'GET') return json(res, 200, rooms.view(room, token));
        if (req.method !== 'POST') throw new RoomError('Method not allowed.', 405);
        const input = await body(req);
        if (match[2] === 'join') { const joined = rooms.join(room, input.name, user?.id); return json(res, 200, { token: joined, room: rooms.view(room, joined) }); }
        if (match[2] === 'start') rooms.start(room, token, input.revision);
        else if (match[2] === 'action') rooms.act(room, token, input.revision, input.action);
        else throw new RoomError('Not found.', 404);
        return json(res, 200, rooms.view(room, token));
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new RoomError('Method not allowed.', 405);
      const root = resolve('dist');
      let pathname: string;
      try { pathname = decodeURIComponent(url.pathname); } catch { throw new RoomError('Not found.', 404); }
      pathname = pathname.replace(/^\/mountain-goats\//, '/');
      if (pathname === '/') pathname = '/index.html';
      const path = resolve(root, `.${pathname}`);
      if (!path.startsWith(`${root}/`)) throw new RoomError('Not found.', 404);
      const data = await readFile(path).catch(() => { throw new RoomError('Build the frontend first: pnpm build', 404); });
      const mime: Record<string,string> = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png' };
      res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' }); res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) { json(res, error instanceof RoomError ? error.status : 500, { error: error instanceof RoomError ? error.message : 'Server error. Try again.' }); }
  });
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const online = process.env.MODE === 'online';
  if (online && !process.env.PUBLIC_ORIGIN) throw new Error('Set PUBLIC_ORIGIN to the HTTPS deployment origin.');
  publicOrigin(); // Fail at startup, not per request, on a malformed PUBLIC_ORIGIN.
  const rooms = new Rooms(online ? process.env.DATABASE_PATH || '.data/rooms.sqlite' : undefined);
  const server = app(rooms, online ? new Accounts(rooms.database!) : undefined);
  server.listen(port, '0.0.0.0', () => {
    console.log(`Mountain Goats: http://localhost:${port}`);
    for (const address of lanAddresses(port)) console.log(`Join on this Wi-Fi: ${address}`);
    console.log(online ? 'Online rooms with accounts; durable SQLite storage enabled.' : 'Keep this host running. Rooms last until the host stops (maximum 24 hours inactive).');
  });
  const shutdown = () => { server.close(() => { rooms.close(); process.exit(0); }); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
