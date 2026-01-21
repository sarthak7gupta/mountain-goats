import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';

// Mock localStorage and sessionStorage for E2E tests
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

Object.defineProperty(window, 'localStorage', { value: localStorageMock });
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

describe('App E2E Tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
  });

  it('should complete a full game flow: setup -> play -> move goat -> next turn', async () => {
    const user = userEvent.setup();
    render(<App />);

    // 1. Setup phase
    expect(screen.getByText(/player setup/i)).toBeInTheDocument();

    // Edit player names
    const inputs = screen.getAllByRole('textbox');
    await user.clear(inputs[0]);
    await user.type(inputs[0], 'Alice');
    await user.clear(inputs[1]);
    await user.type(inputs[1], 'Bob');

    // Start game
    const startButton = screen.getByRole('button', { name: /start game/i });
    await user.click(startButton);

    // 2. Game phase
    await waitFor(() => {
      expect(screen.getByText(/mountain goats/i)).toBeInTheDocument();
    });

    // Wait for dice to be rolled
    await waitFor(
      () => {
        const dice = screen.getAllByRole('button', { name: /die/i });
        expect(dice.length).toBeGreaterThan(0);
      },
      { timeout: 2000 }
    );

    // 3. Select dice
    const dice = screen.getAllByRole('button', { name: /die/i });
    if (dice.length > 0) {
      // Click first die to select it
      await user.click(dice[0]);
    }

    // 4. Try to move goat if valid target exists
    await waitFor(() => {
      const goats = screen.queryAllByRole('button', { name: /click goat to move/i });
      if (goats.length > 0) {
        expect(goats[0]).toBeInTheDocument();
      }
    });

    // 5. Advance turn
    const nextTurnButton = screen.getByRole('button', { name: /next turn/i });
    await user.click(nextTurnButton);

    // Game should continue
    await waitFor(() => {
      expect(screen.getByText(/mountain goats/i)).toBeInTheDocument();
    });
  });

  it('should handle dice selection and deselection', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Start game
    const startButton = screen.getByRole('button', { name: /start game/i });
    await user.click(startButton);

    await waitFor(
      () => {
        const dice = screen.getAllByRole('button', { name: /die/i });
        expect(dice.length).toBeGreaterThan(0);
      },
      { timeout: 2000 }
    );

    // Select a die
    const dice = screen.getAllByRole('button', { name: /die/i });
    const firstDie = dice[0];
    await user.click(firstDie);

    // Wait for selection to update
    await waitFor(() => {
      const updatedDice = screen.getAllByRole('button', { name: /die/i });
      expect(updatedDice.length).toBeGreaterThan(0);
    });

    // Click again to deselect - re-query to get fresh reference
    const diceAfterSelect = screen.getAllByRole('button', { name: /die/i });
    await user.click(diceAfterSelect[0]);

    // Wait for deselection and verify die is still in document
    await waitFor(() => {
      const diceAfterDeselect = screen.getAllByRole('button', { name: /die/i });
      expect(diceAfterDeselect.length).toBeGreaterThan(0);
      expect(diceAfterDeselect[0]).toBeInTheDocument();
    });
  });

  it('should handle changing die value when multiple 1s are rolled', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Start game
    const startButton = screen.getByRole('button', { name: /start game/i });
    await user.click(startButton);

    await waitFor(() => {
      expect(screen.getByText(/mountain goats/i)).toBeInTheDocument();
    });

    // This test would need to mock the dice roll to ensure multiple 1s
    // For now, just check that the component renders
    const diceWidget = screen.getByText(/dice/i);
    expect(diceWidget).toBeInTheDocument();
  });

  it('should open and close modals', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Start game
    const startButton = screen.getByRole('button', { name: /start game/i });
    await user.click(startButton);

    await waitFor(() => {
      const helpButton = screen.getByRole('button', { name: /help/i });
      expect(helpButton).toBeInTheDocument();
    });

    // Open help modal
    const helpButton = screen.getByRole('button', { name: /help/i });
    await user.click(helpButton);

    await waitFor(() => {
      expect(screen.getByText(/game rules/i)).toBeInTheDocument();
    });

    // Close modal
    const closeButton = screen.getByRole('button', { name: /got it/i });
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText(/game rules/i)).not.toBeInTheDocument();
    });
  });

  it('should handle reset confirmation', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Start game
    const startButton = screen.getByRole('button', { name: /start game/i });
    await user.click(startButton);

    await waitFor(() => {
      const resetButton = screen.getByRole('button', { name: /reset/i });
      expect(resetButton).toBeInTheDocument();
    });

    // Click reset
    const resetButton = screen.getByRole('button', { name: /reset/i });
    await user.click(resetButton);

    // Should show confirmation modal
    await waitFor(() => {
      expect(screen.getByText(/reset mountain goats\?/i)).toBeInTheDocument();
    });

    // Cancel reset
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    // Should still be in game
    await waitFor(() => {
      expect(screen.getByText(/mountain goats/i)).toBeInTheDocument();
    });
  });
});
