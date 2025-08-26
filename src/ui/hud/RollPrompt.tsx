import React, { useEffect, useState } from "react";
import { useGame } from "../../GameProvider";
import { DiceRollOverlay } from "../DiceRollOverlay";

export const RollPrompt: React.FC<{ onRollResultsDone?: () => void }> = ({
  onRollResultsDone,
}) => {
  const { state, dispatch } = useGame();
  const rollPending = !!state.meta?.rollPending;
  const rollQueue = state.meta?.rollQueue ?? [];
  const nextRollerId = rollQueue[0];
  const [rollFreezeSeat, setRollFreezeSeat] = useState<number | null>(null);

  const overlaySeatId = rollFreezeSeat ?? nextRollerId;
  const nextRollerLabel =
    overlaySeatId != null
      ? (() => {
          const humans = state.players.filter((p) => !p.isBot).length;
          return humans === 1 ? "You" : `Player ${overlaySeatId + 1}`;
        })()
      : undefined;

  const currentRollValue =
    overlaySeatId != null
      ? state.meta?.rolls?.find((r) => r.id === overlaySeatId)?.value ?? null
      : null;

  const partial = (state.meta?.rolls ?? [])
    .sort((a, b) => a.id - b.id)
    .map((r) => ({ seat: r.id + 1, value: r.value }));

  const rollerKey = overlaySeatId ?? -1;

  const [showRollResults, setShowRollResults] = useState(false);
  useEffect(() => {
    if (!rollPending && state.meta?.lastRoll && !state.meta?.showedRollOnce) {
      setShowRollResults(true);
    }
  }, [rollPending, state.meta?.lastRoll, state.meta?.showedRollOnce]);

  const dismissRollResults = () => {
    setShowRollResults(false);
    dispatch({ type: "MARK_ROLL_SHOWN" });
    onRollResultsDone?.();
  };

  return (
    <>
      {rollPending && nextRollerLabel && (
        <DiceRollOverlay
          mode="prompt"
          rollerLabel={nextRollerLabel}
          onRoll={() => {
            const justRolled = nextRollerId;
            dispatch({ type: "HUMAN_ROLL" });
            if (justRolled != null) {
              setRollFreezeSeat(justRolled);
              setTimeout(() => setRollFreezeSeat(null), 1000);
            }
          }}
          revealedValue={currentRollValue}
          partial={partial}
          rollerKey={rollerKey}
          lockRollButton={rollFreezeSeat != null}
        />
      )}
      {showRollResults && state.meta?.lastRoll && (
        <DiceRollOverlay
          mode="result"
          rolls={state.meta.lastRoll}
          tieBreaks={state.meta?.tieBreaks || {}}
          onDone={dismissRollResults}
        />
      )}
    </>
  );
};
