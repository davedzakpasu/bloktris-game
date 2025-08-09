export type Cell = 0 | 1;

export type Shape = number[][]; // 2D matrix, 1 = filled
export type Orientation = Shape;

export type Coord = { x: number; y: number };

export type PlayerId = 0 | 1 | 2 | 3;

export type PlayerColor = "blue" | "yellow" | "red" | "green";

export type PieceId =
  | "P1"
  | "P2"
  | "I3"
  | "L3"
  | "I4"
  | "O4"
  | "L4"
  | "T4"
  | "S4"
  | "F5"
  | "I5"
  | "L5"
  | "P5"
  | "N5"
  | "T5"
  | "U5"
  | "V5"
  | "W5"
  | "X5"
  | "Y5"
  | "Z5";

export interface PieceDef {
  id: PieceId;
  cells: Coord[]; // minimal footprint
  size: number; // number of squares
}

export interface PlacedPiece {
  pieceId: PieceId;
  player: PlayerId;
  at: Coord; // top-left on board grid
  shape: Shape; // orientation used
}

export interface PlayerState {
  id: PlayerId;
  color: PlayerColor;
  remaining: PieceId[];
  hasPlayed: boolean; // for corner rule
  isBot: boolean;
  score: number; // negative = remaining squares
  active: boolean; // eliminated (no legal moves) => false
}

/** Extra per-match info used by UI and pre-game flow */
export interface MatchMeta {
  /** Stable identifier for this match (e.g., "2025-08-09-ABCD"). */
  matchId?: string;

  /** Seed to drive deterministic RNG for dice animation & order resolution. */
  rngSeed?: string;

  /** True while we are in the interactive roll phase (before reordering players). */
  rollPending?: boolean;

  /**
   * Queue of seats that still need to roll interactively (human players),
   * in the order they should roll. If empty and rollPending=true, bots will
   * auto-roll and resolve immediately.
   */
  rollQueue?: PlayerId[];

  /**
   * Raw rolls per seat collected so far (before mapping to final colors).
   * `value` can be null until that seat has rolled (useful for animating per-seat dice).
   */
  rolls?: { id: PlayerId; value: number | null }[];

  /**
   * Final, mapped roll results in color order (Blue→Yellow→Red→Green),
   * shown briefly after resolving turn order.
   */
  lastRoll?: { color: PlayerColor; value: number }[];

  /** Prevents re-showing the results overlay within the same match. */
  showedRollOnce?: boolean;
}

export interface GameState {
  board: (PlayerId | null)[][];
  players: PlayerState[];
  current: PlayerId;
  history: PlacedPiece[];
  winnerIds: PlayerId[] | null;

  /** Optional per-match metadata used by UI (dice, seeds, overlays). */
  meta?: MatchMeta;
}

export type GameEvent =
  | { type: "placed"; piece: PlacedPiece }
  | { type: "pass"; player: PlayerId }
  | { type: "gameOver"; winnerIds: PlayerId[] }
  | { type: "reset" }
  | { type: "start" }
  | { type: "error"; message: string };
