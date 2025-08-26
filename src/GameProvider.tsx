import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { loadMatch, saveMatch } from "./persist";
import { Action, initial, reducer } from "./state/reducer";
import { GameState } from "./types";

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
