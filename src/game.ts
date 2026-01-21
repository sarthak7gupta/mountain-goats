/** Game logic for Mountain Goats board game */
import { i18n } from './i18n';
import { Cell, CellNumber, GameState, Player, PlayerColor } from './models';

export class GameEngine {
  state: GameState;

  constructor(
    numPlayers: number = 2,
    gridWidth: number = 10,
    gridHeight: number = 10,
    playerNames?: string[]
  ) {
    this.state = this.createInitialState(numPlayers, gridWidth, gridHeight, playerNames);
  }

  private createInitialState(
    numPlayers: number,
    gridWidth: number,
    gridHeight: number,
    playerNames?: string[]
  ): GameState {
    const state: GameState = {
      numPlayers,
      players: [],
      currentPlayerIndex: 0,
      gridWidth,
      gridHeight,
      cells: {
        [CellNumber.FIVE]: [],
        [CellNumber.SIX]: [],
        [CellNumber.SEVEN]: [],
        [CellNumber.EIGHT]: [],
        [CellNumber.NINE]: [],
        [CellNumber.TEN]: [],
      },
      playerPieces: {
        [CellNumber.FIVE]: [],
        [CellNumber.SIX]: [],
        [CellNumber.SEVEN]: [],
        [CellNumber.EIGHT]: [],
        [CellNumber.NINE]: [],
        [CellNumber.TEN]: [],
      },
      pointTokens: [],
      bonusTokens: [],
      dice: [],
      gameOver: false,
      gameLog: [],
      currentTurn: 1,
      gameEndTriggered: false,
      turnsSinceEndCondition: 0,
      playersPlayedInLastRound: [],
      language: 'en',
      soundMuted: false,
    };

    this.initializeCells(state);
    this.initializeTokens(state);
    this.initializeDice(state);
    this.initializePlayers(state, playerNames);
    this.initializePlayerPieces(state);

    // Add initial log entry
    if (playerNames && playerNames.length > 0) {
      state.gameLog.push({
        turn: 1,
        playerName: 'Game',
        action: `${i18n.t('gameStarted')} ${state.numPlayers} ${i18n.t('playersText')}`,
        timestamp: Date.now(),
      });
    }

    return state;
  }

  private initializeCells(state: GameState): void {
    const cellConfigs: Record<CellNumber, number> = {
      [CellNumber.FIVE]: 4,
      [CellNumber.SIX]: 4,
      [CellNumber.SEVEN]: 3,
      [CellNumber.EIGHT]: 3,
      [CellNumber.NINE]: 2,
      [CellNumber.TEN]: 2,
    };

    for (const [cellNum, count] of Object.entries(cellConfigs)) {
      const cells: Cell[] = [];
      for (let i = 0; i < count; i++) {
        cells.push({
          column: Number(cellNum) as CellNumber,
          rowIndex: i,
          isTop: i === 0,
          occupiedBy: [],
        });
      }
      state.cells[Number(cellNum) as CellNumber] = cells;
    }
  }

  private initializeTokens(state: GameState): void {
    // Base counts for 4 players
    const baseCounts: Record<number, number> = {
      5: 12,
      6: 11,
      7: 10,
      8: 9,
      9: 8,
      10: 7,
    };

    // Adjust for player count
    const reduction = 4 - state.numPlayers;

    state.pointTokens = [];
    for (const [value, count] of Object.entries(baseCounts)) {
      const adjustedCount = Math.max(0, count - reduction);
      for (let i = 0; i < adjustedCount; i++) {
        state.pointTokens.push({
          value: Number(value),
          available: true,
        });
      }
    }

    // Initialize bonus tokens
    state.bonusTokens = [
      { value: 15, available: true },
      { value: 12, available: true },
      { value: 9, available: true },
      { value: 6, available: true },
    ];
  }

  private initializeDice(state: GameState): void {
    state.dice = Array.from({ length: 4 }, () => ({
      value: 1,
      locked: false,
    }));
  }

  private initializePlayers(state: GameState, playerNames?: string[]): void {
    const colors = Object.values(PlayerColor).slice(0, state.numPlayers);
    const names = playerNames || colors.map((_, i) => `Player ${i + 1}`);
    state.players = colors.map((color, i) => ({
      color,
      name: names[i] || `Player ${i + 1}`,
      score: 0,
      cellsOccupied: [],
    }));
  }

  private initializePlayerPieces(state: GameState): void {
    // Each player places one goat at the foot of each mountain
    const cellNumbers = [
      CellNumber.FIVE,
      CellNumber.SIX,
      CellNumber.SEVEN,
      CellNumber.EIGHT,
      CellNumber.NINE,
      CellNumber.TEN,
    ];
    for (const cellNum of cellNumbers) {
      state.playerPieces[cellNum] = state.players.map((p) => p.color);
    }
  }

  rollDice(): void {
    // Don't roll dice if game is over
    if (this.state.gameOver) {
      return;
    }

    // Reset canChange flags
    for (const die of this.state.dice) {
      die.canChange = false;
    }

    // Roll unlocked dice
    for (const die of this.state.dice) {
      if (!die.locked) {
        die.value = Math.floor(Math.random() * 6) + 1;
      }
    }

    // Check for multiple 1s
    const ones = this.state.dice.filter((d) => d.value === 1);
    if (ones.length > 1) {
      // Mark all but one "1" as changeable
      let firstOneFound = false;
      for (const die of this.state.dice) {
        if (die.value === 1 && !firstOneFound) {
          firstOneFound = true;
        } else if (die.value === 1) {
          die.canChange = true;
        }
      }
    }

    // Log dice roll
    const diceValues = this.state.dice.map((d) => d.value).join(', ');
    this.addLog(`Rolled: [${diceValues}]`);

    // Dispatch event to trigger and sound
    if (typeof globalThis !== 'undefined') {
      globalThis.dispatchEvent(new Event('diceRolled'));
    }
  }

  changeDieValue(dieIndex: number, newValue: number): void {
    if (dieIndex >= 0 && dieIndex < this.state.dice.length) {
      const die = this.state.dice[dieIndex];
      if (die.canChange && newValue >= 2 && newValue <= 6) {
        die.value = newValue;
        die.canChange = false;
        this.addLog(`${this.getCurrentPlayer().name} ${i18n.t('changedDie')} ${newValue}`);
      }
    }
  }

  addLog(action: string): void {
    this.state.gameLog.push({
      turn: this.state.currentTurn,
      playerName: this.getCurrentPlayer().name,
      action,
      timestamp: Date.now(),
    });
  }

  toggleDieLock(dieIndex: number): void {
    if (dieIndex >= 0 && dieIndex < this.state.dice.length) {
      this.state.dice[dieIndex].locked = !this.state.dice[dieIndex].locked;
    }
  }

  getCurrentPlayer(): Player {
    return this.state.players[this.state.currentPlayerIndex];
  }

  toggleDieSelection(dieIndex: number): void {
    if (dieIndex >= 0 && dieIndex < this.state.dice.length) {
      const die = this.state.dice[dieIndex];
      // Can only select/unselect unused, unlocked dice
      if (!die.used && !die.locked) {
        die.selected = !die.selected;
      }
    }
  }

  removeLastDie(): void {
    // Find the last (highest index) selected die
    for (let i = this.state.dice.length - 1; i >= 0; i--) {
      const die = this.state.dice[i];
      if (die.selected && !die.used && !die.locked) {
        die.selected = false;
        return;
      }
    }
  }

  getSelectedDiceSum(): number {
    return this.state.dice
      .filter((d) => d.selected && !d.used)
      .reduce((sum, die) => sum + die.value, 0);
  }

  getValidMountainTargets(): CellNumber[] {
    const sum = this.getSelectedDiceSum();
    const validTargets: CellNumber[] = [];

    if (sum >= 5 && sum <= 10) {
      validTargets.push(sum as CellNumber);
    }

    return validTargets;
  }

  moveGoatUpMountain(mountainNumber: CellNumber): boolean {
    const currentPlayer = this.getCurrentPlayer();
    const selectedDice = this.state.dice.filter((d) => d.selected && !d.used);

    if (selectedDice.length === 0) {
      return false;
    }

    const sum = this.getSelectedDiceSum();
    if (sum !== mountainNumber) {
      return false;
    }

    const cells = this.state.cells[mountainNumber];
    if (!cells || cells.length === 0) {
      return false;
    }

    // Find the highest (lowest index) cell occupied by this player
    // Search from top (index 0) to bottom to find highest position
    let highestOccupiedIndex = -1;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].occupiedBy.includes(currentPlayer.color)) {
        highestOccupiedIndex = i;
        break; // Found highest position (closest to top)
      }
    }

    // If player's goat is already at the top, claim a token instead
    if (highestOccupiedIndex === 0) {
      // Check if tokens are available
      const hasAvailableToken = this.state.pointTokens.some(
        (t) => t.value === mountainNumber && t.available
      );

      if (hasAvailableToken) {
        // Mark dice as used
        for (const die of selectedDice) {
          die.used = true;
          die.selected = false;
        }
        // Claim token
        const claimed = this.claimPointToken(mountainNumber);
        if (claimed) {
          this.addLog(
            `${currentPlayer.name} ${i18n.t('claimedToken')} ${mountainNumber} ${i18n.t('pointToken')} (goat already at top)`
          );
        }
        this.checkAndClaimBonusTokens();
        return true;
      }
      return false;
    }

    // If player has no piece on this mountain, start from bottom
    // Otherwise move up one space (to lower index)
    let targetIndex: number;
    const movingFromFoot = highestOccupiedIndex === -1;
    if (highestOccupiedIndex === -1) {
      // No piece on mountain, start at bottom
      targetIndex = cells.length - 1;
    } else {
      // Move up one space (towards index 0)
      targetIndex = highestOccupiedIndex - 1;
    }

    // Can't move above the top
    if (targetIndex < 0) {
      return false;
    }

    // Check if moving to top (index 0)
    if (targetIndex === 0) {
      // Top can only have one goat - check if occupied
      if (cells[0].occupiedBy.length > 0 && !cells[0].occupiedBy.includes(currentPlayer.color)) {
        // Knock the existing goat(s) to the bottom (below mountain)
        for (const knockedPlayerColor of cells[0].occupiedBy) {
          // Add to foot of mountain
          if (!this.state.playerPieces[mountainNumber].includes(knockedPlayerColor)) {
            this.state.playerPieces[mountainNumber].push(knockedPlayerColor);
          }
        }
        // Clear top cell
        cells[0].occupiedBy = [];
      }

      // Remove current player from old position if exists
      if (highestOccupiedIndex >= 0) {
        const oldIndex = cells[highestOccupiedIndex].occupiedBy.indexOf(currentPlayer.color);
        if (oldIndex !== -1) {
          cells[highestOccupiedIndex].occupiedBy.splice(oldIndex, 1);
        }
      }

      // Place current player's goat on top (only one allowed on top)
      cells[0].occupiedBy = [currentPlayer.color];

      // Remove goat from foot if it was moved from foot
      if (movingFromFoot) {
        const footIndex = this.state.playerPieces[mountainNumber].indexOf(currentPlayer.color);
        if (footIndex !== -1) {
          this.state.playerPieces[mountainNumber].splice(footIndex, 1);
        }
      }

      // Mark dice as used
      for (const die of selectedDice) {
        die.used = true;
        die.selected = false;
      }

      // Claim a token from this mountain (if available)
      const hasAvailableToken = this.state.pointTokens.some(
        (t) => t.value === mountainNumber && t.available
      );

      if (hasAvailableToken) {
        const claimed = this.claimPointToken(mountainNumber);
        if (claimed) {
          this.addLog(
            `${currentPlayer.name} moved to top and ${i18n.t('claimedToken')} ${mountainNumber} ${i18n.t('pointToken')}`
          );
        }
        this.checkAndClaimBonusTokens();
      } else {
        this.addLog(`${currentPlayer.name} moved to top of mountain ${mountainNumber}`);
      }

      return true;
    }

    // Moving to non-top cell - multiple goats can share space
    // Remove from old position if exists (only if moving to different cell)
    if (highestOccupiedIndex >= 0 && highestOccupiedIndex !== targetIndex) {
      const oldIndex = cells[highestOccupiedIndex].occupiedBy.indexOf(currentPlayer.color);
      if (oldIndex !== -1) {
        cells[highestOccupiedIndex].occupiedBy.splice(oldIndex, 1);
      }
    }

    // Place on new position - multiple goats can share non-top cells
    // Add current player to the cell if not already there
    if (!cells[targetIndex].occupiedBy.includes(currentPlayer.color)) {
      cells[targetIndex].occupiedBy.push(currentPlayer.color);
    }

    // Remove goat from foot if it was moved from foot
    if (movingFromFoot) {
      const footIndex = this.state.playerPieces[mountainNumber].indexOf(currentPlayer.color);
      if (footIndex !== -1) {
        this.state.playerPieces[mountainNumber].splice(footIndex, 1);
      }
    }

    // Mark dice as used
    for (const die of selectedDice) {
      die.used = true;
      die.selected = false;
    }

    this.addLog(`${currentPlayer.name} ${i18n.t('movedGoat')} ${mountainNumber} (sum: ${sum})`);
    return true;
  }

  checkAndClaimBonusTokens(): void {
    const currentPlayer = this.getCurrentPlayer();

    // Count tokens from each mountain (5-10)
    const tokensByMountain: Record<number, number> = {};
    for (let i = 5; i <= 10; i++) {
      tokensByMountain[i] = 0;
    }

    // Count tokens claimed by this player
    this.state.pointTokens.forEach((token) => {
      if (!token.available && token.claimedBy === this.state.currentPlayerIndex) {
        tokensByMountain[token.value] = (tokensByMountain[token.value] || 0) + 1;
      }
    });

    // Check how many complete sets (at least one token from each mountain)
    const minTokensPerMountain = Math.min(...Object.values(tokensByMountain));
    const completeSets = minTokensPerMountain;

    // Count how many bonus tokens this player already has
    const claimedBonusTokens = this.state.bonusTokens.filter(
      (t) => !t.available && t.claimedBy === this.state.currentPlayerIndex
    ).length;

    // Claim bonus tokens for complete sets
    if (completeSets > claimedBonusTokens) {
      const tokensToClaim = completeSets - claimedBonusTokens;

      // Get available bonus tokens sorted by value (highest first)
      const availableBonusTokens = this.state.bonusTokens
        .filter((t) => t.available)
        .sort((a, b) => b.value - a.value);

      // Claim the highest value tokens
      for (let i = 0; i < Math.min(tokensToClaim, availableBonusTokens.length); i++) {
        const token = availableBonusTokens[i];
        token.available = false;
        token.claimedBy = this.state.currentPlayerIndex;
        currentPlayer.score += token.value;
        this.addLog(
          `${currentPlayer.name} ${i18n.t('claimedToken')} ${token.value} ${i18n.t('bonusToken')} for complete set`
        );
      }
    }
  }

  clearDiceSelection(): void {
    for (const die of this.state.dice) {
      die.selected = false;
    }
  }

  checkGameEndConditions(): boolean {
    // Check if all bonus tokens are claimed
    const allBonusTokensClaimed = this.state.bonusTokens.every((t) => !t.available);

    // Check if 3 or more mountains have no point tokens remaining
    const mountainsWithTokens: Record<number, boolean> = {};
    for (let i = 5; i <= 10; i++) {
      mountainsWithTokens[i] = this.state.pointTokens.some((t) => t.value === i && t.available);
    }
    const mountainsWithoutTokens = Object.values(mountainsWithTokens).filter(
      (hasTokens) => !hasTokens
    ).length;
    const threeMountainsEmpty = mountainsWithoutTokens >= 3;

    return allBonusTokensClaimed || threeMountainsEmpty;
  }

  shouldEndGame(): boolean {
    const endConditionMet = this.checkGameEndConditions();

    if (!endConditionMet) {
      // Reset end condition tracking if condition is no longer met
      this.state.gameEndTriggered = false;
      this.state.turnsSinceEndCondition = 0;
      this.state.playersPlayedInLastRound = [];
      return false;
    }

    // End condition is met
    if (!this.state.gameEndTriggered) {
      // First time end condition is met - mark it and continue
      this.state.gameEndTriggered = true;
      this.state.turnsSinceEndCondition = 0;
      this.state.playersPlayedInLastRound = [];
      return false;
    }

    // End condition was already triggered - end game after completing one full round
    // (all players have had equal turns)
    return (this.state.turnsSinceEndCondition || 0) >= 1;
  }

  getWinners(): Player[] {
    // Sort players by score (descending)
    const sortedPlayers = [...this.state.players].sort((a, b) => b.score - a.score);
    const highestScore = sortedPlayers[0].score;

    // Get all players with the highest score
    const tiedPlayers = sortedPlayers.filter((p) => p.score === highestScore);

    if (tiedPlayers.length === 1) {
      return tiedPlayers;
    }

    // Tiebreaker 1: Most goats on mountain tops
    const goatsOnTops: Record<number, number> = {};
    tiedPlayers.forEach((player) => {
      let count = 0;
      for (const cellArray of Object.values(this.state.cells)) {
        if (cellArray[0]?.occupiedBy.includes(player.color)) {
          count++;
        }
      }
      goatsOnTops[this.state.players.indexOf(player)] = count;
    });

    const maxGoatsOnTops = Math.max(...Object.values(goatsOnTops));
    const playersWithMostGoats = tiedPlayers.filter(
      (player) => goatsOnTops[this.state.players.indexOf(player)] === maxGoatsOnTops
    );

    if (playersWithMostGoats.length === 1) {
      return playersWithMostGoats;
    }

    // Tiebreaker 2: Goat on highest numbered mountain
    let highestMountain = -1;
    let winner: Player | null = null;

    for (const player of playersWithMostGoats) {
      for (let mountain = 10; mountain >= 5; mountain--) {
        const cells = this.state.cells[mountain as CellNumber];
        if (cells && cells[0]?.occupiedBy.includes(player.color)) {
          if (mountain > highestMountain) {
            highestMountain = mountain;
            winner = player;
          }
          break;
        }
      }
    }

    return winner ? [winner] : playersWithMostGoats;
  }

  nextTurn(): void {
    // If we're in the last round, mark the current player as having played
    if (
      this.state.gameEndTriggered &&
      (this.state.turnsSinceEndCondition || 0) === 0 &&
      this.state.playersPlayedInLastRound
    ) {
      const currentPlayerIndex = this.state.currentPlayerIndex;
      if (!this.state.playersPlayedInLastRound.includes(currentPlayerIndex)) {
        this.state.playersPlayedInLastRound.push(currentPlayerIndex);
      }
    }

    // Clear all selections and reset used dice
    for (const die of this.state.dice) {
      die.selected = false;
      die.used = false;
      die.locked = false;
      die.canChange = false;
    }

    // Track if we're completing a full round (cycling back to player 0)
    const wasLastPlayer = this.state.currentPlayerIndex === this.state.numPlayers - 1;

    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.numPlayers;

    // If we've cycled back to player 0, increment turn number
    if (this.state.currentPlayerIndex === 0) {
      this.state.currentTurn++;
      // If end condition was triggered, increment the counter
      if (this.state.gameEndTriggered && this.state.turnsSinceEndCondition !== undefined) {
        this.state.turnsSinceEndCondition = (this.state.turnsSinceEndCondition || 0) + 1;
      }
    }

    // Check if game should end (after completing a full round if end condition was met)
    if (this.shouldEndGame()) {
      this.state.gameOver = true;
      const winners = this.getWinners();
      if (winners.length === 1) {
        this.addLog(`🎉 ${winners[0].name} wins with ${winners[0].score} points!`);
      } else {
        const winnerNames = winners.map((w) => w.name).join(' and ');
        this.addLog(`🎉 Tie! ${winnerNames} win with ${winners[0].score} points!`);
      }
      return;
    }

    // Log turn start before rolling dice
    this.addLog(
      `${this.getCurrentPlayer().name} ${i18n.t('startedTurn')} ${this.state.currentTurn}`
    );
    // Auto-roll dice for new turn
    this.rollDice();
  }

  placePieceInCell(cellNumber: CellNumber, rowIndex: number): boolean {
    const cells = this.state.cells[cellNumber];
    if (!cells || rowIndex < 0 || rowIndex >= cells.length) {
      return false;
    }

    const cell = cells[rowIndex];
    const currentPlayerColor = this.getCurrentPlayer().color;

    // For top cell, only allow if empty
    if (cell.isTop && cell.occupiedBy.length > 0) {
      return false;
    }

    // Add player to cell if not already there
    if (!cell.occupiedBy.includes(currentPlayerColor)) {
      cell.occupiedBy.push(currentPlayerColor);
      this.getCurrentPlayer().cellsOccupied.push(cell);
    }
    return true;
  }

  claimPointToken(value: number): boolean {
    for (const token of this.state.pointTokens) {
      if (token.value === value && token.available) {
        token.available = false;
        token.claimedBy = this.state.currentPlayerIndex;
        this.getCurrentPlayer().score += value;
        return true;
      }
    }
    return false;
  }

  claimBonusToken(value: number): boolean {
    for (const token of this.state.bonusTokens) {
      if (token.value === value && token.available) {
        token.available = false;
        token.claimedBy = this.state.currentPlayerIndex;
        this.getCurrentPlayer().score += value;
        return true;
      }
    }
    return false;
  }

  setLanguage(language: string): void {
    this.state.language = language;
    i18n.setLocale(language as 'en');
  }

  toggleSoundMuted(): void {
    this.state.soundMuted = !this.state.soundMuted;
  }

  reset(playerNames?: string[]): void {
    const numPlayers = this.state.numPlayers;
    const gridWidth = this.state.gridWidth;
    const gridHeight = this.state.gridHeight;
    const names = playerNames || this.state.players.map((p) => p.name);
    const language = this.state.language || 'en';
    const soundMuted = this.state.soundMuted || false;
    this.state = this.createInitialState(numPlayers, gridWidth, gridHeight, names);
    this.state.language = language;
    this.state.soundMuted = soundMuted;
  }

  // Serialize state to JSON
  serialize(): string {
    return JSON.stringify(this.state);
  }

  // Deserialize state from JSON
  static deserialize(json: string): GameEngine {
    const state = JSON.parse(json) as GameState;
    const engine = new GameEngine(state.numPlayers, state.gridWidth, state.gridHeight);
    engine.state = state;
    return engine;
  }
}
