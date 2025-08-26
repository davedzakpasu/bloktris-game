import { BOARD_SIZE } from '../constants';
import { ALL_PIECE_IDS } from '../pieces';
import {
  PLAYER_COLORS,
  applyMove,
  hasAnyLegalMove,
  isGameOver,
} from '../rules';
import {
  GameState,
  PieceId,
  PlacedPiece,
  PlayerColor,
  PlayerId,
  PlayerState,
} from '../types';
import { buildPlayers, makeEmptyBoard, scoreForRemaining } from './helpers';

/** ---------- Seeded RNG utilities ---------- */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function strToSeed(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededDie(seed: string) {
  const rnd = mulberry32(strToSeed(seed));
  return () => 1 + Math.floor(rnd() * 6);
}
function makeMatchId() {
  const t = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const date = `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${date}-${rand}`;
}

/** ---------- Helpers ---------- */
function normalizeBoard(b: unknown): (PlayerId | null)[][] {
  const size = BOARD_SIZE;
  if (!Array.isArray(b) || b.length === 0) return makeEmptyBoard();
  const rows = b as unknown[];
  const out = Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      const row = Array.isArray(rows[y]) ? (rows[y] as unknown[]) : null;
      const cell = row && row[x];
      return typeof cell === 'number' ? ((cell % 4) as PlayerId) : null;
    }),
  );
  return out;
}

function boardHasAnyTiles(b: (PlayerId | null)[][]): boolean {
  for (let y = 0; y < b.length; y++)
    for (let x = 0; x < b[0].length; x++) if (b[y][x] !== null) return true;
  return false;
}

function boardFromHistory(
  history: Array<{
    player: PlayerId;
    at: { x: number; y: number };
    shape: number[][];
  }>,
): (PlayerId | null)[][] {
  const b = makeEmptyBoard();
  for (const mv of history) {
    const { player, at, shape } = mv || {};
    if (!shape || !Array.isArray(shape)) continue;
    for (let yy = 0; yy < shape.length; yy++) {
      for (let xx = 0; xx < shape[0].length; xx++) {
        if (shape[yy][xx]) {
          const gx = at.x + xx,
            gy = at.y + yy;
          if (gx >= 0 && gy >= 0 && gx < BOARD_SIZE && gy < BOARD_SIZE) {
            b[gy][gx] = player;
          }
        }
      }
    }
  }
  return b;
}

function sanitizeSavedState(raw: unknown): GameState | null {
  try {
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as Record<string, unknown>;
    if (!Array.isArray(obj.players) || obj.players.length !== 4) return null;

    let board = normalizeBoard(obj.board);
    const rawHistory = Array.isArray(obj.history)
      ? (obj.history as unknown[])
      : [];

    const isPlacedPiece = (mv: unknown): mv is PlacedPiece =>
      !!mv &&
      typeof mv === 'object' &&
      typeof (mv as { player?: unknown }).player === 'number' &&
      typeof (mv as { at?: unknown }).at === 'object' &&
      typeof (mv as { at?: { x?: unknown } }).at?.x === 'number' &&
      typeof (mv as { at?: { y?: unknown } }).at?.y === 'number' &&
      Array.isArray((mv as { shape?: unknown }).shape);

    const history: PlacedPiece[] = rawHistory.filter(
      isPlacedPiece,
    ) as PlacedPiece[];

    // If the saved board is empty but we have history, rebuild it.
    if (!boardHasAnyTiles(board) && history.length) {
      board = boardFromHistory(history);
    }

    // Helper to validate piece ids
    const isPieceId = (pid: unknown): pid is PieceId =>
      typeof pid === 'string' &&
      (ALL_PIECE_IDS as readonly string[]).includes(pid);

    // Coerce players array to ids [0..3] and clamp fields
    const playersById = new Map<number, Record<string, unknown>>();
    for (const p of obj.players as unknown[]) {
      if (
        p &&
        typeof p === 'object' &&
        'id' in p &&
        typeof (p as { id: unknown }).id === 'number'
      ) {
        playersById.set((p as { id: number }).id, p as Record<string, unknown>);
      }
    }
    const players: PlayerState[] = [0, 1, 2, 3].map((id) => {
      const p = playersById.get(id);
      const rawRemaining = p?.['remaining'];
      const remaining = Array.isArray(rawRemaining)
        ? (rawRemaining as unknown[]).filter(isPieceId)
        : [...ALL_PIECE_IDS];
      const rawColor = p?.['color'];
      const color =
        typeof rawColor === 'string' &&
        (PLAYER_COLORS as readonly string[]).includes(rawColor)
          ? (rawColor as PlayerColor)
          : PLAYER_COLORS[id];
      return {
        id: id as PlayerId,
        color,
        remaining,
        hasPlayed: !!p?.['hasPlayed'],
        isBot: !!p?.['isBot'],
        score: 0, // recompute below
        active: true, // recompute below
      };
    });

    // Recompute hasPlayed from history (more reliable than old saves)
    const played = new Set<number>();
    for (const m of history) {
      played.add(m.player);
    }
    for (const p of players) p.hasPlayed = p.hasPlayed || played.has(p.id);

    // Recompute scores & active flags
    for (const p of players) p.score = scoreForRemaining(p.remaining);

    // Current player clamp
    const current: PlayerId = ((typeof obj.current === 'number'
      ? obj.current
      : 0) % 4) as PlayerId;

    // Winner ids normalization (ensure null or int[])
    let winnerIds: PlayerId[] | null = null;
    if (Array.isArray(obj.winnerIds) && obj.winnerIds.length) {
      winnerIds = obj.winnerIds.map((n) => (Number(n) % 4) as PlayerId);
    }

    // Meta defaults
    const rawMeta = obj.meta;
    const metaSource =
      rawMeta && typeof rawMeta === 'object'
        ? (rawMeta as Record<string, unknown>)
        : {};
    const meta = {
      ...metaSource,
      matchId:
        typeof metaSource['matchId'] === 'string'
          ? (metaSource['matchId'] as string)
          : makeMatchId(),
      rollPending: !!metaSource['rollPending'] && false, // never resume into roll UI
      showedRollOnce: true, // suppress roll overlay after resume
      hydrated: true,
    };

    // Build preliminary state
    let s: GameState = { board, players, current, history, winnerIds, meta };

    // Refresh active flags using current rules
    s.players = s.players.map((p) => ({
      ...p,
      active: hasAnyLegalMove(s.players, p.id, s.board),
      score: scoreForRemaining(p.remaining),
    }));

    // If persisted state forgot winners but game is effectively over, compute them
    if (!s.winnerIds && isGameOver(s.players, s.board)) {
      const best = Math.min(...s.players.map((p) => p.score));
      s.winnerIds = s.players.filter((p) => p.score === best).map((p) => p.id);
    }

    // Clamp current to a still-active slot if the saved one is unusable
    if (!s.players[s.current]?.active) {
      // rotate until we find someone who can move, or keep as-is if nobody can
      for (let i = 1; i <= 4; i++) {
        const pid = ((s.current + i) % 4) as PlayerId;
        if (s.players[pid].active) {
          s = { ...s, current: pid };
          break;
        }
      }
    }

    return s;
  } catch {
    return null;
  }
}

/** ---------- Actions ---------- */
export type Action =
  | { type: 'START'; humans: 1 | 4; seed?: string } // seed optional
  | { type: 'HUMAN_ROLL' } // rolls for next human in queue
  | { type: 'BOT_ROLL'; pid: PlayerId }
  | {
      type: 'PLACE';
      pid: PlayerId;
      pieceId: string;
      shape: number[][];
      at: { x: number; y: number };
    }
  | { type: 'SKIP'; pid: PlayerId }
  | { type: 'MARK_ROLL_SHOWN' }
  | { type: 'HYDRATE'; payload: GameState };

/** ---------- Initial ---------- */
export const initial: GameState = {
  board: makeEmptyBoard(),
  players: [],
  current: 0,
  history: [],
  winnerIds: null,
  meta: {}, // see types.ts MatchMeta
};

/** ---------- Reducer ---------- */
export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START': {
      const humans = action.humans;
      const players = buildPlayers(humans);

      // seed & match id
      const matchId = makeMatchId();
      const rngSeed = action.seed ?? matchId; // default: use matchId

      // queue human seats (in seat index order)
      const rollQueue: PlayerId[] = players
        .filter((p) => !p.isBot)
        .map((p) => p.id);

      const playersWithScores = players.map((p) => ({
        ...p,
        score: scoreForRemaining(p.remaining),
      }));

      return {
        ...state,
        board: makeEmptyBoard(),
        players: playersWithScores,
        current: 0, // temp
        history: [],
        winnerIds: null,
        meta: {
          matchId,
          rngSeed,
          rollPending: true,
          rollQueue,
          rolls: players.map((p) => ({ id: p.id, value: null })),
          lastRoll: undefined,
          showedRollOnce: false,
          botQueue: [],
        },
      };
    }

    case 'HUMAN_ROLL': {
      if (!state.meta?.rollPending || !state.meta.rollQueue?.length)
        return state;

      const baseColors = PLAYER_COLORS as readonly [
        PlayerColor,
        PlayerColor,
        PlayerColor,
        PlayerColor,
      ];
      const { rngSeed, rolls: rawRolls = [] } = state.meta;

      // 1) who rolls now?
      const rollerId = state.meta.rollQueue[0];

      // 2) deterministic human roll
      const die = seededDie(`${rngSeed}-H-${rollerId}`);
      const humanValue = die();

      // 3) write it back into the seat-indexed rolls
      const seatRolls = rawRolls.map((r) =>
        r.id === rollerId ? { ...r, value: humanValue } : r,
      );

      // 4) still humans left?
      const remainingQueue = state.meta.rollQueue.slice(1);
      if (remainingQueue.length > 0) {
        return {
          ...state,
          meta: {
            ...state.meta,
            rolls: seatRolls,
            rollQueue: remainingQueue,
            rollPending: true,
          },
        };
      }

      // 5) no humans left → fill bots deterministically but keep seat index
      const filled = seatRolls.map((r) => {
        if (r.value != null) return r;
        const dieBot = seededDie(`${rngSeed}-B-${r.id}`);
        return { ...r, value: dieBot() };
      }) as { id: PlayerId; value: number }[];

      // 6) resolve ties deterministically (reroll tied seats by salt)
      const resolved = filled.slice();
      const nextValue = (id: PlayerId, iter: number) =>
        seededDie(`${rngSeed}-TB-${id}-${iter}`)();

      const hasTies = () => {
        const map: Record<number, PlayerId[]> = {};
        for (const r of resolved) (map[r.value] ||= []).push(r.id);
        return Object.values(map).some((ids) => ids.length > 1);
      };

      for (let iter = 1; iter <= 10 && hasTies(); iter++) {
        const groups: Record<number, number[]> = {};
        resolved.forEach((r, idx) => (groups[r.value] ||= []).push(idx));
        for (const k of Object.keys(groups)) {
          const g = groups[+k];
          if (g.length > 1) {
            for (const idx of g) {
              const id = resolved[idx].id;
              resolved[idx] = { id, value: nextValue(id, iter) };
            }
          }
        }
      }

      // 7) compute final order by value (desc), ties by id (asc)
      const order = resolved
        .slice()
        .sort((a, b) => b.value - a.value || a.id - b.id)
        .map((r) => r.id); // e.g. [2,0,3,1] (seat ids)

      // 8) Build display rows (Blue..Green with values) without touching players yet
      const lookup = new Map(resolved.map((r) => [r.id, r.value]));
      const lastRoll = order.map((oldSeatId, i) => ({
        color: baseColors[i],
        value: lookup.get(oldSeatId)!,
      }));

      return {
        ...state,
        // keep players & board untouched here
        meta: {
          ...state.meta,
          rolls: resolved, // seat-indexed (id = original seat)
          order, // array of seat ids in Blue..Green order
          lastRoll, // for the result overlay
          rollPending: false,
          rollQueue: [],
          showedRollOnce: false,
        },
      };
    }

    case 'BOT_ROLL': {
      const meta = state.meta || {};
      const { rngSeed, botQueue = [], rolls: rawRolls = [] } = meta;

      // If pid isn't in the queue (or there is no queue), ignore
      if (!botQueue.includes(action.pid)) return state;

      // 1) write bot value (seeded)
      const dieBot = seededDie(`${rngSeed}-B-${action.pid}`);
      const value = dieBot();
      const rolls = rawRolls.map((r) =>
        r.id === action.pid ? { ...r, value } : r,
      );

      const remaining = botQueue.filter((id) => id !== action.pid);

      // 2) if there are still bots left, just update queue & rolls
      if (remaining.length > 0) {
        return {
          ...state,
          meta: { ...meta, rolls, botQueue: remaining },
        };
      }

      // 3) last bot done → resolve ties, compute final order, reorder seats
      //    (Same logic you had in HUMAN_ROLL, but fed by the freshly-completed rolls)
      const baseColors = PLAYER_COLORS as readonly [
        PlayerColor,
        PlayerColor,
        PlayerColor,
        PlayerColor,
      ];

      let resolved = rolls as { id: PlayerId; value: number }[];
      const tieBreaks: Record<PlayerId, { from: number; to: number }> = {
        0: {
          from: 0,
          to: 0,
        },
        1: {
          from: 0,
          to: 0,
        },
        2: {
          from: 0,
          to: 0,
        },
        3: {
          from: 0,
          to: 0,
        },
      };
      const nextValue = (id: PlayerId, iter: number) =>
        seededDie(`${rngSeed}-TB-${id}-${iter}`)();

      const hasTies = () => {
        const map: Record<number, PlayerId[]> = {};
        for (const r of resolved) (map[r.value] ||= []).push(r.id);
        return Object.values(map).some((ids) => ids.length > 1);
      };

      // deterministic re-roll among tied groups until ties break (bounded)
      for (let iter = 1; iter <= 10 && hasTies(); iter++) {
        const groups: Record<number, number[]> = {};
        resolved.forEach((r, idx) => {
          (groups[r.value] ||= []).push(idx);
        });
        for (const k of Object.keys(groups)) {
          const g = groups[+k];
          if (g.length > 1) {
            for (const idx of g) {
              const id = resolved[idx].id;
              const from = resolved[idx].value;
              const to = nextValue(id, iter);
              if (!(id in tieBreaks)) tieBreaks[id] = { from, to };
              else tieBreaks[id].to = to;
              resolved[idx] = { id, value: to };
            }
          }
        }
      }

      // final sort: higher die first; break persistent ties by lower seat id
      resolved = resolved
        .slice()
        .sort((a, b) => b.value - a.value || a.id - b.id);

      // map old seat ids -> new Blue..Green order
      const order = resolved.map((r) => r.id); // e.g. [2,0,3,1]
      const reordered = order.map((oldId, idx) => {
        const p = state.players[oldId];
        return {
          ...p,
          id: idx as PlayerId,
          color: baseColors[idx],
        };
      });

      return {
        ...state,
        board: makeEmptyBoard(),
        players: reordered,
        current: 0 as PlayerId, // Blue starts
        history: [],
        winnerIds: null,
        meta: {
          ...meta,
          botQueue: [], // drained
          rolls: resolved, // final seat-id + value pairs (old ids)
          lastRoll: resolved.map((r, i) => ({
            color: baseColors[i],
            value: r.value,
          })),
          tieBreaks,
          showedRollOnce: false, // HUD will show the results overlay once
        },
      };
    }

    case 'PLACE': {
      const next = applyMove(
        state,
        action.pid,
        action.pieceId,
        action.shape,
        action.at,
      );

      // refresh active (pass is final) + recompute scores in ONE place
      next.players = next.players.map((p) => ({
        ...p,
        active: p.active && hasAnyLegalMove(next.players, p.id, next.board),
        score: scoreForRemaining(p.remaining),
      }));

      if (isGameOver(next.players, next.board) && !next.winnerIds) {
        const best = Math.min(...next.players.map((p) => p.score));
        next.winnerIds = next.players
          .filter((p) => p.score === best)
          .map((p) => p.id);
      }
      return next;
    }

    case 'SKIP': {
      const players = state.players
        .map((p) => (p.id === action.pid ? { ...p, active: false } : { ...p }))
        .map((p) => ({ ...p, score: scoreForRemaining(p.remaining) }));

      const current = ((state.current + 1) % 4) as PlayerId;
      const winnerIds = isGameOver(players, state.board)
        ? (() => {
            const best = Math.min(...players.map((p) => p.score));
            return players.filter((p) => p.score === best).map((p) => p.id);
          })()
        : null;

      return { ...state, players, current, winnerIds };
    }

    case 'MARK_ROLL_SHOWN': {
      const meta = state.meta || {};
      const baseColors = PLAYER_COLORS as readonly [
        PlayerColor,
        PlayerColor,
        PlayerColor,
        PlayerColor,
      ];

      // If we already reordered or no order was computed, just mark and bail.
      if (!meta.order || meta.order.length !== 4) {
        return { ...state, meta: { ...meta, showedRollOnce: true } };
      }

      // Rebuild players in Blue→Yellow→Red→Green order, *moving* seat identities.
      const reordered = meta.order.map((oldSeatId, idx) => {
        const p = state.players[oldSeatId];
        return {
          ...p,
          id: idx as PlayerId,
          color: baseColors[idx],
        };
      });

      // Clear the order so we don't reorder again if MARK_ROLL_SHOWN fires twice
      const newMeta = { ...meta, showedRollOnce: true, order: undefined };

      return {
        ...state,
        players: reordered,
        current: 0 as PlayerId, // Blue starts after results are acknowledged
        meta: newMeta,
      };
    }

    case 'HYDRATE': {
      const s = sanitizeSavedState(action.payload);
      return s ? s : state;
    }

    default:
      return state;
  }
}
