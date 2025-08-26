import { BOARD_SIZE } from "./constants";
import { ORIENTATIONS } from "./pieces";
import {
  Coord,
  GameState,
  Orientation,
  PieceDef,
  PlayerId,
  PlayerState,
  Shape,
} from "./types";

// Build a matrix from coords, normalized to top-left at 0,0
export function coordsToShape(cells: Coord[]): Shape {
  const maxX = Math.max(...cells.map((c) => c.x));
  const maxY = Math.max(...cells.map((c) => c.y));
  const m: Shape = Array.from({ length: maxY + 1 }, () =>
    Array(maxX + 1).fill(0)
  );
  cells.forEach(({ x, y }) => (m[y][x] = 1));
  return m;
}

const rotate90 = (m: Shape): Shape => {
  const h = m.length,
    w = m[0].length;
  const out = Array.from({ length: w }, () => Array(h).fill(0));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) out[x][h - 1 - y] = m[y][x];
  return out;
};
const flipH = (m: Shape): Shape => m.map((row) => [...row].reverse());

const normalize = (m: Shape): Shape => {
  // trim empty rows/cols
  let top = 0,
    bottom = m.length - 1,
    left = 0,
    right = m[0].length - 1;
  while (top <= bottom && m[top].every((v) => v === 0)) top++;
  while (bottom >= top && m[bottom].every((v) => v === 0)) bottom--;
  while (left <= right && m.every((row) => row[left] === 0)) left++;
  while (right >= left && m.every((row) => row[right] === 0)) right--;
  const out: Shape = [];
  for (let y = top; y <= bottom; y++) out.push(m[y].slice(left, right + 1));
  return out.length ? out : [[0]];
};

const shapeKey = (m: Shape) => m.map((r) => r.join("")).join("/");

export function orientationsOf(piece: PieceDef): Orientation[] {
  const base = coordsToShape(piece.cells);
  const set = new Map<string, Shape>();
  let cur = normalize(base);
  for (let r = 0; r < 4; r++) {
    const rot = r === 0 ? cur : normalize(rotate90(cur));
    const flip = normalize(flipH(rot));
    [rot, flip].forEach((s) => set.set(shapeKey(s), s));
    cur = rot;
  }
  return [...set.values()];
}

export const PLAYER_COLORS = ["blue", "yellow", "red", "green"] as const;
export const PLAYER_CORNERS: Record<PlayerId, Coord> = {
  0: { x: 0, y: 0 },
  1: { x: BOARD_SIZE - 1, y: 0 },
  2: { x: BOARD_SIZE - 1, y: BOARD_SIZE - 1 },
  3: { x: 0, y: BOARD_SIZE - 1 },
};

export function isInsideBoard(
  shape: Shape,
  at: Coord,
  boardW = BOARD_SIZE,
  boardH = BOARD_SIZE
): boolean {
  const h = shape.length,
    w = shape[0].length;
  return at.x >= 0 && at.y >= 0 && at.x + w <= boardW && at.y + h <= boardH;
}

export function wouldOverlap(
  board: (PlayerId | null)[][],
  shape: Shape,
  at: Coord
): boolean {
  for (let y = 0; y < shape.length; y++) {
    const gy = at.y + y;
    const row = board[gy];
    // Defensive: if the row doesn't exist, treat as overlap (invalid placement)
    if (!row) return true;

    for (let x = 0; x < shape[0].length; x++) {
      if (!shape[y][x]) continue;
      const gx = at.x + x;
      const cell = row[gx];
      if (cell !== null && cell !== undefined) return true;
    }
  }
  return false;
}

const DIR4 = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];
const DIAG4 = [
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

// Collect empty cells that are diagonal-adjacent to pid (and not side-adjacent).
function diagonalAnchors(board: (PlayerId | null)[][], pid: PlayerId): Coord[] {
  const out: Coord[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== null) continue; // must be empty
      // must have at least one diagonal neighbor of same color
      let hasDiag = false;
      for (const d of DIAG4) {
        const nx = x + d.x,
          ny = y + d.y;
        if (nx < 0 || ny < 0 || nx >= BOARD_SIZE || ny >= BOARD_SIZE) continue;
        if (board[ny][nx] === pid) {
          hasDiag = true;
          break;
        }
      }
      if (!hasDiag) continue;
      // must not touch same color by side at this anchor cell
      let sideTouch = false;
      for (const d of DIR4) {
        const nx = x + d.x,
          ny = y + d.y;
        if (nx < 0 || ny < 0 || nx >= BOARD_SIZE || ny >= BOARD_SIZE) continue;
        if (board[ny][nx] === pid) {
          sideTouch = true;
          break;
        }
      }
      if (!sideTouch) out.push({ x, y });
    }
  }
  return out;
}

export function touchSideSame(
  board: (PlayerId | null)[][],
  pid: PlayerId,
  shape: Shape,
  at: Coord
): boolean {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[0].length; x++) {
      if (!shape[y][x]) continue;
      const gx = at.x + x,
        gy = at.y + y;
      for (const d of DIR4) {
        const nx = gx + d.x,
          ny = gy + d.y;
        if (nx < 0 || ny < 0 || nx >= BOARD_SIZE || ny >= BOARD_SIZE) continue;
        if (board[ny][nx] === pid) return true;
      }
    }
  }
  return false;
}

export function touchCornerSame(
  board: (PlayerId | null)[][],
  pid: PlayerId,
  shape: Shape,
  at: Coord
): boolean {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[0].length; x++) {
      if (!shape[y][x]) continue;
      const gx = at.x + x,
        gy = at.y + y;
      for (const d of DIAG4) {
        const nx = gx + d.x,
          ny = gy + d.y;
        if (nx < 0 || ny < 0 || nx >= BOARD_SIZE || ny >= BOARD_SIZE) continue;
        if (board[ny][nx] === pid) return true;
      }
    }
  }
  return false;
}

export function firstMoveCoversCorner(
  shape: Shape,
  at: Coord,
  corner: Coord
): boolean {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[0].length; x++) {
      if (shape[y][x] && at.x + x === corner.x && at.y + y === corner.y)
        return true;
    }
  }
  return false;
}

export function isLegalMove(
  state: GameState,
  pid: PlayerId,
  shape: Shape,
  at: Coord
): boolean {
  const boardH = state.board.length || BOARD_SIZE;
  const boardW = state.board[0]?.length || BOARD_SIZE;

  if (!isInsideBoard(shape, at, boardW, boardH)) return false;
  if (wouldOverlap(state.board, shape, at)) return false;
  if (touchSideSame(state.board, pid, shape, at)) return false;

  const player = state.players[pid];
  if (!player.hasPlayed) {
    return firstMoveCoversCorner(shape, at, PLAYER_CORNERS[pid]);
  } else {
    return touchCornerSame(state.board, pid, shape, at);
  }
}

export function applyMove(
  state: GameState,
  pid: PlayerId,
  pieceId: string,
  shape: Shape,
  at: Coord
): GameState {
  const board = state.board.map((row) => [...row]);

  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[0].length; x++) {
      if (shape[y][x]) {
        board[at.y + y][at.x + x] = pid;
      }
    }
  }
  const players = state.players.map((p) => {
    if (p.id !== pid) return p;
    return {
      ...p,
      hasPlayed: true,
      remaining: p.remaining.filter((id) => id !== pieceId),
      // score recomputed in reducer from remaining
    };
  });

  const history = [
    ...state.history,
    { pieceId: pieceId as any, player: pid, at, shape },
  ];
  const next = nextPlayer(players, pid, board);

  const winnerIds = isGameOver(players, board) ? winners(players) : null;

  return { ...state, board, players, history, current: next, winnerIds };
}

function nextPlayer(
  players: PlayerState[],
  cur: PlayerId,
  board: (PlayerId | null)[][]
): PlayerId {
  for (let i = 1; i <= 4; i++) {
    const pid = ((cur + i) % 4) as PlayerId;
    if (players[pid].active && hasAnyLegalMove(players, pid, board)) return pid;
  }
  return cur; // will be frozen; gameOver detection will handle
}

export function hasAnyLegalMove(
  players: PlayerState[],
  pid: PlayerId,
  board: (PlayerId | null)[][]
): boolean {
  const dummy: GameState = {
    board,
    players,
    current: pid,
    history: [],
    winnerIds: null,
  };
  const p = players[pid];
  // candidate anchors
  const anchors = !p.hasPlayed
    ? [PLAYER_CORNERS[pid]] // first move: corner only
    : diagonalAnchors(board, pid);

  if (anchors.length === 0) return false;

  // Try placing each orientation such that some filled cell aligns at an anchor.
  for (const pieceId of p.remaining) {
    const orients = ORIENTATIONS[pieceId];
    for (const o of orients) {
      // precompute filled local offsets of this orientation
      const cells: Coord[] = [];
      for (let yy = 0; yy < o.length; yy++)
        for (let xx = 0; xx < o[0].length; xx++)
          if (o[yy][xx]) cells.push({ x: xx, y: yy });

      for (const anchor of anchors) {
        for (const c of cells) {
          const at = { x: anchor.x - c.x, y: anchor.y - c.y };
          if (isLegalMove(dummy, pid, o, at)) return true;
        }
      }
    }
  }
  return false;
}

export function isGameOver(
  players: PlayerState[],
  board: (PlayerId | null)[][]
): boolean {
  // Over if no active players can move
  const anyone = [0, 1, 2, 3].some((pid) => {
    const p = players[pid as PlayerId];
    return p.active && hasAnyLegalMove(players, pid as PlayerId, board);
  });
  return !anyone;
}

function winners(players: PlayerState[]): PlayerId[] {
  const best = Math.min(...players.map((p) => p.score));
  return players.filter((p) => p.score === best).map((p) => p.id as PlayerId);
}
