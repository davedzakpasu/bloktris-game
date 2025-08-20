import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { loadMatch, saveMatch } from "./persist";
import { ALL_PIECE_IDS, PIECE_SIZES } from "./pieces";
import {
  BOARD_SIZE,
  PLAYER_COLORS, // ["blue","yellow","red","green"]
  applyMove,
  hasAnyLegalMove,
  isGameOver,
} from "./rules";
import {
  GameState,
  PieceId,
  PlayerColor,
  PlayerId,
  PlayerState,
} from "./types";

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
  const pad = (n: number) => n.toString().padStart(2, "0");
  const date = `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${date}-${rand}`;
}

/** ---------- Helpers ---------- */
function makeEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}
function buildPlayers(humans: 1 | 4): PlayerState[] {
  const ids: PlayerId[] = [0, 1, 2, 3];
  return ids.map((id) => ({
    id,
    color: PLAYER_COLORS[id], // placeholder; will be reassigned after dice
    remaining: [...ALL_PIECE_IDS],
    hasPlayed: false,
    isBot: humans === 1 ? id !== 0 : false, // seat 0 is human in 1vBots
    score: 0,
    active: true,
  }));
}

function scoreForRemaining(remaining: PieceId[]) {
  return remaining.reduce((sum, id) => sum + PIECE_SIZES[id], 0);
}

function normalizeBoard(b: any): (PlayerId | null)[][] {
  const size = BOARD_SIZE;
  if (!Array.isArray(b) || b.length === 0) return makeEmptyBoard();
  const h = b.length;
  const w = Array.isArray(b[0]) ? b[0].length : 0;
  const out = Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) =>
      y < h && x < w ? b[y][x] ?? null : null
    )
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
  }>
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

function sanitizeSavedState(raw: any): GameState | null {
  try {
    // Basic shape checks
    if (!raw || !Array.isArray(raw.players) || raw.players.length !== 4)
      return null;

    let board = normalizeBoard(raw.board);
    const history = Array.isArray(raw.history) ? raw.history : [];

    // If the saved board is empty but we have history, rebuild it.
    if (!boardHasAnyTiles(board) && history.length) {
      board = boardFromHistory(history);
    }

    // Coerce players array to ids [0..3] and clamp fields
    const playersById = new Map<number, any>();
    for (const p of raw.players) playersById.set(p.id, p);
    const players: PlayerState[] = [0, 1, 2, 3].map((id) => {
      const p = playersById.get(id) || {};
      const remaining = Array.isArray(p.remaining)
        ? (p.remaining.filter((pid: any) =>
            (ALL_PIECE_IDS as any).includes(pid)
          ) as PieceId[])
        : [...ALL_PIECE_IDS];
      return {
        id: id as PlayerId,
        color: (p.color ?? PLAYER_COLORS[id]) as PlayerColor,
        remaining,
        hasPlayed: !!p.hasPlayed,
        isBot: !!p.isBot,
        score: 0, // recompute below
        active: true, // recompute below
      };
    });

    // Recompute hasPlayed from history (more reliable than old saves)
    const played = new Set<number>();
    for (const m of history) {
      if (m && typeof m.player === "number") played.add(m.player);
    }
    for (const p of players) p.hasPlayed = p.hasPlayed || played.has(p.id);

    // Recompute scores & active flags
    for (const p of players) p.score = scoreForRemaining(p.remaining);

    // Current player clamp
    let current: PlayerId = ((typeof raw.current === "number"
      ? raw.current
      : 0) % 4) as PlayerId;

    // Winner ids normalization (ensure null or int[])
    let winnerIds: PlayerId[] | null = null;
    if (Array.isArray(raw.winnerIds) && raw.winnerIds.length) {
      winnerIds = raw.winnerIds.map((n: any) => (Number(n) % 4) as PlayerId);
    }

    // Meta defaults
    const meta = {
      ...(raw.meta || {}),
      matchId: raw.meta?.matchId || makeMatchId(),
      rollPending: !!raw.meta?.rollPending && false, // never resume into roll UI
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
type Action =
  | { type: "START"; humans: 1 | 4; seed?: string } // seed optional
  | { type: "HUMAN_ROLL" } // rolls for next human in queue
  | {
      type: "PLACE";
      pid: PlayerId;
      pieceId: string;
      shape: number[][];
      at: { x: number; y: number };
    }
  | { type: "SKIP"; pid: PlayerId }
  | { type: "MARK_ROLL_SHOWN" }
  | { type: "HYDRATE"; payload: GameState };

/** ---------- Initial ---------- */
const initial: GameState = {
  board: makeEmptyBoard(),
  players: [],
  current: 0,
  history: [],
  winnerIds: null,
  meta: {}, // see types.ts MatchMeta
};

/** ---------- Reducer ---------- */
function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "START": {
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
        },
      };
    }

    case "HUMAN_ROLL": {
      if (!state.meta?.rollPending || !state.meta.rollQueue?.length)
        return state;

      const baseColors = PLAYER_COLORS as readonly [
        PlayerColor,
        PlayerColor,
        PlayerColor,
        PlayerColor
      ];
      const { rngSeed, rolls: rawRolls = [] } = state.meta;

      // 1) who rolls now?
      const rollerId = state.meta.rollQueue[0];

      // 2) compute human's roll deterministically from seed + rollerId + "H"
      const die = seededDie(`${rngSeed}-H-${rollerId}`);
      const humanValue = die();

      // write it
      const rolls = rawRolls.map((r) =>
        r.id === rollerId ? { ...r, value: humanValue } : r
      );

      // 3) still more humans to roll? keep prompting
      const remainingQueue = state.meta.rollQueue.slice(1);
      if (remainingQueue.length > 0) {
        return {
          ...state,
          meta: {
            ...state.meta,
            rolls,
            rollQueue: remainingQueue,
            rollPending: true,
          },
        };
      }

      // 4) no humans left — auto-roll bots deterministically
      const botFilled = rolls.map((r) => {
        if (r.value != null) return r;
        const dieBot = seededDie(`${rngSeed}-B-${r.id}`);
        return { ...r, value: dieBot() };
      }) as { id: PlayerId; value: number }[];

      // 5) tie-break deterministically using incrementing salts
      let resolved = botFilled.slice();
      const tieBreaks: Record<PlayerId, { from: number; to: number }> =
        {} as any;
      const nextValue = (id: PlayerId, iter: number) =>
        seededDie(`${rngSeed}-TB-${id}-${iter}`)();

      const hasTies = () => {
        const map: Record<number, PlayerId[]> = {};
        for (const r of resolved) (map[r.value] ||= []).push(r.id);
        return Object.values(map).some((ids) => ids.length > 1);
      };

      for (let iter = 1; iter <= 10 && hasTies(); iter++) {
        const groups: Record<number, number[] /*indices*/> = {};
        resolved.forEach((r, idx) => {
          (groups[r.value] ||= []).push(idx);
        });
        for (const k of Object.keys(groups)) {
          const g = groups[+k];
          if (g.length > 1) {
            // re-roll tied seats only
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

      resolved.sort((a, b) => b.value - a.value || a.id - b.id);

      if (hasTies()) {
        // final deterministic tie-break
        resolved = resolved
          .map((r) => ({ ...r, value: r.value })) // (no change)
          .sort((a, b) => b.value - a.value || a.id - b.id);
      }

      // 6) sort & remap to Blue→Yellow→Red→Green order
      resolved.sort((a, b) => b.value - a.value || a.id - b.id);
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
          ...state.meta,
          rollPending: false,
          rollQueue: [],
          rolls: resolved,
          lastRoll: resolved.map((r, i) => ({
            color: baseColors[i],
            value: r.value,
          })),
          tieBreaks,
          showedRollOnce: false,
        },
      };
    }

    case "PLACE": {
      const next = applyMove(
        state,
        action.pid,
        action.pieceId,
        action.shape,
        action.at
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

    case "SKIP": {
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

    case "MARK_ROLL_SHOWN": {
      return {
        ...state,
        meta: { ...(state.meta || {}), showedRollOnce: true },
      };
    }

    case "HYDRATE": {
      const s = sanitizeSavedState(action.payload);
      return s ? s : state;
    }

    default:
      return state;
  }
}

/** ---------- Context ---------- */
const Ctx = createContext<{
  state: GameState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(reducer, initial);

  // Hydrate once on mount if a saved match exists
  const hydratedRef = useRef(false);
  useEffect(() => {
    (async () => {
      const saved = await loadMatch();
      if (saved && saved.players?.length === 4) {
        dispatch({ type: "HYDRATE", payload: saved });
        hydratedRef.current = true;
      }
    })();
  }, []);

  // Auto-save whenever a "real" game state exists
  useEffect(() => {
    if (state.players.length === 0) return; // skip initial empty
    // Save on next tick so heavy renders aren’t blocked
    const id = requestAnimationFrame(() => {
      saveMatch(state);
    });
    return () => cancelAnimationFrame(id);
  }, [
    state.board,
    state.players,
    state.current,
    state.history.length,
    state.winnerIds,
    state.meta,
  ]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useGame() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGame outside provider");
  return ctx;
}
