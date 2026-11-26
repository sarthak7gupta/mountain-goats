import type { GameState } from './models';
import type { RoomView as PlatformRoomView } from './platform/protocol';

export type Action =
  | { type: 'select'; index: number }
  | { type: 'change'; index: number; value: number }
  | { type: 'clear' }
  | { type: 'move'; mountain: number }
  | { type: 'big'; target: number; source: string }
  | { type: 'redeploy'; mountain: number; source: string }
  | { type: 'end' };
export type { Session } from './platform/protocol';
export interface Expansions {
  bigMountain: boolean;
  greenValley: boolean;
}
/** A Mountain Goats room as the server sends it. */
export type RoomView = PlatformRoomView<GameState, Expansions>;
