import type { GameState } from '../src/models';
import { type Expansions, mountainGoats } from './mountainGoats';
import { GameRooms } from './platform';

export { matches, nameOf, RoomError, secret } from './platform';

/** Mountain Goats rooms: the platform room store bound to the Mountain Goats rules. */
export class Rooms extends GameRooms<GameState, Expansions> {
  constructor(databasePath?: string) {
    super(mountainGoats, databasePath);
  }
}
