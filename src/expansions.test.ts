import { describe, expect, it } from 'vitest';
import { GameEngine } from './game';
import { type CellNumber, PlayerColor } from './models';

function setup(count = 2) {
  const e = new GameEngine(count);
  e.configureExpansions({ bigMountain: true, greenValley: true });
  return e;
}
function dice(e: GameEngine, values: number[]) {
  e.state.dice = values.map((value) => ({ value, locked: false, selected: true }));
}
function summit(e: GameEngine, m: CellNumber) {
  e.state.playerPieces[m] = e.state.playerPieces[m].filter((c) => c !== e.getCurrentPlayer().color);
  e.state.cells[m][0].occupiedBy = [e.getCurrentPlayer().color];
}
describe('expansion rules and final round', () => {
  it('moves one of exactly six goats to a free Big Mountain space; cannot conjure a missing goat', () => {
    const e = setup();
    dice(e, [6, 5]);
    expect(e.moveToBigMountain(11, 'mountain:5')).toBe(true);
    expect(e.goatLocations()).toHaveLength(6);
    expect(e.hasGoat(5)).toBe(false);
    dice(e, [5]);
    expect(e.moveGoatUpMountain(5)).toBe(false);
    expect(e.redeployGoat('big:11', 5)).toBe(true);
    expect(e.goatLocations()).toHaveLength(6);
    expect(e.state.bigMountain![11]).toBeUndefined();
  });
  it('rejects occupied Big Mountain spaces and invalid source without consuming dice', () => {
    const e = setup();
    e.state.bigMountain![12] = PlayerColor.WHITE;
    dice(e, [6, 6]);
    expect(e.moveToBigMountain(12, 'mountain:5')).toBe(false);
    expect(e.state.dice.some((d) => d.used)).toBe(false);
    expect(e.goatLocations()).toHaveLength(6);
    expect(e.moveToBigMountain(12, 'fake')).toBe(false);
  });
  it.each([2, 3, 4, 5])(
    'ranks individual goats including multiple goats per player with %i players',
    (count) => {
      const e = setup(count);
      e.state.bigMountain = { 24: PlayerColor.BLACK, 23: PlayerColor.WHITE, 22: PlayerColor.BLACK };
      expect(e.expansionScores()[0]).toBe(count === 2 ? 16 : count === 3 ? 24 : 24);
      expect(e.expansionScores()[1]).toBe(count === 2 ? 8 : 12);
      expect(e.state.pointTokens.filter((t) => t.value === 5)).toHaveLength(
        count === 2 ? 10 : count === 3 ? 11 : 12
      );
    }
  );
  it.each([5, 6, 7, 8, 9, 10])(
    'moves an exhausted summit goat to valley %i and permits redeployment',
    (m) => {
      const e = setup();
      summit(e, m);
      e.state.pointTokens = e.state.pointTokens.filter((t) => t.value !== m);
      dice(e, m <= 6 ? [m] : [4, m - 4]);
      expect(e.moveGoatUpMountain(m)).toBe(true);
      expect(e.state.valley).toEqual([{ color: PlayerColor.BLACK, mountain: m }]);
      expect(e.hasGoat(m)).toBe(false);
      expect(e.expansionScores()[0]).toBe(Math.ceil(m / 2));
      expect(e.goatLocations()).toHaveLength(6);
      expect(e.redeployGoat('valley:0', m)).toBe(true);
      expect(e.expansionScores()[0]).toBe(0);
    }
  );
  it('keeps the last token claimant on summit, then enters valley on next matching group', () => {
    const e = setup();
    summit(e, 5);
    e.state.pointTokens = e.state.pointTokens
      .filter((t) => t.value !== 5)
      .concat([{ value: 5, available: true }]);
    dice(e, [5]);
    expect(e.moveGoatUpMountain(5)).toBe(true);
    expect(e.state.valley).toHaveLength(0);
    dice(e, [5]);
    expect(e.moveGoatUpMountain(5)).toBe(true);
    expect(e.state.valley).toHaveLength(1);
  });
  it('ends immediately after the last player when the trigger first occurs on their turn', () => {
    const e = setup();
    e.state.currentPlayerIndex = 1;
    e.state.bonusTokens.forEach((t) => {
      t.available = false;
    });
    e.state.bigMountain = { 24: PlayerColor.BLACK };
    e.nextTurn();
    expect(e.state.gameOver).toBe(true);
    expect(e.state.players[0].score).toBe(12);
    e.nextTurn();
    expect(e.state.players[0].score).toBe(12);
  });
  it('finishes only the remaining players of the current round', () => {
    const e = setup(3);
    e.state.bonusTokens.forEach((t) => {
      t.available = false;
    });
    e.nextTurn();
    expect(e.state.gameOver).toBe(false);
    expect(e.state.currentPlayerIndex).toBe(1);
    e.nextTurn();
    expect(e.state.gameOver).toBe(false);
    e.nextTurn();
    expect(e.state.gameOver).toBe(true);
  });
  it('permits retaining an extra one but rejects fractional faces and used-die changes', () => {
    const e = setup();
    e.state.dice[1] = { value: 1, canChange: true, locked: false };
    e.changeDieValue(1, 2.5);
    expect(e.state.dice[1].canChange).toBe(true);
    e.changeDieValue(1, 1);
    expect(e.state.dice[1].canChange).toBe(false);
    e.state.dice[1].canChange = true;
    e.state.dice[1].used = true;
    e.changeDieValue(1, 6);
    expect(e.state.dice[1].value).toBe(1);
  });
});
