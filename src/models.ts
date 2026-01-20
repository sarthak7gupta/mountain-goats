/** Game state models */

export enum PlayerColor {
  BLACK = 'black',
  WHITE = 'white',
  RED = 'red',
  YELLOW = 'yellow',
}

export enum CellNumber {
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  EIGHT = 8,
  NINE = 9,
  TEN = 10,
}

export interface Cell {
  column: CellNumber;
  rowIndex: number;
  isTop: boolean;
  occupiedBy: PlayerColor[]; // Array of players on this cell. For top cell, max 1 player. For other cells, multiple goats can share space
}

export interface PointToken {
  value: number; // 5-10
  available: boolean;
  claimedBy?: number; // Player index who claimed this token
}

export interface BonusToken {
  value: number; // 15, 12, 9, 6
  available: boolean;
  claimedBy?: number; // Player index who claimed this token
}

export interface Player {
  color: PlayerColor;
  name: string;
  score: number;
  cellsOccupied: Cell[];
}

export interface Die {
  value: number; // 1-6
  locked: boolean;
  canChange?: boolean; // Can be changed if it's an extra "1" when multiple 1s are rolled
  selected?: boolean; // Selected for grouping
  used?: boolean; // Used in a move
}

export interface GameLogEntry {
  turn: number;
  playerName: string;
  action: string;
  timestamp: number;
}

export interface GameState {
  numPlayers: number; // 2-4
  players: Player[];
  currentPlayerIndex: number;
  gridWidth: number;
  gridHeight: number;
  cells: Record<CellNumber, Cell[]>;
  playerPieces: Record<CellNumber, PlayerColor[]>;
  pointTokens: PointToken[];
  bonusTokens: BonusToken[];
  dice: Die[];
  gameOver: boolean;
  gameLog: GameLogEntry[];
  currentTurn: number;
  gameEndTriggered?: boolean; // True when end condition is met
  turnsSinceEndCondition?: number; // Count of full rounds since end condition
  language?: string; // Language preference (e.g., 'en')
  soundMuted?: boolean; // Sound mute preference
}
