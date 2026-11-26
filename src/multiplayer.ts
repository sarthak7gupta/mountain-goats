import type { GameState } from './models';

export type Action =
  | { type: 'select'; index: number }
  | { type: 'change'; index: number; value: number }
  | { type: 'clear' }
  | { type: 'move'; mountain: number }
  | { type: 'big'; target: number; source: string }
  | { type: 'redeploy'; mountain: number; source: string }
  | { type: 'end' };
export interface RoomView {
  code: string;
  revision: number;
  seats: { name: string }[];
  capacity: number;
  expansions: { bigMountain: boolean; greenValley: boolean };
  game: GameState | null;
  you: number;
}
export interface Session {
  code: string;
  token: string;
}
