import { orientationsOf } from "./rules";
import { Coord, Orientation, PieceDef, PieceId } from "./types";

// helper to build by strings (rows) for readability
const rows = (...lines: string[]): Coord[] => {
  const pts: Coord[] = [];
  lines.forEach((line, y) =>
    [...line].forEach((c, x) => {
      if (c === "1") pts.push({ x, y });
    })
  );
  return pts;
};

export const PIECES: Record<PieceId, PieceDef> = {
  // 1
  P1: { id: "P1", size: 1, cells: rows("1") },

  // 2
  P2: { id: "P2", size: 2, cells: rows("11") },

  // 3
  I3: { id: "I3", size: 3, cells: rows("111") },
  L3: { id: "L3", size: 3, cells: rows("10", "11") },

  // 4 (5 tetrominoes)
  I4: { id: "I4", size: 4, cells: rows("1111") },
  O4: { id: "O4", size: 4, cells: rows("11", "11") },
  L4: { id: "L4", size: 4, cells: rows("100", "111") },
  T4: { id: "T4", size: 4, cells: rows("111", "010") },
  S4: { id: "S4", size: 4, cells: rows("011", "110") },

  // 5 (12 pentominoes)
  F5: { id: "F5", size: 5, cells: rows("011", "110", "010") },
  I5: { id: "I5", size: 5, cells: rows("11111") },
  L5: { id: "L5", size: 5, cells: rows("1000", "1111") },
  P5: { id: "P5", size: 5, cells: rows("110", "110", "100") },
  N5: { id: "N5", size: 5, cells: rows("0111", "1100") },
  T5: { id: "T5", size: 5, cells: rows("111", "010", "010") },
  U5: { id: "U5", size: 5, cells: rows("101", "111") },
  V5: { id: "V5", size: 5, cells: rows("100", "100", "111") },
  W5: { id: "W5", size: 5, cells: rows("100", "110", "011") },
  X5: { id: "X5", size: 5, cells: rows("010", "111", "010") },
  Y5: { id: "Y5", size: 5, cells: rows("0100", "1111") },
  Z5: { id: "Z5", size: 5, cells: rows("001", "111", "100") },
};

export const PIECE_SIZES: Record<PieceId, number> = Object.fromEntries(
  Object.entries(PIECES).map(([id, def]) => [id as PieceId, def.size])
) as Record<PieceId, number>;

// All 21 IDs in a fixed order
export const ALL_PIECE_IDS: PieceId[] = Object.keys(PIECES) as PieceId[];

export const ORIENTATIONS: Record<PieceId, Orientation[]> = {} as Record<
  PieceId,
  Orientation[]
>;
for (const id of Object.keys(PIECES) as PieceId[]) {
  ORIENTATIONS[id] = orientationsOf(PIECES[id]);
}
