import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GameEngine } from '../game';
import DiceWidget from './DiceWidget';

describe('DiceWidget', () => {
  it('should render dice', () => {
    const game = new GameEngine(2, 10, 10, ['Player 1', 'Player 2']);
    const { container } = render(<DiceWidget gameEngine={game} />);
    const dice = container.querySelectorAll('.die');
    expect(dice).toHaveLength(4);
  });

  it('should display dice values', () => {
    const game = new GameEngine(2, 10, 10, ['Player 1', 'Player 2']);
    game.rollDice();
    render(<DiceWidget gameEngine={game} />);

    // Check that dice faces are rendered
    const dieFaces = screen.getAllByRole('button', { name: /die/i });
    expect(dieFaces.length).toBeGreaterThan(0);
  });

  it('should allow selecting dice', async () => {
    const user = userEvent.setup();
    const game = new GameEngine(2, 10, 10, ['Player 1', 'Player 2']);
    game.rollDice();
    const forceUpdate = vi.fn();

    render(<DiceWidget gameEngine={game} forceUpdate={forceUpdate} />);

    const dice = screen.getAllByRole('button', { name: /die/i });
    const firstDie = dice[0];

    await user.click(firstDie);
    expect(forceUpdate).toHaveBeenCalled();
  });

  it('should show change controls when die can be changed', async () => {
    const user = userEvent.setup();
    const game = new GameEngine(2, 10, 10, ['Player 1', 'Player 2']);
    // Set multiple 1s and mark them as changeable (simulating rollDice behavior)
    game.state.dice.forEach((die, index) => {
      die.value = 1;
      die.locked = false;
      // Mark all but first "1" as changeable (simulating rollDice logic)
      if (index > 0) {
        die.canChange = true;
      }
    });

    render(<DiceWidget gameEngine={game} />);

    // Find a die that can be changed (aria-label includes "Can change value")
    // There may be multiple, so get all and use the first one
    const changeableDice = screen.getAllByRole('button', { name: /Can change value/i });
    expect(changeableDice.length).toBeGreaterThan(0);
    await user.click(changeableDice[0]);

    // Should show change controls
    const changeButtons = screen.getAllByRole('button', { name: /changed die/i });
    expect(changeButtons.length).toBeGreaterThan(0);
  });

  it('should display notice when multiple 1s are rolled', () => {
    const game = new GameEngine(2, 10, 10, ['Player 1', 'Player 2']);
    game.state.dice.forEach((die) => {
      die.value = 1;
      die.canChange = true;
    });

    render(<DiceWidget gameEngine={game} />);

    expect(screen.getByText(/multiple 1s rolled/i)).toBeInTheDocument();
  });

  it('should have proper ARIA labels', () => {
    const game = new GameEngine(2, 10, 10, ['Player 1', 'Player 2']);
    game.rollDice();

    render(<DiceWidget gameEngine={game} />);

    const dice = screen.getAllByRole('button', { name: /die/i });
    expect(dice.length).toBeGreaterThan(0);
    dice.forEach((die) => {
      expect(die).toHaveAttribute('aria-label');
    });
  });
});
