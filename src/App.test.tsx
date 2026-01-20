import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

describe('App', () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
  });

  it('should show player setup initially', () => {
    render(<App />);
    expect(screen.getByText(/player setup/i)).toBeInTheDocument();
  });

  it('should start game after player setup', async () => {
    const user = userEvent.setup();
    render(<App />);

    const startButton = screen.getByRole('button', { name: /start game/i });
    await user.click(startButton);

    await waitFor(() => {
      expect(screen.getByText(/mountain goats/i)).toBeInTheDocument();
    });
  });

  it('should open help modal', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Start game first
    const startButton = screen.getByRole('button', { name: /start game/i });
    await user.click(startButton);

    await waitFor(() => {
      const helpButton = screen.getByRole('button', { name: /help/i });
      expect(helpButton).toBeInTheDocument();
    });

    const helpButton = screen.getByRole('button', { name: /help/i });
    await user.click(helpButton);

    await waitFor(() => {
      expect(screen.getByText(/game rules/i)).toBeInTheDocument();
    });
  });

  it('should open shortcuts modal with keyboard shortcut', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Start game first
    const startButton = screen.getByRole('button', { name: /start game/i });
    await user.click(startButton);

    await waitFor(() => {
      // Press Cmd+/ to open shortcuts
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: '/',
          metaKey: true,
          bubbles: true,
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument();
    });
  });

  it('should advance turn with next turn button', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Start game
    const startButton = screen.getByRole('button', { name: /start game/i });
    await user.click(startButton);

    await waitFor(() => {
      const nextTurnButton = screen.getByRole('button', { name: /next turn/i });
      expect(nextTurnButton).toBeInTheDocument();
    });

    const nextTurnButton = screen.getByRole('button', { name: /next turn/i });
    await user.click(nextTurnButton);

    // Game should still be running
    expect(screen.getByText(/mountain goats/i)).toBeInTheDocument();
  });
});
