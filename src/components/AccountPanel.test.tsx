import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AccountPanel from './AccountPanel';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ({
    ok: true,
    status: 200,
    json: async () => handler(url, init),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

it('signs in with a username and password', async () => {
  const fetchMock = stubFetch((url) => {
    if (url.endsWith('/api/auth/login')) return { id: 7, username: 'goat' };
    return [];
  });
  const onUser = vi.fn();
  render(<AccountPanel user={null} onUser={onUser} onResume={() => {}} onError={() => {}} />);
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'goat' } });
  fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'correct-horse' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => expect(onUser).toHaveBeenCalledWith({ id: 7, username: 'goat' }));
  const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/auth/login'));
  expect(call).toBeTruthy();
  expect(JSON.parse(String((call?.[1] as RequestInit)?.body))).toEqual({
    username: 'goat',
    password: 'correct-horse',
  });
});

it('creates an account and reports the failure of a bad password', async () => {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: false,
    status: 401,
    json: async () => ({ error: 'Username or password is incorrect.' }),
  }));
  vi.stubGlobal('fetch', fetchMock);
  const onError = vi.fn();
  render(<AccountPanel user={null} onUser={() => {}} onResume={() => {}} onError={onError} />);
  fireEvent.click(screen.getByRole('button', { name: /Need an account/ }));
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'goat' } });
  fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'correct-horse' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  await waitFor(() => expect(onError).toHaveBeenCalledWith('Username or password is incorrect.'));
  const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/auth/register'));
  expect(call).toBeTruthy();
});

it('lists the rooms of a signed in player and resumes one', async () => {
  stubFetch((url) => {
    if (url.endsWith('/api/my-rooms'))
      return [{ code: 'ABC123', token: 'seat-token', started: true, finished: false }];
    return [];
  });
  const onResume = vi.fn();
  render(
    <AccountPanel
      user={{ id: 3, username: 'goat' }}
      onUser={() => {}}
      onResume={onResume}
      onError={() => {}}
    />
  );
  expect(await screen.findByText('Hello, goat')).toBeInTheDocument();
  expect(await screen.findByText('In progress')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Resume room ABC123' }));
  expect(onResume).toHaveBeenCalledWith({
    code: 'ABC123',
    token: 'seat-token',
    started: true,
    finished: false,
  });
});

it('signs out', async () => {
  const fetchMock = stubFetch(() => ({ ok: true }));
  const onUser = vi.fn();
  render(
    <AccountPanel
      user={{ id: 3, username: 'goat' }}
      onUser={onUser}
      onResume={() => {}}
      onError={() => {}}
    />
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(onUser).toHaveBeenCalledWith(null));
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/auth/logout'))).toBe(true);
});
