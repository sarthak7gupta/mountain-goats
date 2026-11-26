/** A rejected request. `status` is the HTTP status the server answers with. */
export class RoomError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

/** Server-side randomness: games never roll dice or shuffle on the client. */
export interface Random {
  /** Integer in [min, maxExclusive), from a cryptographic source. */
  int(min: number, maxExclusive: number): number;
}

/**
 * Everything the platform needs to host a turn-based game. The platform owns
 * rooms, seats, accounts, persistence, revisions and live updates; a game only
 * describes its rules.
 *
 * `State` must be plain JSON (it is stored in SQLite and sent to browsers).
 * The platform hands `apply` a private copy, so a game may mutate it freely:
 * a thrown error discards the copy and leaves the room untouched.
 */
export interface GameDefinition<State, Options = Record<string, never>> {
  /** Shown in server logs and the health check. */
  name: string;
  minPlayers: number;
  maxPlayers: number;
  /** Validate and normalise the options a host chose. Throw RoomError to reject. */
  options(input: Record<string, unknown>): Options;
  /** The starting state once the host starts the game. */
  setup(players: string[], options: Options, random: Random): State;
  /** Seats allowed to act right now (usually the current player). */
  activeSeats(state: State): number[];
  /**
   * Apply one untrusted action from `seat`. Return the next state, or `null`
   * when the action changes nothing. Throw RoomError for an illegal action.
   */
  apply(state: State, seat: number, action: unknown, random: Random): State | null;
  isOver(state: State): boolean;
  /** What one seat may see, for games with hidden information. Default: everything. */
  view?(state: State, seat: number): State;
}
