import React, { useEffect, useRef } from "react";
import { botMove } from "../../bots";
import { useGame } from "../../GameProvider";

const BOT_BASE_DELAY_MS = 850;
const BOT_JITTER_MS = 250;
const botDelay = () =>
  BOT_BASE_DELAY_MS + (Math.random() * 2 - 1) * BOT_JITTER_MS;

export const BotController: React.FC<{
  preGameOverlayUp: boolean;
  onThinkingChange?: (thinking: boolean) => void;
}> = ({ preGameOverlayUp, onThinkingChange }) => {
  const { state, dispatch } = useGame();
  const botThinkingRef = useRef(false);

  useEffect(() => {
    const cur = state.current;
    const p = state.players[cur];

    if (preGameOverlayUp) return;
    if (!p?.isBot || state.winnerIds || botThinkingRef.current) return;

    botThinkingRef.current = true;
    onThinkingChange?.(true);

    const t = setTimeout(() => {
      const best = botMove(state, cur);
      if (!best) {
        dispatch({ type: "SKIP", pid: cur });
      } else {
        dispatch({
          type: "PLACE",
          pid: cur,
          pieceId: best.pieceId,
          shape: best.shape,
          at: best.at,
        });
      }
      botThinkingRef.current = false;
      onThinkingChange?.(false);
    }, botDelay());

    return () => clearTimeout(t);
  }, [
    state.current,
    state.winnerIds,
    state.players,
    state.board,
    state.meta?.rollPending,
    state.meta?.lastRoll,
    state.meta?.showedRollOnce,
    preGameOverlayUp,
  ]);

  return null;
};
