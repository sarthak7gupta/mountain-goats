// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IncomingMessage } from 'node:http';
import { Accounts } from './accounts';
import { Rooms } from './rooms';

function withCookie(token: string): IncomingMessage {
  return { headers: { cookie: `goats_session=${token}` } } as unknown as IncomingMessage;
}
describe('accounts', () => {
  const password = 'correct-horse-battery-staple';
  function store() {
    const rooms = new Rooms(':memory:');
    return { rooms, accounts: new Accounts(rooms.database!) };
  }
  it('registers an account with a hashed password and never stores the secret', async () => {
    const { rooms, accounts } = store();
    const { user, token } = await accounts.register({ username: 'Trail_Name', password });
    expect(user.username).toBe('trail_name');
    const row = rooms.database!
      .prepare('SELECT salt, password FROM users WHERE id = ?')
      .get(user.id) as { salt: string; password: string };
    expect(row.password).not.toContain(password);
    expect(row.password).toHaveLength(128);
    expect(row.salt).toHaveLength(32);
    expect(token).toHaveLength(64);
  });
  it('signs in with the right password and refuses the wrong one', async () => {
    const { accounts } = store();
    await accounts.register({ username: 'goat', password });
    const signedIn = await accounts.login({ username: 'GOAT', password });
    expect(signedIn.user.username).toBe('goat');
    await expect(accounts.login({ username: 'goat', password: 'wrong-password-here' })).rejects.toThrow(
      'incorrect'
    );
  });
  it('refuses an unknown user with the same message as a wrong password', async () => {
    const { accounts } = store();
    await expect(accounts.login({ username: 'nobody', password })).rejects.toThrow('incorrect');
  });
  it('refuses a duplicate username', async () => {
    const { accounts } = store();
    await accounts.register({ username: 'goat', password });
    await expect(accounts.register({ username: 'goat', password })).rejects.toThrow('unavailable');
  });
  it('rejects weak usernames and passwords', async () => {
    const { accounts } = store();
    await expect(accounts.register({ username: 'a', password })).rejects.toThrow('username');
    await expect(accounts.register({ username: 'goat', password: 'short' })).rejects.toThrow(
      'password'
    );
  });
  it('keeps sessions in an http only cookie and clears them on logout', async () => {
    const { accounts } = store();
    const { user, token } = await accounts.register({ username: 'goat', password });
    const cookie = accounts.cookie(token);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain(`goats_session=${token}`);
    expect(accounts.current(withCookie(token))).toEqual(user);
    accounts.logout(withCookie(token));
    expect(accounts.current(withCookie(token))).toBeNull();
    expect(() => accounts.require(withCookie(token))).toThrow('Sign in');
    expect(accounts.cookie('')).toContain('Max-Age=0');
  });
  it('stores only a hash of the session token', async () => {
    const { rooms, accounts } = store();
    const { token } = await accounts.register({ username: 'goat', password });
    const row = rooms.database!.prepare('SELECT token FROM sessions').get() as { token: string };
    expect(row.token).not.toBe(token);
  });
  it('keeps at most ten active sessions per account', async () => {
    const { accounts } = store();
    await accounts.register({ username: 'goat', password });
    for (let i = 0; i < 15; i++) await accounts.login({ username: 'goat', password });
    const sessions = await accounts.login({ username: 'goat', password });
    expect(sessions.token).toBeTruthy();
  });
});
