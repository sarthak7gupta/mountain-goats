/**
 * Reusable multiplayer platform: rooms, seats, accounts, SQLite persistence,
 * long-poll live updates and the HTTP API. Host a new game by writing a
 * GameDefinition; see docs/ENGINE.md.
 */
export type { PublicRoom, RoomSummary, RoomView, ServerConfig, Session, User } from '../../src/platform/protocol';
export { Accounts } from './accounts';
export { type GameDefinition, type Random, RoomError } from './game';
export { createGameServer, type GameServerOptions, lanAddresses, LONG_POLL_MS, publicOrigin, serve } from './http';
export { GameRooms, matches, nameOf, type Room, type Seat, secret } from './rooms';
