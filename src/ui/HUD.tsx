import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { botMove } from "../bots";
import { useGame } from "../GameProvider";
import { isLegalMove } from "../rules";
import type { PieceId } from "../types";
import { Board } from "./Board";
import { Confetti } from "./Confetti";
import { PiecePalette } from "./PiecePalette";
import { usePalette } from "./theme";

// Optional SFX: safe to import even if you haven't added files yet
let playPlace = () => {};
let playInvalid = () => {};
try {
  // If you created sfx.ts as earlier suggested, this will work.
  // Otherwise these no-ops keep things from crashing.
  // @ts-ignore
  ({ playPlace, playInvalid } = require("../sfx"));
} catch {}

export const HUD: React.FC = () => {
  const { state, dispatch } = useGame();
  const pal = usePalette();
  const [pending, setPending] = useState<{
    pieceId: PieceId;
    shape: number[][];
  } | null>(null);
  const [confettiOn, setConfettiOn] = useState(false);

  const onChoose = (pieceId: PieceId, shape: number[][]) =>
    setPending({ pieceId, shape });

  const placeAt = (x: number, y: number) => {
    if (!pending) return;
    if (!isLegalMove(state, state.current, pending.shape, { x, y })) {
      playInvalid();
      return;
    }
    dispatch({
      type: "PLACE",
      pid: state.current,
      pieceId: pending.pieceId,
      shape: pending.shape,
      at: { x, y },
    });
    playPlace();
    setPending(null);
    maybeBot();
  };

  const maybeBot = () => {
    setTimeout(() => {
      const cur = state.current;
      const p = state.players[cur];
      if (p?.isBot && !state.winnerIds) {
        const best = botMove(state, cur);
        if (!best) dispatch({ type: "SKIP", pid: cur });
        else
          dispatch({
            type: "PLACE",
            pid: cur,
            pieceId: best.pieceId,
            shape: best.shape,
            at: best.at,
          });
      }
    }, 200);
  };

  // Fire confetti when winners appear
  useEffect(() => {
    if (state.winnerIds && !confettiOn) setConfettiOn(true);
  }, [state.winnerIds]);

  const restart = () => {
    const humans = state.players.filter((p) => !p.isBot).length as 1 | 4;
    dispatch({ type: "START", humans });
    setPending(null);
    setConfettiOn(false);
  };

  return (
    <View style={{ gap: 16 }}>
      <Text style={{ color: pal.text, fontSize: 18, fontWeight: "700" }}>
        Turn: {state.players[state.current]?.color.toUpperCase()}
      </Text>

      <View style={{ flexDirection: "row", gap: 24, alignItems: "flex-start" }}>
        <Board
          pending={
            pending ? { shape: pending.shape, pieceId: pending.pieceId } : null
          }
          onCellClick={placeAt}
        />
        <View style={{ width: 420 }}>
          <PiecePalette onChoose={onChoose} />
          <View style={{ height: 12 }} />
          <Text style={{ color: pal.text, opacity: 0.8 }}>
            Click a board cell to place the highlighted shape.
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Pressable
          onPress={() => setPending(null)}
          style={{ padding: 10, backgroundColor: pal.btnBg, borderRadius: 6 }}
        >
          <Text style={{ color: pal.btnText }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => dispatch({ type: "SKIP", pid: state.current })}
          style={{ padding: 10, backgroundColor: pal.btnBg, borderRadius: 6 }}
        >
          <Text style={{ color: pal.btnText }}>Skip</Text>
        </Pressable>
      </View>

      {/* End-game overlay with confetti */}
      {state.winnerIds && (
        <View
          style={{
            position: "fixed" as any,
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,.55)",
            padding: 24,
          }}
        >
          {confettiOn && <Confetti count={140} />}

          <View
            style={{
              width: 520,
              maxWidth: "90%",
              backgroundColor: pal.card,
              borderRadius: 12,
              padding: 24,
              shadowColor: "#000",
              shadowOpacity: 0.25,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
            }}
          >
            <Text
              style={{
                color: pal.text,
                fontSize: 22,
                fontWeight: "800",
                marginBottom: 8,
              }}
            >
              Game Over 🎉
            </Text>
            <Text style={{ color: pal.text, marginBottom: 16 }}>
              Winner{state.winnerIds.length > 1 ? "s" : ""}:{" "}
              <Text style={{ fontWeight: "700" }}>
                {state.winnerIds
                  .map((id) => state.players[id].color.toUpperCase())
                  .join(", ")}
              </Text>
            </Text>

            <View style={{ gap: 6, marginBottom: 16 }}>
              {state.players.map((p) => (
                <Text key={p.id} style={{ color: pal.text, opacity: 0.9 }}>
                  {p.color.toUpperCase()} — score: {p.score}
                </Text>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={restart}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  backgroundColor: pal.accent,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  Play again
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};
