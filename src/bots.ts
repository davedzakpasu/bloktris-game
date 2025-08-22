import { PIECES } from "./pieces";
import { BOARD_SIZE, isLegalMove, orientationsOf } from "./rules";
import { Coord, GameState, PlayerId } from "./types";

// Count potential future anchors (empty diagonals after placing)
function mobilityEstimate(state: GameState, shape: number[][], at: Coord) {
  let count = 0;
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[0].length; x++) {
      if (!shape[y][x]) continue;
      const gx = at.x + x,
        gy = at.y + y;
      for (const d of [
        { x: 1, y: 1 },
        { x: 1, y: -1 },
        { x: -1, y: 1 },
        { x: -1, y: -1 },
      ]) {
        const nx = gx + d.x,
          ny = gy + d.y;
        if (nx < 0 || ny < 0 || nx >= BOARD_SIZE || ny >= BOARD_SIZE) continue;
        if (state.board[ny][nx] === null) count++;
      }
    }
  }
  return count;
}

export function botMove(state: GameState, pid: PlayerId) {
  let best: {
    pieceId: string;
    at: Coord;
    shape: number[][];
    score: number;
  } | null = null;
  const p = state.players[pid];

  for (const pieceId of p.remaining) {
    const piece = PIECES[pieceId as keyof typeof PIECES];
    for (const shape of orientationsOf(piece)) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          const at = { x, y };
          if (!isLegalMove(state, pid, shape, at)) continue;

          const outward = x + y; // push out from own corner
          const mobility = mobilityEstimate(state, shape, at); // keep future options open
          const score = mobility * 10 + outward + piece.size * 3;

          if (!best || score > best.score) best = { pieceId, at, shape, score };
        }
      }
    }
  }
  return best;
}
