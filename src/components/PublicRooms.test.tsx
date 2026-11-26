import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PublicRooms from './PublicRooms';

afterEach(() => vi.unstubAllGlobals());
it('shows open guest rooms and chooses the invitation code', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          code: 'ABC123',
          players: 1,
          capacity: 4,
          expansions: { bigMountain: true, greenValley: false },
        },
      ],
    })
  );
  const join = vi.fn();
  render(<PublicRooms onJoin={join} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Choose room ABC123' }));
  expect(join).toHaveBeenCalledWith('ABC123');
});
it('shows empty and failure states', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  render(<PublicRooms onJoin={() => {}} />);
  expect(await screen.findByText(/Room list unavailable/)).toBeInTheDocument();
});
