/**
 * Wire format shared by the game platform server (server/platform) and its
 * browser client (src/platform). Nothing here knows about a specific game.
 */
export interface RoomView<State = unknown, Options = unknown> {
  code: string;
  /** Increases by one with every accepted change; clients ignore older snapshots. */
  revision: number;
  seats: { name: string }[];
  capacity: number;
  options: Options;
  /** `null` until the host starts the game. */
  state: State | null;
  /** The viewer's seat index. */
  you: number;
}
export interface PublicRoom<Options = unknown> {
  code: string;
  players: number;
  capacity: number;
  options: Options;
}
export interface Session {
  code: string;
  token: string;
}
export interface RoomSummary {
  code: string;
  token: string;
  started: boolean;
  finished: boolean;
}
export interface User {
  id: number;
  username: string;
}
export interface ServerConfig {
  mode: 'lan' | 'online';
  login: boolean;
  /** LAN mode only: addresses other devices on the network can open. */
  lanUrls?: string[];
}
