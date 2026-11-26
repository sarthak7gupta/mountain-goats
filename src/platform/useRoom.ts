import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, request } from './api';
import type { RoomView, Session, User } from './protocol';

/** Longer than the server's 25 s long-poll so a quiet room is not mistaken for a dead link. */
const LONG_POLL_TIMEOUT = 35_000;

function savedSeat(key: string): Session | null {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

export interface UseRoomOptions {
  /** localStorage key for this game's seat. */
  storageKey: string;
  /** Sync only while true (e.g. not during local play, and once server config is known). */
  enabled: boolean;
  /** Whether the server requires accounts, and who is signed in. */
  account: { login: boolean; user: User | null };
  /** The server says the account session is gone; the seat is kept for after sign-in. */
  onSignedOut: () => void;
}

/**
 * Seat, room snapshot and live updates for any platform game. The room is
 * kept current with long-polling (`?since=revision`), one request at a time,
 * paused in background tabs, with backoff while the network is down.
 */
export function useRoom<State, Options, Action>({
  storageKey,
  enabled,
  account,
  onSignedOut,
}: UseRoomOptions) {
  type View = RoomView<State, Options>;
  const [session, setSession] = useState<Session | null>(() => savedSeat(storageKey));
  const [room, setRoom] = useState<View | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef<View | null>(null);
  const pending = useRef(false);
  const poke = useRef<() => void>(() => {});
  const live = useRef({ account, onSignedOut });
  live.current = { account, onSignedOut };

  /** Accept a snapshot unless it is older than the one shown. */
  const adopt = useCallback((next: View) => {
    const old = latest.current;
    if (old && old.code === next.code && next.revision < old.revision) return;
    latest.current = next;
    setRoom(next);
  }, []);
  const forget = useCallback(
    (message = '') => {
      localStorage.removeItem(storageKey);
      latest.current = null;
      setSession(null);
      setRoom(null);
      setError(message);
      history.replaceState(null, '', location.pathname);
    },
    [storageKey]
  );
  const enter = useCallback(
    (seat: Session, view: View) => {
      localStorage.setItem(storageKey, JSON.stringify(seat));
      setSession(seat);
      adopt(view);
      setConnected(true);
      history.replaceState(null, '', `${location.pathname}?room=${seat.code}`);
    },
    [storageKey, adopt]
  );

  useEffect(() => {
    if (!session || !enabled) return;
    let active = true;
    let inFlight = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (delay: number) => {
      if (active) timer = setTimeout(loop, delay);
    };
    async function loop() {
      clearTimeout(timer);
      // Background tabs stop; visibilitychange resumes them.
      if (!active || inFlight || document.hidden || !session) return;
      inFlight = true;
      const since = latest.current?.code === session.code ? latest.current.revision : -1;
      try {
        const next = await request<View>(`/rooms/${session.code}?since=${since}`, {
          token: session.token,
          timeout: LONG_POLL_TIMEOUT,
        });
        if (!active) return;
        adopt(next);
        setConnected(true);
        setError((old) => (old.startsWith('Connection failed') ? '' : old));
        failures = 0;
        inFlight = false;
        // A changed room re-polls at once; an unchanged answer means the server waited (or is shedding load).
        schedule(next.revision > since ? 0 : 1000);
        return;
      } catch (e) {
        inFlight = false;
        if (!active) return;
        const status = (e as ApiError).status;
        const { account: current, onSignedOut: signedOut } = live.current;
        if (status === 401 && current.login) {
          // Signed out, or the session lapsed: keep the seat and offer sign-in.
          const user = current.user
            ? await request<User | null>('/auth/me').catch(() => null)
            : null;
          if (!active) return;
          if (!user) {
            signedOut();
            latest.current = null;
            setRoom(null);
            setConnected(false);
            return schedule(2000);
          }
        }
        // 404: the room is gone (expired or the host restarted). 401/403: the seat is
        // unknown here or belongs to another account.
        if (status === 404 || status === 401 || status === 403) {
          forget(
            `${(e as Error).message} Your saved seat was removed from this ${current.login ? 'device' : 'browser'}.`
          );
          return;
        }
        failures++;
        setConnected(false);
        setError((e as Error).message);
        schedule(Math.min(1000 * 2 ** (failures - 1), 15_000));
      }
    }
    poke.current = () => void loop();
    const visible = () => {
      if (!document.hidden) void loop();
    };
    document.addEventListener('visibilitychange', visible);
    void loop();
    return () => {
      active = false;
      clearTimeout(timer);
      poke.current = () => {};
      document.removeEventListener('visibilitychange', visible);
    };
  }, [session, enabled, adopt, forget]);

  /** Run one server call at a time; a 409 (someone moved first) refreshes at once. */
  const run = useCallback(async (work: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
      if ((e as ApiError).status === 409) poke.current();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, []);

  const create = (input: Record<string, unknown>) =>
    run(async () => {
      const result = await request<{ token: string; room: View }>('/rooms', { data: input });
      enter({ code: result.room.code, token: result.token }, result.room);
    });
  const join = (code: string, name: string) =>
    run(async () => {
      const result = await request<{ token: string; room: View }>(
        `/rooms/${code.trim().toUpperCase()}/join`,
        { data: { name } }
      );
      enter({ code: result.room.code, token: result.token }, result.room);
    });
  const resume = (seat: Session) =>
    run(async () => {
      enter(seat, await request<View>(`/rooms/${seat.code}`, { token: seat.token }));
    });
  const send = (path: 'start' | 'action', data: Record<string, unknown>) =>
    run(async () => {
      if (!session || !latest.current) return;
      adopt(
        await request<View>(`/rooms/${session.code}/${path}`, {
          token: session.token,
          data: { revision: latest.current.revision, ...data },
        })
      );
    });

  return {
    session,
    room,
    connected,
    busy,
    error,
    setError,
    run,
    forget,
    create,
    join,
    resume,
    start: () => send('start', {}),
    act: (action: Action) => send('action', { action }),
  };
}
