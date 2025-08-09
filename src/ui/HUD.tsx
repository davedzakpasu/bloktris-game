import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { botMove } from "../bots";
import { useGame } from "../GameProvider";
import { BOARD_SIZE, isLegalMove } from "../rules";
import type { PieceId } from "../types";
import { Board } from "./Board";
import { BottomSheet } from "./BottomSheet";
import { HelpButton } from "./buttons/HelpButton";
import { PaletteFab } from "./buttons/PaletteFab";
import { Confetti } from "./Confetti";
import { DiceRollOverlay } from "./DiceRollOverlay";
import { PlaceIcon, RotateIcon } from "./icons/icons";
import { PlaceIconFilled, RotateIconFilled } from "./icons/iconsFilled";
import { FlipIcon, FlipIconFilled } from "./icons/iconsFlip";
import { MatchBadge } from "./MatchBadge";
import { PiecePalette } from "./PiecePalette";
import { ShortcutTooltip } from "./ShortcutTooltip";
import { usePalette } from "./theme";

let playPlace = () => {};
let playInvalid = () => {};
try {
  // @ts-ignore
  ({ playPlace, playInvalid } = require("../sfx"));
} catch {}

type Shape = number[][];
const CELL = 24;

function centerCellFor(shape: Shape) {
  const h = shape.length;
  const w = shape[0].length;
  const x = Math.max(0, Math.floor((BOARD_SIZE - w) / 2));
  const y = Math.max(0, Math.floor((BOARD_SIZE - h) / 2));
  return { x, y };
}

function rotate90(m: Shape): Shape {
  const h = m.length,
    w = m[0].length;
  const out = Array.from({ length: w }, () => Array(h).fill(0));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) out[x][h - 1 - y] = m[y][x];
  return out;
}
function flipH(m: Shape): Shape {
  return m.map((r) => [...r].reverse());
}

export const HUD: React.FC = () => {
  const { state, dispatch } = useGame();
  const pal = usePalette();
  const { width: vw } = useWindowDimensions();
  const isWide = Platform.OS === "web" && vw >= 1024;

  const [showShortcuts, setShowShortcuts] = useState(true);
  const [pending, setPending] = useState<{
    pieceId: PieceId;
    shape: Shape;
  } | null>(null);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(
    null
  );
  const [confettiOn, setConfettiOn] = useState(false);
  const [railOpen, setRailOpen] = useState(true); // ← collapsible rail

  const [sheetOpen, setSheetOpen] = useState(false);

  const boardPx = BOARD_SIZE * CELL; // board width == height

  const [ghostCell, setGhostCell] = useState<{ x: number; y: number } | null>(
    null
  );

  const cur = state.players[state.current];
  const isVsBots = state.players.some((p) => p.isBot);
  const who = isVsBots ? (cur?.isBot ? "bot" : "you") : null;
  const curColorHex = cur ? usePalette().player[cur.id].fill : pal.text;

  // Show prompt if we need the human to roll
  const rollPending = !!state.meta?.rollPending;
  const rollQueue = state.meta?.rollQueue ?? [];
  const nextRollerId = rollQueue[0];
  const nextRollerColor =
    nextRollerId != null
      ? state.players.find((p) => p.id === nextRollerId)?.color
      : undefined;

  const dismissRollResults = () => {
    setShowRollResults(false);
    dispatch({ type: "MARK_ROLL_SHOWN" });
  };

  // After roll resolves, show results once
  const [showRollResults, setShowRollResults] = useState(false);
  useEffect(() => {
    if (!rollPending && state.meta?.lastRoll && !state.meta?.showedRollOnce) {
      setShowRollResults(true);
    }
  }, [rollPending, state.meta?.lastRoll, state.meta?.showedRollOnce]);

  const onDiceResultsDone = () => {
    setShowRollResults(false);
    dispatch({ type: "MARK_ROLL_SHOWN" });
  };

  // Auto-play bots when it's their turn
  const botThinkingRef = React.useRef(false);
  useEffect(() => {
    const cur = state.current;
    const p = state.players[cur];
    if (!p?.isBot || state.winnerIds || botThinkingRef.current) return;

    botThinkingRef.current = true;
    // small delay for UX & to batch updates
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
      botThinkingRef.current = false; // allow next bot (if any) to proceed on next state tick
    }, 220);

    return () => clearTimeout(t);
  }, [state.current, state.winnerIds, state.players, state.board]);

  const [showRoll, setShowRoll] = useState(false);

  useEffect(() => {
    // Show only if we have fresh rolls and haven’t shown yet
    if (
      state.meta?.lastRoll &&
      !state.meta?.showedRollOnce &&
      state.history.length === 0
    ) {
      setShowRoll(true);
    }
  }, [state.meta?.lastRoll, state.meta?.showedRollOnce, state.history.length]);

  const onDiceDone = () => {
    setShowRoll(false);
    // mark shown in state (add a small action)
    dispatch({ type: "MARK_ROLL_SHOWN" });
  };

  // choose from palette -> spawn ghost centered
  const onChoose = (pieceId: PieceId, shape: Shape) => {
    setPending({ pieceId, shape });
    setGhostCell(centerCellFor(shape));
  };

  // rotate/flip controls under board
  const clampGhost = (shape: Shape, cell: { x: number; y: number } | null) => {
    if (!cell) return null;
    const h = shape.length,
      w = shape[0].length;
    return {
      x: Math.max(0, Math.min(BOARD_SIZE - w, cell.x)),
      y: Math.max(0, Math.min(BOARD_SIZE - h, cell.y)),
    };
  };

  const rotate = () =>
    setPending((p) => {
      if (!p) return p;
      const nextShape = rotate90(p.shape);
      setGhostCell((gc) => clampGhost(nextShape, gc));
      return { ...p, shape: nextShape };
    });

  const flip = () =>
    setPending((p) => {
      if (!p) return p;
      const nextShape = flipH(p.shape);
      setGhostCell((gc) => clampGhost(nextShape, gc));
      return { ...p, shape: nextShape };
    });

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

  // place uses the ghost cell
  const canPlaceHere =
    !!(pending && ghostCell) &&
    isLegalMove(state, state.current, pending.shape, ghostCell);

  const placeAtHover = () => {
    if (!pending || !ghostCell) {
      playInvalid();
      return;
    }
    if (!canPlaceHere) {
      playInvalid();
      return;
    }
    placeAt(ghostCell.x, ghostCell.y);
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

  // confetti when game ends
  useEffect(() => {
    if (state.winnerIds && !confettiOn) setConfettiOn(true);
  }, [state.winnerIds]);

  const restart = () => {
    const humans = state.players.filter((p) => !p.isBot).length as 1 | 4;
    dispatch({ type: "START", humans });
    setPending(null);
    setConfettiOn(false);
  };

  // Shortcuts (web)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      const editing =
        tag === "input" ||
        tag === "textarea" ||
        (t?.isContentEditable ?? false);
      if (editing) return;

      if (e.key === "r" || e.key === "R") {
        if (pending) {
          e.preventDefault();
          rotate();
        }
      } else if (e.key === "f" || e.key === "F") {
        if (pending) {
          e.preventDefault();
          flip();
        }
      } else if (e.key === "Enter" || e.key === " ") {
        if (pending && hoverCell) {
          e.preventDefault();
          placeAtHover();
        }
      } else if (e.key === "Escape") {
        if (pending) {
          e.preventDefault();
          setPending(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, hoverCell]);

  // Tooltip persistence
  useEffect(() => {
    if (Platform.OS !== "web") return;
    try {
      const v = window.localStorage.getItem("bloktris.shortcuts.hidden");
      if (v === "1") setShowShortcuts(false);
    } catch {}
  }, []);

  const dismissShortcuts = () => {
    setShowShortcuts(false);
    if (Platform.OS === "web")
      try {
        window.localStorage.setItem("bloktris.shortcuts.hidden", "1");
      } catch {}
  };

  const showShortcutsNow = () => {
    setShowShortcuts(true);
    if (Platform.OS === "web")
      try {
        window.localStorage.removeItem("bloktris.shortcuts.hidden");
      } catch {}
  };

  return (
    <View style={{ gap: 16, alignItems: "stretch" }}>
      <View style={{ alignItems: "center" }}>
        <Text style={{ color: pal.text, fontSize: 18, fontWeight: "700" }}>
          Turn:{" "}
          <Text style={{ color: curColorHex, fontWeight: "900" }}>
            {cur?.color.toUpperCase()}
          </Text>
          {who && <> [{who}]</>}
        </Text>
      </View>
      {state.meta?.matchId && <MatchBadge id={state.meta.matchId} />}
      {/* ====== Wide layout: Board (center) + Right palette rail (collapsible) ====== */}
      {isWide ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: 16,
            alignItems: "flex-start",
          }}
        >
          {/* Left column: board + control row */}
          <View style={{ alignItems: "center" }}>
            <Board
              ghost={
                pending && ghostCell
                  ? { shape: pending.shape, at: ghostCell }
                  : null
              }
              onGhostMove={(cell) => setGhostCell(cell)}
            />

            {/* Controls under the board */}
            <View style={{ alignItems: "center", marginTop: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                  justifyContent: "center",
                }}
              >
                <ControlButton
                  label="Rotate"
                  onPress={rotate}
                  bg={pal.btnBg}
                  activeBg={pal.accent}
                  textColor={pal.btnText}
                  textColorActive="#fff"
                  Icon={RotateIcon}
                  IconActive={RotateIconFilled}
                  disabled={!pending}
                />
                <ControlButton
                  label="Flip"
                  onPress={flip}
                  bg={pal.btnBg}
                  activeBg={pal.accent}
                  textColor={pal.btnText}
                  textColorActive="#fff"
                  Icon={FlipIcon}
                  IconActive={FlipIconFilled}
                  disabled={!pending}
                />
                <ControlButton
                  label="Pick & Place"
                  onPress={placeAtHover}
                  bg={pal.accent}
                  activeBg={pal.accent}
                  textColor="#fff"
                  textColorActive="#fff"
                  Icon={PlaceIcon}
                  IconActive={PlaceIconFilled}
                  disabled={!canPlaceHere}
                />
              </View>
              <Text
                style={{
                  color: pal.text,
                  opacity: 0.7,
                  marginTop: 6,
                  textAlign: "center",
                }}
              >
                {pending
                  ? canPlaceHere
                    ? "Rotate/Flip then press Pick & Place (or click a legal cell)."
                    : "Rotate/Flip and hover a legal cell to enable Pick & Place."
                  : "Pick a piece from the palette to begin."}
              </Text>
            </View>
          </View>

          {/* Right column: collapsible palette rail (same visual height as board) */}
          <View
            style={{
              width: railOpen ? 380 : 48,
              height: boardPx,
              borderRadius: 12,
              backgroundColor: pal.card,
              borderWidth: 1,
              borderColor: pal.grid,
              overflow: "hidden",
            }}
          >
            {/* Rail header (collapse) */}
            <View
              style={{
                height: 44,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 8,
                borderBottomWidth: 1,
                borderBottomColor: pal.grid,
              }}
            >
              <Text style={{ color: pal.text, fontWeight: "800" }}>
                {railOpen ? "Palette" : ""}
              </Text>
              <Pressable
                onPress={() => setRailOpen((v) => !v)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: pal.btnBg,
                }}
              >
                <Text style={{ color: pal.btnText, fontWeight: "900" }}>
                  {railOpen ? "»" : "«"}
                </Text>
              </Pressable>
            </View>

            {/* Scrollable content */}
            {railOpen ? (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 8, gap: 8 }}
              >
                <PiecePalette onChoose={onChoose} />
              </ScrollView>
            ) : (
              <View style={{ flex: 1 }} />
            )}
          </View>
        </View>
      ) : (
        /* ====== Narrow layout: board top, controls, then palette below ====== */
        <>
          <View style={{ alignItems: "center" }}>
            <Board
              ghost={
                pending && ghostCell
                  ? { shape: pending.shape, at: ghostCell }
                  : null
              }
              onGhostMove={(cell) => setGhostCell(cell)}
            />
          </View>

          {/* Controls under the board */}
          <View style={{ alignItems: "center" }}>
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                justifyContent: "center",
              }}
            >
              <ControlButton
                label="Rotate"
                onPress={rotate}
                bg={pal.btnBg}
                activeBg={pal.accent}
                textColor={pal.btnText}
                textColorActive="#fff"
                Icon={RotateIcon}
                IconActive={RotateIconFilled}
                disabled={!pending}
              />
              <ControlButton
                label="Flip"
                onPress={flip}
                bg={pal.btnBg}
                activeBg={pal.accent}
                textColor={pal.btnText}
                textColorActive="#fff"
                Icon={FlipIcon}
                IconActive={FlipIconFilled}
                disabled={!pending}
              />
              <ControlButton
                label="Pick & Place"
                onPress={placeAtHover}
                bg={pal.accent}
                activeBg={pal.accent}
                textColor="#fff"
                textColorActive="#fff"
                Icon={PlaceIcon}
                IconActive={PlaceIconFilled}
                disabled={!canPlaceHere}
              />
            </View>
            <Text
              style={{
                color: pal.text,
                opacity: 0.7,
                marginTop: 6,
                textAlign: "center",
              }}
            >
              {pending
                ? canPlaceHere
                  ? "Rotate/Flip then press Pick & Place (or tap a legal cell)."
                  : "Rotate/Flip and hover a legal cell to enable Pick & Place."
                : "Pick a piece from the palette to begin."}
            </Text>
          </View>

          {/* Palette drawer trigger */}
          <PaletteFab onPress={() => setSheetOpen(true)} />

          {/* Bottom sheet palette */}
          <BottomSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="Palette"
          >
            <ScrollView
              style={{ maxHeight: "100%" }}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <PiecePalette
                onChoose={(id, shape) => {
                  setPending({ pieceId: id, shape });
                  setSheetOpen(false);
                }}
              />
            </ScrollView>
          </BottomSheet>
        </>
      )}

      {showShortcuts && (
        <ShortcutTooltip
          onDismiss={() => {
            setShowShortcuts(false);
            if (Platform.OS === "web")
              try {
                window.localStorage.setItem("bloktris.shortcuts.hidden", "1");
              } catch {}
          }}
          canPlace={canPlaceHere}
        />
      )}

      {/* Cancel / Skip row */}
      <View style={{ flexDirection: "row", gap: 12, justifyContent: "center" }}>
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

      {!showShortcuts && (
        <HelpButton
          onPress={showShortcutsNow}
          position="top-right" // 👈 stays clear of the Palette FAB
          offset={16}
        />
      )}

      {/* Dice prompt while in roll phase (each human in turn) */}
      {rollPending && nextRollerColor && (
        <DiceRollOverlay
          mode="prompt"
          rollerColor={nextRollerColor}
          onRoll={() => dispatch({ type: "HUMAN_ROLL" })}
        />
      )}

      {/* One-time final results overlay after resolving order */}
      {showRollResults && state.meta?.lastRoll && (
        <DiceRollOverlay
          mode="result"
          rolls={state.meta.lastRoll}
          onDone={dismissRollResults}
        />
      )}

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
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                justifyContent: "center",
              }}
            >
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

/** Small reusable button with press feedback */
const ControlButton: React.FC<{
  label: string;
  onPress: () => void;
  bg: string;
  activeBg: string;
  textColor: string;
  textColorActive: string;
  Icon: React.FC<{ size?: number; color?: string }>;
  IconActive: React.FC<{ size?: number; color?: string }>;
  disabled?: boolean;
}> = ({
  label,
  onPress,
  bg,
  activeBg,
  textColor,
  textColorActive,
  Icon,
  IconActive,
  disabled,
}) => {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 8,
        backgroundColor: disabled ? "#9993" : pressed ? activeBg : bg,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {pressed ? (
        <IconActive size={18} color={textColorActive} />
      ) : (
        <Icon size={18} color={textColor} />
      )}
      <Text
        style={{
          color: pressed ? textColorActive : textColor,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};
