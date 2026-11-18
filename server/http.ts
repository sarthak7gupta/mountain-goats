import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Rooms, RoomError } from './rooms';

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let data = '';
  for await (const chunk of req) { data += chunk; if (Buffer.byteLength(data) > 8192) throw new RoomError('Request too large.', 413); }
  try { const value = JSON.parse(data || '{}'); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; }
  catch { throw new RoomError('Invalid JSON.'); }
}
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value));
}
export function app(rooms = new Rooms()) {
  const limits = new Map<string, { count: number; until: number }>();
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        if (req.method === 'POST') {
          // Same-origin API only. A deployed landing page navigates to the LAN URL.
          const origin = req.headers.origin;
          if (origin && origin !== process.env.PUBLIC_ORIGIN && origin !== `http://${req.headers.host}`) throw new RoomError('Open the game at the host address.', 403);
          const key = req.socket.remoteAddress || 'unknown';
          const now = Date.now();
          if (limits.size > 1000) for (const [k,v] of limits) if (v.until < now) limits.delete(k);
          const limit = limits.get(key);
          if (!limit || limit.until < now) limits.set(key, { count: 1, until: now + 60000 });
          else if (++limit.count > 240) throw new RoomError('Too many requests. Wait a minute.', 429);
        }
        if (url.pathname === '/api/config' && req.method === 'GET') return json(res, 200, { mode: process.env.MODE === 'online' ? 'online' : 'lan' });
        if (url.pathname === '/api/rooms' && req.method === 'POST') {
          const input = await body(req); const { room, token } = rooms.create(input);
          return json(res, 201, { token, room: rooms.view(room, token) });
        }
        const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)(?:\/(join|start|action))?$/i);
        if (!match) throw new RoomError('Not found.', 404);
        const room = rooms.get(match[1]);
        const token = req.headers.authorization?.replace(/^Bearer /, '') || '';
        if (!match[2] && req.method === 'GET') return json(res, 200, rooms.view(room, token));
        if (req.method !== 'POST') throw new RoomError('Method not allowed.', 405);
        const input = await body(req);
        if (match[2] === 'join') { const joined = rooms.join(room, input.name); return json(res, 200, { token: joined, room: rooms.view(room, joined) }); }
        if (match[2] === 'start') rooms.start(room, token, input.revision);
        else if (match[2] === 'action') rooms.act(room, token, input.revision, input.action);
        else throw new RoomError('Not found.', 404);
        return json(res, 200, rooms.view(room, token));
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new RoomError('Method not allowed.', 405);
      const root = resolve('dist');
      let pathname = decodeURIComponent(url.pathname).replace(/^\/mountain-goats\//, '/');
      if (pathname === '/') pathname = '/index.html';
      const path = resolve(root, `.${pathname}`);
      if (!path.startsWith(`${root}/`)) throw new RoomError('Not found.', 404);
      const data = await readFile(path).catch(() => { throw new RoomError('Build the frontend first: pnpm build', 404); });
      const mime: Record<string,string> = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png' };
      res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' }); res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) { json(res, error instanceof RoomError ? error.status : 500, { error: error instanceof RoomError ? error.message : 'Server error. Try again.' }); }
  });
  const shutdown = () => { server.close(() => { rooms.close(); process.exit(0); }); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const online = process.env.MODE === 'online';
  if (online && !process.env.PUBLIC_ORIGIN) throw new Error('Set PUBLIC_ORIGIN to the HTTPS deployment origin.');
  const rooms = new Rooms(online ? process.env.DATABASE_PATH || '.data/rooms.sqlite' : undefined);
  const server = app(rooms);
  server.listen(port, '0.0.0.0', () => {
    console.log(`Mountain Goats: http://localhost:${port}`);
    for (const addresses of Object.values(networkInterfaces())) for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) console.log(`Join on this Wi-Fi: http://${address.address}:${port}`);
    }
    console.log(online ? 'Online private rooms; durable SQLite storage enabled.' : 'Keep this host running. Rooms last until the host stops (maximum 24 hours inactive).');
  });
  const shutdown = () => { server.close(() => { rooms.close(); process.exit(0); }); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
