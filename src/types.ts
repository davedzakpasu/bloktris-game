export type Cell = 0 | 1;

export type Shape = number[][]; // 2D matrix, 1 = filled

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

export interface GameState {
  board: (PlayerId | null)[][]; // 20x20 owner or null
  players: PlayerState[];
  current: PlayerId; // whose turn
  history: PlacedPiece[];
  winnerIds: PlayerId[] | null;
}

export type Orientation = Shape; // transformed shape

export type GameEvent =
  | { type: "placed"; piece: PlacedPiece }
  | { type: "pass"; player: PlayerId }
  | { type: "gameOver"; winnerIds: PlayerId[] }
  | { type: "reset" }
  | { type: "start" }
  | { type: "error"; message: string };
