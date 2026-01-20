import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GameEngine } from '../game';
import { CellNumber } from '../models';
import MountainColumn from './MountainColumn';

describe('MountainColumn', () => {
  it('should render mountain column', () => {
    const game = new GameEngine(2, 10, 10, ['Player 1', 'Player 2']);
    render(<MountainColumn gameEngine={game} cellNumber={CellNumber.FIVE} forceUpdate={vi.fn()} />);

    expect(screen.getByLabelText(/^Mountain 5$/)).toBeInTheDocument();
  });

  it('should display point tokens', () => {
    const game = new GameEngine(2, 10, 10, ['Player 1', 'Player 2']);
    render(<MountainColumn gameEngine={game} cellNumber={CellNumber.FIVE} forceUpdate={vi.fn()} />);

    const token = screen.getByLabelText(/token 5/i);
    expect(token).toBeInTheDocument();
  });

  it('should display player goats at foot', () => {
    const game = new GameEngine(2, 10, 10, ['Player 1', 'Player 2']);
    render(<MountainColumn gameEngine={game} cellNumber={CellNumber.FIVE} forceUpdate={vi.fn()} />);

    const goats = screen.getAllByLabelText(/goat/i);
    expect(goats.length).toBeGreaterThan(0);
  });

  it('should allow moving goat when valid target', async () => {
    const user = userEvent.setup();
    const game = new GameEngine(2, 10, 10, ['Player 1', 'Player 2']);
    const forceUpdate = vi.fn();

    // Set up dice to sum to 5
    game.state.dice[0].selected = true;
    game.state.dice[0].value = 5;

    render(
      <MountainColumn gameEngine={game} cellNumber={CellNumber.FIVE} forceUpdate={forceUpdate} />
    );

    // Find clickable goat (the aria-label includes the full text with mountain number)
    const goat = screen.getByRole('button', {
      name: /Click your goat on a valid mountain to move up 5/i,
    });
    await user.click(goat);

    expect(forceUpdate).toHaveBeenCalled();
  });

  it('should show valid target indicator when sum matches', () => {
    const game = new GameEngine(2, 10, 10, ['Player 1', 'Player 2']);
    game.state.dice[0].selected = true;
    game.state.dice[0].value = 5;

    render(<MountainColumn gameEngine={game} cellNumber={CellNumber.FIVE} forceUpdate={vi.fn()} />);

    // There are multiple elements with "valid target" text, so use getAllByLabelText and check first one
    const indicators = screen.getAllByLabelText(/^Valid target$/);
    expect(indicators.length).toBeGreaterThan(0);
  });
});
