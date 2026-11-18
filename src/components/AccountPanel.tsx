import { type FormEvent, useEffect, useState } from 'react';
import { type RoomSummary, request, type User } from '../api';

interface Props {
  user: User | null;
  onUser: (user: User | null) => void;
  onResume: (room: RoomSummary) => void;
  onError: (message: string) => void;
}
export default function AccountPanel({ user, onUser, onResume, onError }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      setRooms([]);
      return;
    }
    let active = true;
    request<RoomSummary[]>('/my-rooms')
      .then((list) => {
        if (active) setRooms(list);
      })
      .catch(() => {
        if (active) setRooms([]);
      });
    return () => {
      active = false;
    };
  }, [user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const account = await request<User>(`/auth/${mode}`, {
        data: { username, password },
      });
      setPassword('');
      onUser(account);
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      onError(message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await request('/auth/logout', { data: {} });
      setRooms([]);
      onUser(null);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (user)
    return (
      <section className="panel account-panel" aria-label="Your account" id="account">
        <p className="eyebrow">SIGNED IN</p>
        <h2>Hello, {user.username}</h2>
        <p>
          Your seat travels with your account. Sign in on any device to pick up where you left off.
        </p>
        {rooms.length ? (
          <ul className="my-rooms">
            {rooms.map((room) => (
              <li key={room.code}>
                <div>
                  <strong>Room {room.code}</strong>
                  <small>
                    {room.finished ? 'Finished' : room.started ? 'In progress' : 'Waiting to start'}
                  </small>
                </div>
                <button type="button" onClick={() => onResume(room)}>
                  Resume room {room.code}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No expeditions yet. Create a room to start one.</p>
        )}
        <button type="button" className="secondary" disabled={busy} onClick={() => void signOut()}>
          Sign out
        </button>
      </section>
    );

  return (
    <section className="panel account-panel" aria-label="Your account" id="account">
      <p className="eyebrow">BASE CAMP ACCOUNT</p>
      <h2>{mode === 'login' ? 'Sign in' : 'Create an account'}</h2>
      <p>
        {mode === 'login'
          ? 'Your account keeps your seat across devices and recovers games after a reset.'
          : 'One account for every device. No email needed — pick a username and a password.'}
      </p>
      <form onSubmit={(event) => void submit(event)}>
        <label>
          Username
          <input
            required
            minLength={3}
            maxLength={30}
            autoComplete="username"
            pattern="[A-Za-z0-9_]{3,30}"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="trail_name"
          />
        </label>
        <label>
          Password <small>At least 12 characters</small>
          <input
            required
            minLength={12}
            maxLength={128}
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
          />
        </label>
        {error && (
          <p role="alert" className="account-error">
            {error}
          </p>
        )}
        <button disabled={busy} type="submit">
          {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <button
        type="button"
        className="text-button"
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setError('');
        }}
      >
        {mode === 'login' ? 'Need an account? Create one →' : 'Already registered? Sign in →'}
      </button>
    </section>
  );
}
