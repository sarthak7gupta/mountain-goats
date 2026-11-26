/* biome-ignore-all lint/suspicious/noArrayIndexKey: Seats, dice and board cells are fixed ordered slots. */
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import App from './App';
import AccountPanel from './components/AccountPanel';
import PublicRooms from './components/PublicRooms';
import { GameEngine } from './game';
import type { CellNumber, GameState, PlayerColor } from './models';
import type { Action, Expansions } from './multiplayer';
import { request, type ServerConfig, type User } from './platform/api';
import { useRoom } from './platform/useRoom';
import { useGoatHops } from './useGoatHops';
import './MultiplayerApp.css';

const key = 'mountain-goats-seat-v1';
const colors: Record<PlayerColor, string> = {
  black: '#293a35',
  white: '#ffffff',
  red: '#c34838',
  yellow: '#e7b746',
  green: '#437b54',
};
const loopback = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/;
/** Describe a goat location id such as `mountain:7`, `big:12` or `valley:0`. */
export function placeName(location: string, valley: { mountain: number }[] = []): string {
  const [kind, value] = location.split(':');
  if (kind === 'mountain') return `Goat on mountain ${value}`;
  if (kind === 'big') return `Big Mountain space ${value}`;
  return `Valley goat (from ${valley[Number(value)]?.mountain ?? '?'})`;
}
export default function MultiplayerApp() {
  const [offline, setOffline] = useState(false);
  const [name, setName] = useState('');
  const [invited] = useState(
    () => new URLSearchParams(location.search).get('room')?.toUpperCase() || ''
  );
  const [code, setCode] = useState(invited);
  const [capacity, setCapacity] = useState(4);
  const [publicRoom, setPublicRoom] = useState(false);
  const [bigMountain, setBig] = useState(false);
  const [greenValley, setValley] = useState(false);
  const [available, setAvailable] = useState(false);
  // Sync only once the server mode and account are known, so a 401 is read correctly.
  const [configured, setConfigured] = useState(false);
  const [serverMode, setServerMode] = useState('lan');
  const [login, setLogin] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [source, setSource] = useState('');
  const [recallTarget, setRecallTarget] = useState(5);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [notice, setNotice] = useState('');
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const {
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
    start,
    act: action,
  } = useRoom<GameState, Expansions, Action>({
    storageKey: key,
    enabled: configured && !offline,
    account: { login, user },
    onSignedOut: () => setUser(null),
  });
  useEffect(() => {
    request<ServerConfig>('/config')
      .then((config) => {
        setAvailable(true);
        setServerMode(config.mode);
        setLanUrls(Array.isArray(config.lanUrls) ? config.lanUrls : []);
        setLogin(config.login);
        if (!config.login) return null;
        return request<User | null>('/auth/me')
          .then((account) => {
            setUser(account);
            if (account) setName((old) => old || account.username);
          })
          .catch(() => setUser(null));
      })
      .catch(() => setAvailable(false))
      .finally(() => setConfigured(true));
  }, []);
  const game = room?.state ?? null;
  // Parse the engine once per snapshot, not on every render.
  const engine = useMemo(() => (game ? GameEngine.fromState(game) : null), [game]);
  const bonusPoints = useMemo(() => engine?.expansionScores() ?? [], [engine]);
  const myTurn = !!game && !game.gameOver && game.currentPlayerIndex === room?.you;
  const board = useRef<HTMLElement>(null);
  useGoatHops(board, room ? `${room.code}:${room.revision}` : null);
  useEffect(() => {
    // Tell a player in another tab or app that the game is waiting on them.
    if (offline || !myTurn) return;
    const previous = document.title;
    document.title = 'Your move · Mountain Goats';
    navigator.vibrate?.(120);
    return () => {
      document.title = previous;
    };
  }, [myTurn, offline]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  function enter(joining: boolean) {
    return joining
      ? join(code, name)
      : create({ name, capacity, bigMountain, greenValley, public: publicRoom });
  }
  function signedIn(account: User | null) {
    setUser(account);
    if (account) setName((old) => old || account.username);
    setError('');
  }
  async function signOut() {
    await run(async () => {
      await request('/auth/logout', { data: {} });
      setUser(null);
      forget();
    });
  }
  function leave() {
    if (
      !window.confirm(
        login && user
          ? 'Leave this room on this device? You can resume it later from your account.'
          : 'Leave this room on this browser? Your seat cannot be recovered after leaving.'
      )
    )
      return;
    forget();
  }
  if (offline)
    return (
      <>
        <nav className="return-online" aria-label="Game mode">
          <button onClick={() => setOffline(false)} type="button">
            ← Back to multiplayer
          </button>
        </nav>
        <App resume />
      </>
    );
  const accountPanel = (
    <AccountPanel
      user={user}
      onUser={signedIn}
      onResume={(summary) => void resume({ code: summary.code, token: summary.token })}
      onError={setError}
    />
  );
  const mine = !!game && game.currentPlayerIndex === room?.you && !game.gameOver;
  const canAct = mine && connected && !busy;
  const sum = engine?.getSelectedDiceSum() || 0;
  const locations = engine?.goatLocations() || [];
  const selectedSource = locations.includes(source) ? source : locations[0] || '';
  // Opened on the host itself: invite with an address other devices can reach.
  const inviteOrigin =
    loopback.test(location.hostname) && lanUrls[0] ? lanUrls[0] : location.origin;
  const invite = room ? `${inviteOrigin}${location.pathname}?room=${room.code}` : '';
  // One letter per goat, two when players share a first letter.
  const initials: Partial<Record<PlayerColor, string>> = {};
  for (const p of game?.players || []) {
    const first = p.name.trim().slice(0, 1).toUpperCase();
    const shared = game?.players.some(
      (o) => o !== p && o.name.trim().slice(0, 1).toUpperCase() === first
    );
    initials[p.color] = shared ? p.name.trim().slice(0, 2).toUpperCase() : first;
  }
  /** `place` (e.g. `red@7`) stays the same while a goat climbs one mountain, so it can hop. */
  function goat(color: PlayerColor, id: string, place?: string, step?: string) {
    const player = game?.players.find((p) => p.color === color);
    return (
      <span
        key={id}
        role="img"
        className="goat"
        data-goat={place}
        data-step={step}
        style={{ '--goat': colors[color] } as CSSProperties}
        title={player?.name}
        aria-label={player?.name}
      >
        {initials[color] || color.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <div className="expedition">
      <a className="skip" href="#play">
        Skip to game
      </a>
      <header className="expedition-header">
        <a href={location.pathname} className="brand">
          △{' '}
          <span>
            Mountain Goats<small>A little luck. A higher ambition.</small>
          </span>
        </a>
        <div className="header-links">
          {login && user && <span className="account-chip">Signed in as {user.username}</span>}
          {/* Outside a room the account panel has its own sign-in and sign-out controls. */}
          {login && user && session && (
            <button type="button" className="text-button" onClick={() => void signOut()}>
              Sign out
            </button>
          )}
          {login && !user && !room && <a href="#account">Sign in</a>}
          <button type="button" className="text-button" onClick={() => setOffline(true)}>
            Pass &amp; play
          </button>
          <a href="https://www.yucata.de/en/Rules/MountainGoats" target="_blank" rel="noreferrer">
            Rules ↗
          </a>
        </div>
      </header>
      {error && (
        <div role="alert" className="error">
          {error}
          <button type="button" onClick={() => setError('')} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {!session ? (
        <main id="play" className="welcome">
          <section className="intro">
            <p className="eyebrow">THE NEXT SUMMIT IS YOURS</p>
            <h1>
              Good friends.
              <br />
              Steep competition.
            </h1>
            <p>
              Climb six mountains, claim the summit, and send your friends back down. One shared
              board. A seat on every device.
            </p>
            <div className="landscape" aria-hidden="true">
              <span>△</span>
              <span>△</span>
              <span>△</span>
              <b>5 · 6 · 7 · 8 · 9 · 10</b>
            </div>
            <p>2–5 players · About 20 minutes</p>
            <button type="button" className="secondary" onClick={() => setOffline(true)}>
              Play pass-and-play on this device →
            </button>
          </section>
          <div className="welcome-side">
            {login && !user && accountPanel}
            <section className="panel">
              <p className="eyebrow">BASE CAMP</p>
              <h2>{invited ? `Join room ${invited}` : 'Gather your crew'}</h2>
              {invited && <p>You were invited to an expedition. Pick a name and join.</p>}
              {available && serverMode === 'online' && (
                <p>Play from anywhere. Create a private room and share its invite link.</p>
              )}
              {!available ? (
                <>
                  <p>
                    To host on your Wi-Fi, run these commands on a computer, then open the printed
                    network link on every device.
                  </p>
                  <pre>
                    pnpm install
                    <br />
                    pnpm build
                    <br />
                    pnpm host
                  </pre>
                  <p>
                    The host must stay on. Everyone must use the same network. Guest Wi-Fi may block
                    connections.
                  </p>
                  <label>
                    Host address
                    <input type="url" placeholder="http://192.168.1.10:3000" id="lan-address" />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const input = (document.getElementById('lan-address') as HTMLInputElement)
                        .value;
                      try {
                        const url = new URL(input);
                        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
                        location.assign(url.origin);
                      } catch {
                        setError('Enter a full http:// or https:// host address.');
                      }
                    }}
                  >
                    Open host
                  </button>
                </>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void enter(!!code.trim());
                  }}
                >
                  <label>
                    Your name
                    <input
                      required
                      maxLength={30}
                      autoComplete="nickname"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Trail name"
                    />
                  </label>
                  <label>
                    Room code <small>Leave empty to host</small>
                    <input
                      maxLength={12}
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="e.g. 8C2F4A9D1B30"
                    />
                  </label>
                  {!code && (
                    <>
                      <label>
                        Seats
                        <select
                          value={capacity}
                          onChange={(e) => setCapacity(Number(e.target.value))}
                        >
                          {[2, 3, 4, 5].map((n) => (
                            <option key={n}>{n}</option>
                          ))}
                        </select>
                      </label>
                      <fieldset>
                        <legend>Room options</legend>
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={publicRoom}
                            onChange={(e) => setPublicRoom(e.target.checked)}
                          />
                          Public room <small>Anyone can discover and join before starting</small>
                        </label>
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={bigMountain}
                            onChange={(e) => setBig(e.target.checked)}
                          />
                          Big Mountain <small>Claim spaces 11–24</small>
                        </label>
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={greenValley}
                            onChange={(e) => setValley(e.target.checked)}
                          />
                          Green Valley <small>Score from empty summits</small>
                        </label>
                      </fieldset>
                    </>
                  )}
                  <button disabled={busy || (login && !user)} type="submit">
                    {busy
                      ? 'Connecting…'
                      : login && !user
                        ? 'Sign in to continue'
                        : code
                          ? 'Join the expedition'
                          : 'Create a room'}{' '}
                    →
                  </button>
                </form>
              )}
            </section>
            {login && user && accountPanel}
          </div>
        </main>
      ) : !room ? (
        <main id="play" className="panel">
          <h1>Reconnecting to base camp…</h1>
          <p>
            {login && !user
              ? 'Sign in to the account that holds this seat.'
              : serverMode === 'online'
                ? 'Check your connection. Your seat is saved.'
                : 'Keep the host running and check your connection.'}
          </p>
          {login && !user && (
            <AccountPanel
              user={user}
              onUser={signedIn}
              onResume={(summary) => void resume({ code: summary.code, token: summary.token })}
              onError={setError}
            />
          )}
          <button type="button" onClick={leave}>
            Forget this seat
          </button>
        </main>
      ) : !game ? (
        <main id="play" className="lobby panel">
          <p className="eyebrow">ROOM {room.code}</p>
          <h1>Your expedition starts here.</h1>
          <p>Share this link. Everyone joins from their own device.</p>
          <label>
            Join link
            <input readOnly value={invite} onFocus={(e) => e.target.select()} />
          </label>
          <div className="invite-actions">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(invite)
                  .then(() => setNotice('Invite link copied.'))
                  .catch(() => setNotice('Select and copy the invite link above.'));
              }}
            >
              Copy invite link
            </button>
            {typeof navigator.share === 'function' && (
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  void navigator
                    .share({ title: 'Join my Mountain Goats room', url: invite })
                    .catch(() => {})
                }
              >
                Share…
              </button>
            )}
          </div>
          <ol className="seat-list">
            {Array.from({ length: room.capacity }, (_, i) => {
              const seat = room.seats[i];
              return seat ? (
                <li key={i}>
                  {seat.name} {i === room.you && '(you)'} {i === 0 && '· host'}
                </li>
              ) : (
                <li key={i} className="open-seat">
                  Open seat — waiting for a player
                </li>
              );
            })}
          </ol>
          <p>
            {room.seats.length}/{room.capacity} seats ·{' '}
            {room.options.bigMountain ? 'Big Mountain' : 'Base game'}{' '}
            {room.options.greenValley && '+ Green Valley'}
          </p>
          {room.you === 0 ? (
            <button
              type="button"
              disabled={busy || room.seats.length < 2 || !connected}
              onClick={() => void start()}
            >
              {room.seats.length < 2
                ? 'Waiting for another player…'
                : `Start with ${room.seats.length} players`}
            </button>
          ) : (
            <p>Waiting for the host to start…</p>
          )}
          <button type="button" className="text-button" onClick={leave}>
            Leave room
          </button>
        </main>
      ) : (
        <main id="play">
          <div className="turn-heading">
            <div>
              <p className="eyebrow">
                ROOM {room.code} · ROUND {game.currentTurn} ·{' '}
                {connected ? 'CONNECTED' : 'RECONNECTING'}
              </p>
              <h1>
                {game.gameOver
                  ? `${engine!
                      .getWinners()
                      .map((p) => p.name)
                      .join(' & ')} wins!`
                  : mine
                    ? 'Your move. Aim higher.'
                    : `${game.players[game.currentPlayerIndex].name} is climbing.`}
              </h1>
              <p>
                {game.gameOver
                  ? 'Final scores include expansion points.'
                  : game.gameEndTriggered
                    ? 'Final round — finish with equal turns.'
                    : 'Select dice to make a mountain number, then climb.'}
              </p>
            </div>
            <button className="text-button" type="button" onClick={leave}>
              Leave room
            </button>
          </div>
          <section className="scoreboard" aria-label="Players and scores">
            {game.players.map((player, i) => (
              <div
                key={player.color}
                className={i === game.currentPlayerIndex ? 'active-score' : ''}
              >
                {goat(player.color, player.color)}
                <span>
                  {player.name}
                  {i === room.you && ' · you'}
                  <small>
                    {[5, 6, 7, 8, 9, 10].map((m) => (
                      <span
                        key={m}
                        className={
                          game.pointTokens.some((t) => t.claimedBy === i && t.value === m)
                            ? 'collected'
                            : 'missing'
                        }
                      >
                        {m}{' '}
                      </span>
                    ))}
                  </small>
                </span>
                <strong>
                  {player.score}
                  <small>
                    points
                    {!game.gameOver && bonusPoints[i] > 0 ? ` + ${bonusPoints[i]} at end` : ''}
                  </small>
                </strong>
              </div>
            ))}
          </section>
          {game.gameOver && (
            <section className="panel results" aria-label="Final results">
              <h2>Final standings</h2>
              <ol>
                {game.players
                  .map((player, i) => ({ player, i }))
                  .sort((a, b) => b.player.score - a.player.score)
                  .map(({ player, i }) => (
                    <li key={player.color}>
                      {goat(player.color, `result-${player.color}`)}
                      <span>
                        {player.name}
                        {i === room.you && ' · you'}
                      </span>
                      <strong>{player.score} points</strong>
                    </li>
                  ))}
              </ol>
              <button type="button" onClick={() => forget()}>
                Back to base camp
              </button>
            </section>
          )}
          {!game.gameOver && (
            <section className="turn-panel panel" aria-label="Your turn controls">
              <fieldset disabled={!canAct}>
                <legend>{mine ? 'Build a dice group' : 'Watch the current turn'}</legend>
                <div className="dice-row">
                  {game.dice.map((die, i) => (
                    <div key={i}>
                      <button
                        type="button"
                        className={`network-die ${die.selected ? 'chosen' : ''}`}
                        aria-label={`Die ${i + 1}: ${die.value}${die.used ? ', used' : ''}`}
                        aria-pressed={!!die.selected}
                        disabled={!canAct || die.used}
                        onClick={() => void action({ type: 'select', index: i })}
                      >
                        {/* A new roll or changed value re-mounts the face, replaying its tumble. */}
                        <span
                          key={`${game.currentTurn}-${game.currentPlayerIndex}-${die.value}`}
                          className="network-die-face"
                        >
                          {die.value}
                        </span>
                        <small>{die.used ? 'used' : die.selected ? 'selected' : 'select'}</small>
                      </button>
                      {die.canChange && !die.used && (
                        <label className="die-edit">
                          Extra one
                          <select
                            aria-label={`Change die ${i + 1}`}
                            value={die.value}
                            onChange={(e) =>
                              void action({
                                type: 'change',
                                index: i,
                                value: Number(e.target.value),
                              })
                            }
                          >
                            <option value="1">Keep 1</option>
                            {[2, 3, 4, 5, 6].map((n) => (
                              <option key={n}>{n}</option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  ))}
                  <div className="sum">
                    <small>GROUP TOTAL</small>
                    <strong>{sum}</strong>
                  </div>
                </div>
                <p>Extra ones may be changed once before use. One original 1 always stays.</p>
                <div className="turn-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void action({ type: 'clear' })}
                  >
                    Clear group
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      game.dice.some((d) => !d.used)
                        ? setConfirmEnd(true)
                        : void action({ type: 'end' })
                    }
                  >
                    End turn →
                  </button>
                </div>
              </fieldset>
            </section>
          )}
          {confirmEnd && (
            <section
              className="panel confirm-end"
              role="alertdialog"
              aria-labelledby="confirm-end-title"
              aria-describedby="confirm-end-text"
            >
              <h2 id="confirm-end-title">Pass with unused dice?</h2>
              <p id="confirm-end-text">Any unused dice will be discarded.</p>
              <button
                type="button"
                // biome-ignore lint/a11y/noAutofocus: Move focus into the confirmation it opens.
                autoFocus
                disabled={!canAct}
                onClick={() => {
                  setConfirmEnd(false);
                  void action({ type: 'end' });
                }}
              >
                Pass turn
              </button>
              <button type="button" className="secondary" onClick={() => setConfirmEnd(false)}>
                Keep climbing
              </button>
            </section>
          )}
          <div className="board-scroll">
            <section className="network-board" aria-label="Six mountains" ref={board}>
              {[5, 6, 7, 8, 9, 10].map((m) => (
                <article key={m} className={`peak peak-${m}`}>
                  <header>
                    <strong>{m}</strong>
                    <small>
                      {(() => {
                        const left = game.pointTokens.filter(
                          (t) => t.available && t.value === m
                        ).length;
                        return `${left} token${left === 1 ? '' : 's'} left`;
                      })()}
                    </small>
                  </header>
                  <div className="peak-path">
                    {game.cells[m as CellNumber].map((cell, i) => (
                      <div key={i} className={`step ${cell.isTop ? 'summit' : ''}`}>
                        <small>
                          {cell.isTop ? 'SUMMIT' : `↑ ${game.cells[m as CellNumber].length - i}`}
                        </small>
                        <div>{cell.occupiedBy.map((c) => goat(c, c, `${c}@${m}`, String(i)))}</div>
                      </div>
                    ))}
                  </div>
                  <div className="foot">
                    {game.playerPieces[m as CellNumber].map((c) => goat(c, c, `${c}@${m}`, 'foot'))}
                  </div>
                  <button
                    type="button"
                    disabled={!canAct || sum !== m || !engine!.hasGoat(m)}
                    onClick={() => void action({ type: 'move', mountain: m })}
                  >
                    {sum === m && engine!.hasGoat(m) ? 'Climb ↑' : `Make ${m}`}
                  </button>
                </article>
              ))}
            </section>
          </div>
          <section className="panel bonuses">
            <h2>Complete a set. Claim a bonus.</h2>
            <p>One token from every mountain earns the highest remaining bonus.</p>
            {game.bonusTokens.map((t) => (
              <span key={t.value} className={!t.available ? 'claimed' : ''}>
                {t.value}
                {t.claimedBy !== undefined && <small>{game.players[t.claimedBy].name}</small>}
              </span>
            ))}
          </section>
          {(game.expansions?.bigMountain || game.expansions?.greenValley) && (
            <section className="panel">
              <h2>The scenic route</h2>
              <p>
                You have six goats. Choose which goat to move; moving it leaves its old mountain
                empty.
              </p>
              <label>
                Goat to relocate
                <select
                  disabled={!canAct}
                  value={selectedSource}
                  onChange={(e) => setSource(e.target.value)}
                >
                  {locations.map((l) => (
                    <option key={l} value={l}>
                      {placeName(l, game.valley)}
                    </option>
                  ))}
                </select>
              </label>
              {game.expansions.bigMountain && (
                <>
                  <h3>Big Mountain</h3>
                  <p>
                    Highest occupied spaces score{' '}
                    {game.numPlayers === 2
                      ? '12 / 8 / 4'
                      : game.numPlayers === 3
                        ? '16 / 12 / 8 / 4'
                        : '15 / 12 / 9 / 6 / 3'}{' '}
                    points at the end.
                  </p>
                  <div className="big-spaces">
                    {Array.from({ length: 14 }, (_, i) => i + 11).map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={
                          !canAct || sum !== n || !!game.bigMountain?.[n] || !selectedSource
                        }
                        onClick={() =>
                          void action({ type: 'big', target: n, source: selectedSource })
                        }
                      >
                        {n}
                        {game.bigMountain?.[n] && goat(game.bigMountain[n], `big-${n}`)}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {game.expansions.greenValley && (
                <>
                  <h3>Green Valley</h3>
                  <p>
                    Empty summits send goats here: 5–6 → 3 points, 7–8 → 4, 9–10 → 5. Scores are
                    added at game end.
                  </p>
                  <div className="valley-goats">
                    {game.valley?.map((g, i) => (
                      <span key={i}>
                        {goat(g.color, `valley-${i}`)} from {g.mountain}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {(game.expansions.greenValley || game.expansions.bigMountain) && (
                <>
                  <label>
                    Return goat to an empty mountain foot
                    <select
                      disabled={!canAct}
                      value={recallTarget}
                      onChange={(e) => setRecallTarget(Number(e.target.value))}
                    >
                      {[5, 6, 7, 8, 9, 10].map((m) => (
                        <option key={m} disabled={engine!.hasGoat(m)}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={!canAct || engine!.hasGoat(recallTarget) || !selectedSource}
                    onClick={() =>
                      void action({
                        type: 'redeploy',
                        mountain: recallTarget,
                        source: selectedSource,
                      })
                    }
                  >
                    Redeploy goat
                  </button>
                </>
              )}
            </section>
          )}
          <details className="panel">
            <summary>Trail journal · last {Math.min(20, game.gameLog.length)} events</summary>
            <ul className="journal">
              {game.gameLog
                .slice(-20)
                .reverse()
                .map((entry, i) => (
                  <li key={i}>
                    Round {entry.turn} · {entry.action}
                  </li>
                ))}
            </ul>
          </details>
        </main>
      )}
      {!session && available && <PublicRooms onJoin={setCode} requiresLogin={login} />}
      <footer>Mountain Goats · A game by Stefan Risthaus · Unofficial fan implementation</footer>
    </div>
  );
}
