import React, { createContext, useContext, useMemo, useReducer } from "react";
import { ALL_PIECE_IDS } from "./pieces";
import {
  BOARD_SIZE,
  PLAYER_COLORS, // ["blue","yellow","red","green"]
  applyMove,
  hasAnyLegalMove,
  isGameOver,
} from "./rules";
import { GameState, PlayerColor, PlayerId, PlayerState } from "./types";

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

/** ---------- Actions ---------- */
type Action =
  | { type: "START"; humans: number; seed?: string } // seed optional
  | { type: "HUMAN_ROLL" } // rolls for next human in queue
  | {
      type: "PLACE";
      pid: PlayerId;
      pieceId: string;
      shape: number[][];
      at: { x: number; y: number };
    }
  | { type: "SKIP"; pid: PlayerId }
  | { type: "MARK_ROLL_SHOWN" };

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
      const humans = (action.humans === 1 ? 1 : 4) as 1 | 4;
      const players = buildPlayers(humans);

      // seed & match id
      const matchId = makeMatchId();
      const rngSeed = action.seed ?? matchId; // default: use matchId

      // queue human seats (in seat index order)
      const rollQueue: PlayerId[] = players
        .filter((p) => !p.isBot)
        .map((p) => p.id);

      return {
        ...state,
        board: makeEmptyBoard(),
        players,
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
              resolved[idx] = { id, value: nextValue(id, iter) };
            }
          }
        }
      }

      // 6) sort & remap to Blue→Yellow→Red→Green order
      resolved.sort((a, b) => b.value - a.value);
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
          showedRollOnce: false,
        },
      };
    }

    case "PLACE": {
      const next: GameState = applyMove(
        state,
        action.pid,
        action.pieceId,
        action.shape,
        action.at
      );

      next.players = next.players.map((p: PlayerState) => ({
        ...p,
        active: hasAnyLegalMove(next.players, p.id, next.board),
      }));

      if (isGameOver(next.players, next.board) && !next.winnerIds) {
        const best = Math.min(...next.players.map((p) => p.score));
        next.winnerIds = next.players
          .filter((p) => p.score === best)
          .map((p) => p.id as PlayerId);
      }
      return next;
    }

    case "SKIP": {
      const players = state.players.map((p) =>
        p.id === action.pid ? { ...p, active: false } : p
      );
      const current = ((state.current + 1) % 4) as PlayerId;
      const winnerIds = isGameOver(players, state.board)
        ? players
            .slice()
            .sort((a, b) => a.score - b.score)
            .slice(0, 1)
            .map((p) => p.id as PlayerId)
        : null;
      return { ...state, players, current, winnerIds };
    }

    case "MARK_ROLL_SHOWN": {
      return {
        ...state,
        meta: { ...(state.meta || {}), showedRollOnce: true },
      };
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
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useGame() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGame outside provider");
  return ctx;
}
