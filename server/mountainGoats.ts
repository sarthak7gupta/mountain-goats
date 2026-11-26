import { GameEngine } from '../src/game';
import type { CellNumber, GameState } from '../src/models';
import type { Action, Expansions } from '../src/multiplayer';
import { type GameDefinition, RoomError } from './platform';

export type { Expansions };

/** Mountain Goats rules for the multiplayer platform. Every action is untrusted input. */
export const mountainGoats: GameDefinition<GameState, Expansions> = {
  name: 'Mountain Goats',
  minPlayers: 2,
  maxPlayers: 5,
  options: (input) => ({
    bigMountain: input.bigMountain === true,
    greenValley: input.greenValley === true,
  }),
  setup(players, options, random) {
    const engine = new GameEngine(players.length, 10, 10, players);
    engine.configureExpansions(options);
    engine.rollDice(() => random.int(1, 7));
    return engine.state;
  },
  activeSeats: (state) => (state.gameOver ? [] : [state.currentPlayerIndex]),
  isOver: (state) => state.gameOver,
  apply(state, _seat, raw, random) {
    const a = raw as Action;
    const engine = GameEngine.fromState(state);
    const die = Number.isInteger((a as { index?: number }).index)
      ? state.dice[(a as { index: number }).index]
      : undefined;
    let ok = true;
    switch (a.type) {
      case 'select':
        if (!die || die.used) ok = false;
        else engine.toggleDieSelection(a.index);
        break;
      case 'change':
        if (!die || !die.canChange || die.used || !Number.isInteger(a.value) || a.value < 1 || a.value > 6)
          ok = false;
        else engine.changeDieValue(a.index, a.value);
        break;
      case 'clear':
        // Clearing an empty group changes nothing: no new revision, no write.
        if (!state.dice.some((d) => d.selected)) return null;
        engine.clearDiceSelection();
        break;
      case 'move':
        ok = engine.moveGoatUpMountain(a.mountain as CellNumber);
        break;
      case 'big':
        ok = typeof a.source === 'string' && engine.moveToBigMountain(a.target, a.source);
        break;
      case 'redeploy':
        ok = typeof a.source === 'string' && engine.redeployGoat(a.source, a.mountain as CellNumber);
        break;
      case 'end':
        engine.nextTurn(() => random.int(1, 7));
        break;
      default:
        ok = false;
    }
    if (!ok) throw new RoomError('That action is not available.');
    // Keep stored and network snapshots bounded during long games.
    engine.state.gameLog = engine.state.gameLog.slice(-200);
    return engine.state;
  },
};
