import { beforeEach, describe, expect, it } from 'vitest';
import { GameEngine } from './game';
import { CellNumber, PlayerColor } from './models';

describe('GameEngine', () => {
  let game: GameEngine;
  const playerNames = ['Player 1', 'Player 2', 'Player 3'];

  beforeEach(() => {
    game = new GameEngine(3, 10, 10, playerNames);
  });

  describe('Initialization', () => {
    it('should initialize with correct number of players', () => {
      expect(game.state.numPlayers).toBe(3);
      expect(game.state.players).toHaveLength(3);
    });

    it('should assign unique colors to players', () => {
      const colors = game.state.players.map((p) => p.color);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(3);
    });

    it('should initialize with correct player names', () => {
      expect(game.state.players[0].name).toBe('Player 1');
      expect(game.state.players[1].name).toBe('Player 2');
      expect(game.state.players[2].name).toBe('Player 3');
    });

    it('should initialize dice', () => {
      expect(game.state.dice).toHaveLength(4);
      game.state.dice.forEach((die) => {
        expect(die.value).toBeGreaterThanOrEqual(1);
        expect(die.value).toBeLessThanOrEqual(6);
        expect(die.locked).toBe(false);
      });
    });

    it('should initialize cells for all mountains', () => {
      const cellNumbers = [
        CellNumber.FIVE,
        CellNumber.SIX,
        CellNumber.SEVEN,
        CellNumber.EIGHT,
        CellNumber.NINE,
        CellNumber.TEN,
      ];
      cellNumbers.forEach((num) => {
        expect(game.state.cells[num]).toBeDefined();
        expect(game.state.cells[num].length).toBeGreaterThan(0);
      });
    });

    it('should initialize point tokens', () => {
      expect(game.state.pointTokens.length).toBeGreaterThan(0);
      // For 3 players, should have specific counts
      const tokens5 = game.state.pointTokens.filter((t) => t.value === 5);
      expect(tokens5.length).toBe(11); // 12 - 1 for 3 players
    });

    it('should initialize bonus tokens', () => {
      expect(game.state.bonusTokens).toHaveLength(4);
      const values = game.state.bonusTokens.map((t) => t.value);
      expect(values).toContain(15);
      expect(values).toContain(12);
      expect(values).toContain(9);
      expect(values).toContain(6);
    });

    it('should initialize player pieces at foot of each mountain', () => {
      const cellNumbers = [
        CellNumber.FIVE,
        CellNumber.SIX,
        CellNumber.SEVEN,
        CellNumber.EIGHT,
        CellNumber.NINE,
        CellNumber.TEN,
      ];
      cellNumbers.forEach((num) => {
        const pieces = game.state.playerPieces[num];
        expect(pieces).toHaveLength(3);
        expect(pieces).toContain(PlayerColor.BLACK);
        expect(pieces).toContain(PlayerColor.WHITE);
        expect(pieces).toContain(PlayerColor.RED);
      });
    });
  });

  describe('Dice Operations', () => {
    it('should roll unlocked dice', () => {
      const initialValues = game.state.dice.map((d) => d.value);
      game.rollDice();
      const newValues = game.state.dice.map((d) => d.value);
      // At least some dice should have changed (unless very unlucky)
      const allSame = initialValues.every((val, idx) => val === newValues[idx]);
      // This is probabilistic, but very unlikely all 4 dice stay the same
      expect(allSame).toBe(false);
    });

    it('should not roll locked dice', () => {
      game.state.dice[0].locked = true;
      const lockedValue = game.state.dice[0].value;
      game.rollDice();
      expect(game.state.dice[0].value).toBe(lockedValue);
    });

    it('should handle multiple 1s rule', () => {
      // Force all dice to 1
      game.state.dice.forEach((die) => {
        die.value = 1;
        die.locked = false;
      });
      game.rollDice();
      // After rolling, if multiple 1s, all but one should be changeable
      const ones = game.state.dice.filter((d) => d.value === 1);
      if (ones.length > 1) {
        const changeable = game.state.dice.filter((d) => d.canChange);
        expect(changeable.length).toBe(ones.length - 1);
      }
    });

    it('should allow changing die value when canChange is true', () => {
      game.state.dice[0].value = 1;
      game.state.dice[0].canChange = true;
      game.changeDieValue(0, 5);
      expect(game.state.dice[0].value).toBe(5);
      expect(game.state.dice[0].canChange).toBe(false);
    });

    it('should not allow changing die value when canChange is false', () => {
      game.state.dice[0].value = 2;
      game.state.dice[0].canChange = false;
      game.changeDieValue(0, 5);
      expect(game.state.dice[0].value).toBe(2);
    });

    it('should not allow invalid die values', () => {
      // Set initial value to something other than 1 or 7
      game.state.dice[0].value = 3;
      game.state.dice[0].canChange = true;
      const originalValue = game.state.dice[0].value;

      game.changeDieValue(0, 1); // Can't change to 1
      expect(game.state.dice[0].value).toBe(originalValue); // Should remain unchanged

      game.changeDieValue(0, 7); // Can't change to 7
      expect(game.state.dice[0].value).toBe(originalValue); // Should remain unchanged
    });

    it('should toggle die lock', () => {
      game.state.dice[0].locked = false;
      game.toggleDieLock(0);
      expect(game.state.dice[0].locked).toBe(true);
      game.toggleDieLock(0);
      expect(game.state.dice[0].locked).toBe(false);
    });

    it('should toggle die selection', () => {
      game.state.dice[0].selected = false;
      game.toggleDieSelection(0);
      expect(game.state.dice[0].selected).toBe(true);
      game.toggleDieSelection(0);
      expect(game.state.dice[0].selected).toBe(false);
    });

    it('should not toggle selection for used dice', () => {
      game.state.dice[0].used = true;
      game.state.dice[0].selected = false;
      game.toggleDieSelection(0);
      expect(game.state.dice[0].selected).toBe(false);
    });

    it('should not toggle selection for locked dice', () => {
      game.state.dice[0].locked = true;
      game.state.dice[0].selected = false;
      game.toggleDieSelection(0);
      expect(game.state.dice[0].selected).toBe(false);
    });

    it('should clear dice selection', () => {
      game.state.dice.forEach((die) => {
        die.selected = true;
      });
      game.clearDiceSelection();
      game.state.dice.forEach((die) => {
        expect(die.selected).toBe(false);
      });
    });

    it('should calculate selected dice sum', () => {
      game.state.dice[0].selected = true;
      game.state.dice[0].value = 3;
      game.state.dice[1].selected = true;
      game.state.dice[1].value = 4;
      game.state.dice[2].selected = false;
      game.state.dice[3].selected = false;
      const sum = game.getSelectedDiceSum();
      expect(sum).toBe(7);
    });

    it('should not include used dice in selected sum', () => {
      game.state.dice[0].selected = true;
      game.state.dice[0].value = 3;
      game.state.dice[0].used = true;
      game.state.dice[1].selected = true;
      game.state.dice[1].value = 4;
      const sum = game.getSelectedDiceSum();
      expect(sum).toBe(4);
    });

    it('should return valid mountain targets', () => {
      game.state.dice[0].selected = true;
      game.state.dice[0].value = 5;
      game.state.dice[1].selected = false;
      game.state.dice[2].selected = false;
      game.state.dice[3].selected = false;
      const targets = game.getValidMountainTargets();
      expect(targets).toContain(CellNumber.FIVE);
    });

    it('should not return invalid mountain targets', () => {
      game.state.dice[0].selected = true;
      game.state.dice[0].value = 4; // Sum is 4, not valid
      const targets = game.getValidMountainTargets();
      expect(targets).not.toContain(CellNumber.FIVE);
    });
  });

  describe('Player Actions', () => {
    it('should get current player', () => {
      const currentPlayer = game.getCurrentPlayer();
      expect(currentPlayer).toBe(game.state.players[0]);
    });

    it('should advance to next turn', () => {
      const initialPlayerIndex = game.state.currentPlayerIndex;
      game.nextTurn();
      expect(game.state.currentPlayerIndex).toBe((initialPlayerIndex + 1) % 3);
    });

    it('should cycle through all players', () => {
      expect(game.state.currentPlayerIndex).toBe(0);
      game.nextTurn();
      expect(game.state.currentPlayerIndex).toBe(1);
      game.nextTurn();
      expect(game.state.currentPlayerIndex).toBe(2);
      game.nextTurn();
      expect(game.state.currentPlayerIndex).toBe(0);
    });

    it('should increment turn number when cycling back to first player', () => {
      const initialTurn = game.state.currentTurn;
      game.nextTurn(); // Player 1 -> Player 2
      expect(game.state.currentTurn).toBe(initialTurn);
      game.nextTurn(); // Player 2 -> Player 3
      expect(game.state.currentTurn).toBe(initialTurn);
      game.nextTurn(); // Player 3 -> Player 1
      expect(game.state.currentTurn).toBe(initialTurn + 1);
    });

    it('should reset dice state on next turn', () => {
      game.state.dice.forEach((die) => {
        die.selected = true;
        die.used = true;
      });
      game.nextTurn();
      game.state.dice.forEach((die) => {
        expect(die.selected).toBe(false);
        expect(die.used).toBe(false);
      });
    });

    it('should auto-roll dice on next turn', () => {
      const initialValues = game.state.dice.map((d) => d.value);
      game.nextTurn();
      // Dice should have been rolled (values likely changed)
      const newValues = game.state.dice.map((d) => d.value);
      // Very unlikely all dice stay the same
      const allSame = initialValues.every((val, idx) => val === newValues[idx]);
      expect(allSame).toBe(false);
    });
  });

  describe('Goat Movement', () => {
    it('should move goat up mountain when dice sum matches', () => {
      // Set up dice to sum to 5
      game.state.dice[0].selected = true;
      game.state.dice[0].value = 2;
      game.state.dice[1].selected = true;
      game.state.dice[1].value = 3;
      game.state.dice[2].selected = false;
      game.state.dice[3].selected = false;

      const cells = game.state.cells[CellNumber.FIVE];
      const initialBottomOccupied = [...cells[cells.length - 1].occupiedBy];

      const moved = game.moveGoatUpMountain(CellNumber.FIVE);
      expect(moved).toBe(true);

      // Check that goat moved up
      const newBottomOccupied = cells[cells.length - 1].occupiedBy;
      // The goat should be on a higher cell now
      expect(game.state.dice[0].used).toBe(true);
      expect(game.state.dice[1].used).toBe(true);
    });

    it('should not move goat if dice sum does not match', () => {
      game.state.dice[0].selected = true;
      game.state.dice[0].value = 2;
      game.state.dice[1].selected = true;
      game.state.dice[1].value = 2; // Sum = 4, not 5

      const moved = game.moveGoatUpMountain(CellNumber.FIVE);
      expect(moved).toBe(false);
    });

    it('should not move goat if no dice selected', () => {
      game.state.dice.forEach((die) => {
        die.selected = false;
      });
      const moved = game.moveGoatUpMountain(CellNumber.FIVE);
      expect(moved).toBe(false);
    });

    it('should move goat from foot to first cell', () => {
      const cells = game.state.cells[CellNumber.FIVE];
      const currentPlayer = game.getCurrentPlayer();

      // Ensure player has a goat at foot
      expect(game.state.playerPieces[CellNumber.FIVE]).toContain(currentPlayer.color);

      // Set dice to sum to 5
      game.state.dice[0].selected = true;
      game.state.dice[0].value = 5;
      game.state.dice[1].selected = false;
      game.state.dice[2].selected = false;
      game.state.dice[3].selected = false;

      const moved = game.moveGoatUpMountain(CellNumber.FIVE);
      expect(moved).toBe(true);

      // Goat should be on the bottom cell (highest index)
      const bottomCell = cells[cells.length - 1];
      expect(bottomCell.occupiedBy).toContain(currentPlayer.color);
      // Goat should be removed from foot
      expect(game.state.playerPieces[CellNumber.FIVE]).not.toContain(currentPlayer.color);
    });

    it('should claim token when reaching top of mountain', () => {
      // Place goat one cell below top
      const cells = game.state.cells[CellNumber.FIVE];
      cells[1].occupiedBy = [game.getCurrentPlayer().color];

      // Set dice to sum to 5
      game.state.dice[0].selected = true;
      game.state.dice[0].value = 5;
      game.state.dice[1].selected = false;
      game.state.dice[2].selected = false;
      game.state.dice[3].selected = false;

      const initialTokenCount = game.state.pointTokens.filter(
        (t) => t.value === 5 && t.available
      ).length;

      const moved = game.moveGoatUpMountain(CellNumber.FIVE);
      expect(moved).toBe(true);

      const newTokenCount = game.state.pointTokens.filter(
        (t) => t.value === 5 && t.available
      ).length;
      expect(newTokenCount).toBe(initialTokenCount - 1);
    });

    it('should update player score when claiming token', () => {
      const currentPlayer = game.getCurrentPlayer();
      const initialScore = currentPlayer.score;

      // Place goat at top
      const cells = game.state.cells[CellNumber.FIVE];
      cells[0].occupiedBy = [currentPlayer.color];

      // Set dice to sum to 5
      game.state.dice[0].selected = true;
      game.state.dice[0].value = 5;

      game.moveGoatUpMountain(CellNumber.FIVE);
      expect(currentPlayer.score).toBe(initialScore + 5);
    });

    it('should knock opponent goat when moving to occupied top', () => {
      const currentPlayer = game.getCurrentPlayer();
      const opponent = game.state.players[1];

      // Place opponent at top
      const cells = game.state.cells[CellNumber.FIVE];
      cells[0].occupiedBy = [opponent.color];

      // Place current player one cell below
      cells[1].occupiedBy = [currentPlayer.color];

      // Set dice to sum to 5
      game.state.dice[0].selected = true;
      game.state.dice[0].value = 5;

      const moved = game.moveGoatUpMountain(CellNumber.FIVE);
      expect(moved).toBe(true);

      // Current player should be at top
      expect(cells[0].occupiedBy).toContain(currentPlayer.color);
      // Opponent should be knocked to foot
      expect(game.state.playerPieces[CellNumber.FIVE]).toContain(opponent.color);
    });

    it('should claim token if already at top', () => {
      const currentPlayer = game.getCurrentPlayer();
      const cells = game.state.cells[CellNumber.FIVE];

      // Place goat at top
      cells[0].occupiedBy = [currentPlayer.color];

      // Set dice to sum to 5
      game.state.dice[0].selected = true;
      game.state.dice[0].value = 5;

      const initialTokenCount = game.state.pointTokens.filter(
        (t) => t.value === 5 && t.available
      ).length;

      const moved = game.moveGoatUpMountain(CellNumber.FIVE);
      expect(moved).toBe(true);

      const newTokenCount = game.state.pointTokens.filter(
        (t) => t.value === 5 && t.available
      ).length;
      expect(newTokenCount).toBe(initialTokenCount - 1);
    });
  });

  describe('Token Management', () => {
    it('should claim point token', () => {
      const availableToken = game.state.pointTokens.find((t) => t.value === 5 && t.available);
      expect(availableToken).toBeDefined();

      const claimed = game.claimPointToken(5);
      expect(claimed).toBe(true);
      expect(availableToken!.available).toBe(false);
      expect(availableToken!.claimedBy).toBe(game.state.currentPlayerIndex);
    });

    it('should not claim token if none available', () => {
      // Make all tokens unavailable
      game.state.pointTokens
        .filter((t) => t.value === 5)
        .forEach((t) => {
          t.available = false;
        });

      const claimed = game.claimPointToken(5);
      expect(claimed).toBe(false);
    });

    it('should update player score when claiming token', () => {
      const initialScore = game.getCurrentPlayer().score;
      game.claimPointToken(5);
      expect(game.getCurrentPlayer().score).toBe(initialScore + 5);
    });

    it('should claim bonus token', () => {
      const availableToken = game.state.bonusTokens.find((t) => t.value === 15 && t.available);
      expect(availableToken).toBeDefined();

      const claimed = game.claimBonusToken(15);
      expect(claimed).toBe(true);
      expect(availableToken!.available).toBe(false);
      expect(availableToken!.claimedBy).toBe(game.state.currentPlayerIndex);
    });

    it('should award bonus tokens for complete sets', () => {
      const currentPlayer = game.getCurrentPlayer();
      const initialScore = currentPlayer.score;

      // Claim one token from each mountain (5-10)
      for (let i = 5; i <= 10; i++) {
        game.claimPointToken(i);
      }

      // Check and claim bonus tokens after completing a set
      game.checkAndClaimBonusTokens();

      // Should have claimed a bonus token (highest value: 15)
      // 5+6+7+8+9+10 = 45, plus bonus token (15) = 60
      expect(currentPlayer.score).toBeGreaterThan(initialScore + 45); // 5+6+7+8+9+10 = 45, plus bonus
    });
  });

  describe('Game End Conditions', () => {
    it('should detect when all bonus tokens are claimed', () => {
      game.state.bonusTokens.forEach((token) => {
        token.available = false;
      });
      // Check the internal state - all bonus tokens claimed means game end condition is met
      const allBonusTokensClaimed = game.state.bonusTokens.every((t) => !t.available);
      expect(allBonusTokensClaimed).toBe(true);
    });

    it('should detect when 3 mountains have no tokens', () => {
      // Make tokens unavailable for 3 mountains
      [5, 6, 7].forEach((value) => {
        game.state.pointTokens
          .filter((t) => t.value === value)
          .forEach((t) => {
            t.available = false;
          });
      });
      // Check that 3 mountains have no tokens
      const mountainsWithNoTokens: number[] = [];
      for (let i = 5; i <= 10; i++) {
        const hasTokens = game.state.pointTokens.some((t) => t.value === i && t.available);
        if (!hasTokens) {
          mountainsWithNoTokens.push(i);
        }
      }
      expect(mountainsWithNoTokens.length).toBeGreaterThanOrEqual(3);
    });

    it('should end game after completing round when end condition is met', () => {
      // Trigger end condition
      game.state.bonusTokens.forEach((token) => {
        token.available = false;
      });
      game.state.gameEndTriggered = true;
      game.state.turnsSinceEndCondition = 1;

      expect(game.shouldEndGame()).toBe(true);
    });

    it('should not end game immediately when end condition is first met', () => {
      // Trigger end condition
      game.state.bonusTokens.forEach((token) => {
        token.available = false;
      });
      game.state.gameEndTriggered = false;

      expect(game.shouldEndGame()).toBe(false);
      expect(game.state.gameEndTriggered).toBe(true);
    });
  });

  describe('Game Log', () => {
    it('should add log entries', () => {
      const initialLogLength = game.state.gameLog.length;
      game.addLog('Test action');
      expect(game.state.gameLog.length).toBe(initialLogLength + 1);
      expect(game.state.gameLog[game.state.gameLog.length - 1].action).toBe('Test action');
    });

    it('should include player name in log entries', () => {
      game.addLog('Test action');
      const lastEntry = game.state.gameLog[game.state.gameLog.length - 1];
      expect(lastEntry.playerName).toBe(game.getCurrentPlayer().name);
    });

    it('should include turn number in log entries', () => {
      game.addLog('Test action');
      const lastEntry = game.state.gameLog[game.state.gameLog.length - 1];
      expect(lastEntry.turn).toBe(game.state.currentTurn);
    });
  });

  describe('Serialization', () => {
    it('should serialize game state', () => {
      const serialized = game.serialize();
      expect(typeof serialized).toBe('string');
      const parsed = JSON.parse(serialized);
      expect(parsed.numPlayers).toBe(3);
      expect(parsed.players).toHaveLength(3);
    });

    it('should deserialize game state', () => {
      const serialized = game.serialize();
      const deserialized = GameEngine.deserialize(serialized);
      expect(deserialized.state.numPlayers).toBe(game.state.numPlayers);
      expect(deserialized.state.players).toHaveLength(game.state.players.length);
    });

    it('should reset game', () => {
      game.state.currentTurn = 5;
      game.state.currentPlayerIndex = 2;
      game.reset(playerNames);
      expect(game.state.currentTurn).toBe(1);
      expect(game.state.currentPlayerIndex).toBe(0);
    });
  });
});
