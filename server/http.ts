import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Accounts, createGameServer, lanAddresses, publicOrigin, serve } from './platform';
import { Rooms } from './rooms';

export { lanAddresses };

/** The Mountain Goats server: the platform HTTP API plus the built frontend. */
export function app(rooms = new Rooms(), accounts?: Accounts) {
  return createGameServer({
    rooms,
    accounts,
    basePath: '/mountain-goats/',
    mode: process.env.MODE === 'online' ? 'online' : 'lan',
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const online = process.env.MODE === 'online';
  if (online && !process.env.PUBLIC_ORIGIN) throw new Error('Set PUBLIC_ORIGIN to the HTTPS deployment origin.');
  publicOrigin(); // Fail at startup, not per request, on a malformed PUBLIC_ORIGIN.
  const rooms = new Rooms(online ? process.env.DATABASE_PATH || '.data/rooms.sqlite' : undefined);
  const server = app(rooms, online && rooms.database ? new Accounts(rooms.database) : undefined);
  serve(server, rooms, port, () => {
    console.log(`Mountain Goats: http://localhost:${port}`);
    for (const address of lanAddresses(port)) console.log(`Join on this Wi-Fi: ${address}`);
    console.log(
      online
        ? 'Online rooms with accounts; durable SQLite storage enabled.'
        : 'Keep this host running. Rooms last until the host stops (maximum 24 hours inactive).'
    );
  });
}
