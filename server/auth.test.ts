// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { app } from './http';
import { Accounts } from './platform';
import { Rooms } from './rooms';

const password = 'correct-horse-battery-staple';
describe('HTTP accounts', () => {
  async function serve(withAccounts = true) {
    const rooms = new Rooms(':memory:');
    const accounts = withAccounts ? new Accounts(rooms.database!) : undefined;
    const server = app(rooms, accounts);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    async function call(
      path: string,
      options: { token?: string; data?: unknown; cookie?: string; forwarded?: string } = {}
    ) {
      const response = await fetch(`${origin}/api${path}`, {
        method: options.data === undefined ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
          ...(options.cookie ? { cookie: options.cookie } : {}),
          ...(options.forwarded ? { 'x-forwarded-for': options.forwarded } : {}),
        },
        body: options.data === undefined ? undefined : JSON.stringify(options.data),
      });
      return {
        status: response.status,
        data: await response.json(),
        setCookie: response.headers.get('set-cookie') ?? '',
      };
    }
    return {
      call,
      async close() {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        );
      },
    };
  }
  it('signs up, keeps the session in a cookie and recovers the seat on another device', async () => {
    const { call, close } = await serve(true);
    try {
      const registered = await call('/auth/register', { data: { username: 'goat', password } });
      expect(registered.status).toBe(200);
      expect(registered.data.username).toBe('goat');
      const cookie = registered.setCookie.split(';')[0];
      expect(cookie).toContain('goats_session=');
      expect((await call('/auth/me', { cookie })).data.username).toBe('goat');

      expect((await call('/rooms', { data: { name: 'Host', capacity: 2 } })).status).toBe(401);

      const room = await call('/rooms', {
        cookie,
        data: { name: 'Host', capacity: 2 },
      });
      expect(room.status).toBe(201);
      const code = room.data.room.code;

      const mine = await call('/my-rooms', { cookie });
      expect(mine.status).toBe(200);
      expect(mine.data).toHaveLength(1);
      expect(mine.data[0].code).toBe(code);
      expect(mine.data[0].token).toBe(room.data.token);

      // The seat token from the account works on a different device.
      const recovered = await call(`/rooms/${code}`, {
        cookie,
        token: mine.data[0].token,
      });
      expect(recovered.status).toBe(200);
      expect(recovered.data.you).toBe(0);

      const other = await call('/auth/register', {
        data: { username: 'other', password },
      });
      const otherCookie = other.setCookie.split(';')[0];
      const stolen = await call(`/rooms/${code}/action`, {
        cookie: otherCookie,
        token: room.data.token,
        data: { revision: 0, action: { type: 'end' } },
      });
      expect(stolen.status).toBe(403);
      expect(stolen.data.error).toContain('another account');

      expect((await call('/auth/logout', { cookie, data: {} })).status).toBe(200);
      expect((await call('/auth/me', { cookie })).data).toBeNull();
    } finally {
      await close();
    }
  });
  it('keeps the LAN mode open for guests without an account', async () => {
    const { call, close } = await serve(false);
    try {
      expect((await call('/config')).data.login).toBe(false);
      const room = await call('/rooms', { data: { name: 'Host', capacity: 2 } });
      expect(room.status).toBe(201);
      const guest = await call(`/rooms/${room.data.room.code}/join`, {
        data: { name: 'Guest' },
      });
      expect(guest.status).toBe(200);
      expect((await call('/my-rooms')).status).toBe(404);
    } finally {
      await close();
    }
  });
  it('returns the same seat when an account rejoins a started game from another device', async () => {
    const { call, close } = await serve(true);
    try {
      const host = (await call('/auth/register', { data: { username: 'host', password } }))
        .setCookie.split(';')[0];
      const guest = (await call('/auth/register', { data: { username: 'guest', password } }))
        .setCookie.split(';')[0];
      const room = await call('/rooms', { cookie: host, data: { name: 'Host', capacity: 3 } });
      const code = room.data.room.code;
      const joined = await call(`/rooms/${code}/join`, { cookie: guest, data: { name: 'Guest' } });
      expect(joined.data.room.you).toBe(1);
      const again = await call(`/rooms/${code}/join`, { cookie: guest, data: { name: 'Guest' } });
      expect(again.data.token).toBe(joined.data.token);
      expect(again.data.room.seats).toHaveLength(2);
      const started = await call(`/rooms/${code}/start`, {
        cookie: host,
        token: room.data.token,
        data: { revision: 1 },
      });
      expect(started.status).toBe(200);
      const rejoined = await call(`/rooms/${code}/join`, { cookie: guest, data: { name: 'Guest' } });
      expect(rejoined.status).toBe(200);
      expect(rejoined.data.room.you).toBe(1);
      // A different account cannot take a seat after the start.
      const late = (await call('/auth/register', { data: { username: 'late', password } }))
        .setCookie.split(';')[0];
      expect((await call(`/rooms/${code}/join`, { cookie: late, data: { name: 'Late' } })).status).toBe(409);
    } finally {
      await close();
    }
  });
  it('throttles sign-in attempts per client, keyed by the forwarded address behind a trusted proxy', async () => {
    const { call, close } = await serve(true);
    const previous = process.env.TRUST_PROXY;
    try {
      const attempt = (forwarded?: string) =>
        call('/auth/login', { data: { username: 'nobody', password }, forwarded });
      for (let i = 0; i < 12; i++) expect((await attempt()).status).toBe(401);
      expect((await attempt()).status).toBe(429);
      process.env.TRUST_PROXY = '1';
      expect((await attempt('203.0.113.7')).status).toBe(401);
    } finally {
      if (previous === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = previous;
      await close();
    }
  });
});
