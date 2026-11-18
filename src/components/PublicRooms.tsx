import { useEffect, useState } from 'react';

interface Listing {
  code: string;
  players: number;
  capacity: number;
  expansions: { bigMountain: boolean; greenValley: boolean };
}
export default function PublicRooms({
  onJoin,
  requiresLogin = false,
}: {
  onJoin: (code: string) => void;
  requiresLogin?: boolean;
}) {
  const [rooms, setRooms] = useState<Listing[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const response = await fetch('/api/rooms', { signal: AbortSignal.timeout(10000) });
        if (!response.ok)
          throw new Error('Room list unavailable. You can still use an invite code.');
        const list = await response.json();
        if (active) {
          setRooms(list);
          setError('');
        }
      } catch {
        if (active) setError('Room list unavailable. You can still use an invite code.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <section className="panel" aria-label="Public rooms">
      <p className="eyebrow">FIND YOUR NEXT CREW</p>
      <h2>Open expeditions</h2>
      <p>
        {requiresLogin
          ? 'Sign in to claim a seat in a public room. Your seat follows your account to every device.'
          : 'Join a public room as a guest. Enter your name above, choose a room, then join.'}
      </p>
      {loading ? (
        <p role="status">Looking for open rooms…</p>
      ) : error ? (
        <p role="status">{error}</p>
      ) : !rooms.length ? (
        <p>No open expeditions yet. Create a public room and lead the way.</p>
      ) : (
        <ul className="public-rooms">
          {rooms.map((room) => (
            <li key={room.code}>
              <div>
                <strong>Room {room.code}</strong>
                <small>
                  {room.players}/{room.capacity} players ·{' '}
                  {room.expansions.bigMountain ? 'Big Mountain' : 'Base game'}
                  {room.expansions.greenValley && ' + Green Valley'}
                </small>
              </div>
              <button
                type="button"
                onClick={() => {
                  onJoin(room.code);
                  document.querySelector('form')?.scrollIntoView?.({ behavior: 'smooth' });
                }}
              >
                Choose room {room.code}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
