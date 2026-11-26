import { createHash, randomBytes, scrypt as derive } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { RoomError } from './game';
import { matches, secret } from './rooms';
const scrypt = promisify(derive);
const lifetime = 30 * 24 * 60 * 60 * 1000;
function hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
export interface User { id: number; username: string }
export class Accounts {
  constructor(private database: DatabaseSync) {
    database.exec(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      salt TEXT NOT NULL, password TEXT NOT NULL
    ); CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL
    );`);
  }
  private credentials(input: Record<string, unknown>): { username: string; password: string } {
    if (typeof input.username !== 'string' || !/^[a-zA-Z0-9_]{3,30}$/.test(input.username)) throw new RoomError('Use a username of 3–30 letters, numbers or underscores.');
    if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 128) throw new RoomError('Use a password of 12–128 characters.');
    return { username: input.username.toLowerCase(), password: input.password };
  }
  private issue(user: User): { user: User; token: string } {
    this.database.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    // Bound each account to its ten most recent active sessions.
    this.database.prepare('DELETE FROM sessions WHERE user_id = ? AND token NOT IN (SELECT token FROM sessions WHERE user_id = ? ORDER BY expires DESC LIMIT 9)').run(user.id,user.id);
    const token = secret();
    this.database.prepare('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)').run(hash(token),user.id,Date.now()+lifetime);
    return { user, token };
  }
  async register(input: Record<string,unknown>) {
    const {username,password}=this.credentials(input);
    const salt=randomBytes(16).toString('hex');
    const digest=(await scrypt(password,salt,64) as Buffer).toString('hex');
    try {
      const result=this.database.prepare('INSERT INTO users(username,salt,password) VALUES(?,?,?)').run(username,salt,digest);
      return this.issue({id:Number(result.lastInsertRowid),username});
    } catch (error) {
      if (this.database.prepare('SELECT id FROM users WHERE username = ?').get(username)) throw new RoomError('That username is unavailable.',409);
      throw error;
    }
  }
  async login(input: Record<string,unknown>) {
    const {username,password}=this.credentials(input);
    const row=this.database.prepare('SELECT id,username,salt,password FROM users WHERE username = ?').get(username);
    // Unknown users perform the same expensive derivation.
    const digest=(await scrypt(password,row ? String(row.salt) : '0'.repeat(32),64) as Buffer).toString('hex');
    if (!row || !matches(digest,String(row.password))) throw new RoomError('Username or password is incorrect.',401);
    return this.issue({id:Number(row.id),username:String(row.username)});
  }
  token(req: IncomingMessage): string {
    return req.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith('goats_session='))?.slice('goats_session='.length) || '';
  }
  current(req: IncomingMessage): User | null {
    const row=this.database.prepare('SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ? AND sessions.expires > ?').get(hash(this.token(req)),Date.now());
    return row ? {id:Number(row.id),username:String(row.username)} : null;
  }
  require(req: IncomingMessage): User {
    const user=this.current(req); if (!user) throw new RoomError('Sign in to play online.',401); return user;
  }
  logout(req: IncomingMessage): void { this.database.prepare('DELETE FROM sessions WHERE token = ?').run(hash(this.token(req))); }
  cookie(token: string): string {
    const secure=process.env.PUBLIC_ORIGIN?.startsWith('https://') ? '; Secure' : '';
    return `goats_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token ? lifetime/1000 : 0}${secure}`;
  }
}
