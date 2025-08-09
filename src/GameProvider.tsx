import React, { createContext, useContext, useMemo, useReducer } from "react";
import { ALL_PIECE_IDS } from "./pieces";
import {
  BOARD_SIZE,
  PLAYER_COLORS,
  applyMove,
  hasAnyLegalMove,
  isGameOver,
} from "./rules";
import { GameState, PlayerId, PlayerState } from "./types";

type Action =
  | { type: "START"; humans: number } // 1 or 4
  | {
      type: "PLACE";
      pid: PlayerId;
      pieceId: string;
      shape: number[][];
      at: { x: number; y: number };
    }
  | { type: "SKIP"; pid: PlayerId };

const initial: GameState = {
  board: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null)),
  players: [],
  current: 0,
  history: [],
  winnerIds: null,
};

function makePlayers(humans: number): PlayerState[] {
  const ids: PlayerId[] = [0, 1, 2, 3];
  return ids.map((id) => ({
    id,
    color: PLAYER_COLORS[id],
    remaining: [...ALL_PIECE_IDS],
    hasPlayed: false,
    isBot: humans === 1 ? (id === 0 ? false : true) : false,
    score: 0,
    active: true,
  }));
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "START": {
      return {
        board: Array.from({ length: BOARD_SIZE }, () =>
          Array(BOARD_SIZE).fill(null)
        ),
        players: makePlayers(action.humans),
        current: 0,
        history: [],
        winnerIds: null,
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

      // refresh active flags
      next.players = next.players.map((p: PlayerState) => ({
        ...p,
        active: hasAnyLegalMove(next.players, p.id, next.board),
      }));

      // If it’s over and winners not set, set them
      if (isGameOver(next.players, next.board) && !next.winnerIds) {
        const best = Math.min(...next.players.map((p) => p.score));
        next.winnerIds = next.players
          .filter((p) => p.score === best)
          .map((p) => p.id);
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
            .sort((a, b) => a.score - b.score)
            .slice(0, 1)
            .map((p) => p.id as PlayerId)
        : null;
      return { ...state, players, current, winnerIds };
    }
    default:
      return state;
  }
}

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
