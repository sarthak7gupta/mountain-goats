import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MultiplayerApp from './MultiplayerApp';

const seatKey = 'mountain-goats-seat-v1';
const lobby = {
  code: 'ABC123',
  revision: 0,
  seats: [{ name: 'Host' }],
  capacity: 2,
  expansions: { bigMountain: false, greenValley: false },
  game: null,
  you: 0,
};

type Route = (init?: RequestInit) => { status?: number; body: unknown };
function stubServer(routes: Record<string, Route>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url).replace(/^\/api/, '');
    const route = routes[`${init?.method ?? 'GET'} ${path}`];
    const { status = 200, body } = route
      ? route(init)
      : { status: 404, body: { error: 'Not found.' } };
    return { ok: status < 400, status, json: async () => body };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, '', '/');
});
afterEach(() => vi.unstubAllGlobals());

it('asks for an account before creating a room when the server requires login', async () => {
  stubServer({
    'GET /config': () => ({ body: { mode: 'online', login: true } }),
    'GET /auth/me': () => ({ body: null }),
    'GET /rooms': () => ({ body: [] }),
  });
  render(<MultiplayerApp />);
  const submit = await screen.findByRole('button', { name: /Sign in to continue/ });
  expect(submit).toBeDisabled();
  expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  expect(screen.getByText(/Sign in to claim a seat in a public room/)).toBeInTheDocument();
});

it('forgets a saved seat that belongs to another account', async () => {
  localStorage.setItem(seatKey, JSON.stringify({ code: 'ABC123', token: 'other' }));
  stubServer({
    'GET /config': () => ({ body: { mode: 'online', login: true } }),
    'GET /auth/me': () => ({ body: { id: 2, username: 'second' } }),
    'GET /my-rooms': () => ({ body: [] }),
    'GET /rooms': () => ({ body: [] }),
    'GET /rooms/ABC123': () => ({
      status: 403,
      body: { error: 'This seat belongs to another account.' },
    }),
  });
  render(<MultiplayerApp />);
  expect(await screen.findByRole('alert')).toHaveTextContent('another account');
  await screen.findByRole('heading', { name: 'Hello, second' });
  expect(localStorage.getItem(seatKey)).toBeNull();
});

it('offers sign-in on the reconnect screen and resumes the saved seat afterwards', async () => {
  localStorage.setItem(seatKey, JSON.stringify({ code: 'ABC123', token: 'mine' }));
  let signedIn = false;
  stubServer({
    'GET /config': () => ({ body: { mode: 'online', login: true } }),
    'GET /auth/me': () => ({ body: null }),
    'GET /my-rooms': () => ({ body: [] }),
    'POST /auth/login': () => {
      signedIn = true;
      return { body: { id: 1, username: 'goat' } };
    },
    'GET /rooms/ABC123': () =>
      signedIn ? { body: lobby } : { status: 401, body: { error: 'Sign in to play online.' } },
  });
  render(<MultiplayerApp />);
  expect(
    await screen.findByText('Sign in to the account that holds this seat.')
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'goat' } });
  fireEvent.change(screen.getByLabelText(/Password/), {
    target: { value: 'correct-horse-battery' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('heading', { name: 'Your expedition starts here.' }, { timeout: 3000 });
  expect(screen.queryByRole('alert')).toBeNull();
});

it('drops the seat on this device when signing out', async () => {
  localStorage.setItem(seatKey, JSON.stringify({ code: 'ABC123', token: 'mine' }));
  stubServer({
    'GET /config': () => ({ body: { mode: 'online', login: true } }),
    'GET /auth/me': () => ({ body: { id: 1, username: 'goat' } }),
    'GET /my-rooms': () => ({ body: [] }),
    'GET /rooms': () => ({ body: [] }),
    'GET /rooms/ABC123': () => ({ body: lobby }),
    'POST /auth/logout': () => ({ body: { ok: true } }),
  });
  render(<MultiplayerApp />);
  await screen.findByRole('heading', { name: 'Your expedition starts here.' });
  fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
  await screen.findByRole('heading', { name: 'Sign in' });
  await waitFor(() => expect(localStorage.getItem(seatKey)).toBeNull());
});

it('allows switching to local pass-and-play and back without signing in', async () => {
  stubServer({
    'GET /config': () => ({ body: { mode: 'online', login: true } }),
    'GET /auth/me': () => ({ body: null }),
    'GET /rooms': () => ({ body: [] }),
  });
  render(<MultiplayerApp />);
  await screen.findByRole('heading', { name: 'Sign in' });
  fireEvent.click(screen.getByRole('button', { name: /Play pass-and-play on this device/ }));
  expect(await screen.findByRole('heading', { name: 'Player Setup' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '← Back to multiplayer' }));
  expect(await screen.findByRole('heading', { name: 'Gather your crew' })).toBeInTheDocument();
});
