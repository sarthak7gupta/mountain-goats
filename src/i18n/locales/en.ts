export const en = {
  // Game
  gameTitle: 'Mountain Goats',
  gameOver: 'Game Over',
  currentPlayer: 'Current Player',
  score: 'Score',
  turn: 'Turn',

  // Actions
  rollDice: 'Roll Dice',
  clearSelection: 'Clear Selection',
  nextTurn: 'Next Turn',
  reset: 'Reset',
  backToSetup: 'Back to Setup',
  startGame: 'Start Game',
  addPlayer: 'Add Player',
  removePlayer: 'Remove Player',

  // Dice
  dice: 'Dice',
  multipleOnesRolled: 'Multiple 1s rolled! Click a "1" to change it (2-6)',
  selectedSum: 'Selected Sum',
  validMountains: 'Valid Mountains',
  clickGoatToMove: 'Click your goat on a valid mountain to move up',
  sumMustBeValid: 'Sum must be 5-10 to move',
  dieUsed: 'Used',
  dieLocked: 'Locked',
  clickToChange: 'Click to change value',
  clickToSelect: 'Click to select',

  // Players
  players: 'Players',
  player: 'Player',
  totalPoints: 'Total Points',
  pointTokens: 'Point Tokens',

  // Game Log
  gameLog: 'Game Log',
  noActionsYet: 'No actions yet...',

  // Help
  help: 'Help',
  keyboardShortcuts: 'Keyboard Shortcuts',
  shortcuts: 'Shortcuts',
  openShortcuts: 'Open shortcuts panel',
  toggleSound: 'Toggle sound',
  closeModal: 'Close modal',
  clearDiceSelectionShortcut: 'Clear dice selection',
  removeLastDieShortcut: 'Remove last die',
  nextTurnShortcut: 'Next turn',
  gameRules: 'Game Rules',
  resetGameShortcut: 'Reset Game',
  editDiceShortcut: 'Edit editable dice',
  changeOrSelectDiceShortcut: 'Change editable dice or select dice with that value',
  moveGoatShortcut: 'Move goat on valid mountain',

  // Modals
  gotIt: 'Got it!',
  cancel: 'Cancel',
  confirm: 'Confirm',
  leaveGame: 'Leave Game?',
  leaveGameMessage: 'Are you sure you want to go back to setup? All game progress will be lost.',
  yesLeaveGame: 'Yes, Leave Game',
  resetGameMessage:
    'Are you sure you want to reset the game and return to setup? All game progress will be lost.',
  yesReset: 'Yes, Reset',
  passTurn: 'Pass Turn?',
  passTurnMessage:
    'You have unused dice remaining. Are you sure you want to pass your turn to the next player?',
  yesPassTurn: 'Yes, Pass Turn',

  // Game Rules
  objective: 'Objective',
  objectiveText:
    'Climb the mountains by moving your goats up and collect point tokens. The player with the highest score wins!',
  setup: 'Setup',
  setupItems: [
    '2-4 players',
    'Each player starts with one goat at the foot of each mountain (5, 6, 7, 8, 9, 10)',
    'Point tokens are placed above each mountain based on the number of players',
    '4 bonus tokens (15, 12, 9, 6 points) are available at the top',
  ],
  turnStructure: 'Turn Structure',
  turnSteps: [
    'Roll Dice: 4 dice are automatically rolled at the start of your turn',
    'Multiple 1s Rule: If more than one "1" is rolled, you can change all but one "1" to any value from 2-6',
    'Select Dice: Click dice to select them (they turn blue). All selected dice form a grouping',
    'Move Goat: If the sum of your selected dice equals a mountain number (5-10), click your goat on that mountain to move it up 1 cell',
    'Claim Tokens: When your goat reaches the top of a mountain, you claim a point token from that mountain (if available)',
    'Continue or End: You can make multiple moves per turn using different dice groupings, or end your turn with unused dice',
  ],
  specialRules: 'Special Rules',
  specialRulesItems: [
    'Multiple Goats: Multiple goats can share the same space, except at the top of the mountain',
    "Knocking: If you move to the top and another player's goat is there, it gets knocked to the bottom",
    'Already at Top: If your goat is already at the top and you create a valid grouping, you claim a token instead of moving',
    'Exact Match: The dice sum must exactly equal the mountain number (e.g., sum of 7 can only move on mountain 7)',
  ],
  bonusTokens: 'Bonus Tokens',
  bonusTokensText:
    'When you collect at least one point token from each of the 6 mountains (5-10), you automatically claim the highest-value bonus token still available. Additional complete sets claim additional bonus tokens.',
  gameEnd: 'Game End',
  gameEndText: 'The game ends when:',
  gameEndItems: [
    'All bonus tokens have been claimed, OR',
    '3 mountains have no more point tokens remaining',
  ],
  gameEndContinue:
    'When either condition is met, continue playing until all players have had an equal number of turns. Then the game is over.',
  winning: 'Winning',
  winningText: 'The player with the most points wins! In case of a tie:',
  winningTieBreakers: [
    'The tied player with the most goats on mountain tops wins',
    'If still tied, the tied player with a goat on the higher numbered mountain wins',
  ],

  // Game actions
  rolledDice: 'rolled dice',
  changedDie: 'changed die to',
  movedGoat: 'moved goat up mountain',
  claimedToken: 'claimed',
  pointToken: 'point token',
  bonusToken: 'bonus token',
  startedTurn: 'started turn',
  gameStarted: 'Game started with',
  playersText: 'players',
  endConditionMet: 'End condition met! Finishing current round...',
  lastRound: 'Last Round',
  lastRoundBanner: 'This is the last round! All players will have one final turn.',
  gameOverWinner: 'Game Over!',
  wins: 'wins',
  withPoints: 'with',
  points: 'points',
  value: 'Value',

  // Accessibility
  ariaDice: 'Dice',
  ariaDie: 'Die',
  ariaMountain: 'Mountain',
  ariaGoat: 'Goat',
  ariaToken: 'Token',
  ariaPlayer: 'Player',
  ariaSelected: 'Selected',
  ariaUsed: 'Used',
  ariaLocked: 'Locked',
  ariaCanChange: 'Can change value',
  ariaClickable: 'Clickable',
  ariaCurrentPlayer: 'Current player',
  ariaGameOver: 'Game over',
  ariaWinner: 'Winner',
  occupiedBy: 'Occupied by',
  available: 'available',
  validTarget: 'Valid target',
  language: 'Language',
  muteSound: 'Mute sound',
  unmuteSound: 'Unmute sound',
};
