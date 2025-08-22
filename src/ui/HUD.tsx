import React, { useEffect, useState } from "react";
import {
  Animated,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { botMove } from "../bots";
import { useGame } from "../GameProvider";
import { shadow } from "../helpers/shadow";
import { clearMatch, saveMatch } from "../persist";
import { BOARD_SIZE, isLegalMove } from "../rules";
import type { GameState, PieceId, PlayerId } from "../types";
import { AppLogo } from "./AppLogo";
import { Board } from "./Board";
import { BottomSheet } from "./BottomSheet";
import { PaletteFab } from "./buttons/PaletteFab";
import { Confetti } from "./Confetti";
import { DiceRollOverlay } from "./DiceRollOverlay";
import { PlaceIcon, RotateIcon } from "./icons/icons";
import { PlaceIconFilled, RotateIconFilled } from "./icons/iconsFilled";
import { FlipIcon, FlipIconFilled } from "./icons/iconsFlip";
import { PiecePalette } from "./PiecePalette";
import { ShortcutTooltip } from "./ShortcutTooltip";
import { usePalette } from "./theme";
import { TopBar } from "./TopBar";

let playStart = () => {};
try {
  // @ts-ignore
  ({ playStart } = require("../sfx"));
} catch {}

let playPlace = () => {};
let playInvalid = () => {};
try {
  // @ts-ignore
  ({ playPlace, playInvalid } = require("../sfx"));
} catch {}

type Shape = number[][];

const MIN_CELL = 16;
const MAX_CELL = 34;
const RAIL_W_OPEN = 380;
const RAIL_W_CLOSED = 48;
const H_GAP = 16; // gap between board and rail in wide layout
const H_PAD = 24;

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

function firstLegalNear(
  state: GameState,
  pid: PlayerId,
  shape: number[][],
  seedCell: { x: number; y: number }
) {
  const maxR = BOARD_SIZE; // small board; cheap spiral search
  for (let r = 0; r < maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const at = { x: seedCell.x + dx, y: seedCell.y + dy };
        if (isLegalMove(state, pid, shape, at)) return at;
      }
    }
  }
  return seedCell; // fallback
}

export const HUD: React.FC<{ onExitHome?: () => void }> = ({ onExitHome }) => {
  const { state, dispatch } = useGame();
  const pal = usePalette();
  const { width: vw } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = Platform.OS === "web" && vw >= 1024;
  const TOPBAR_H = 48;
  const introA = React.useRef(new Animated.Value(0)).current;
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

  // compute a responsive cell size primarily from available width
  const railW = isWide ? (railOpen ? RAIL_W_OPEN : RAIL_W_CLOSED) : 0;
  const availableW = isWide
    ? Math.max(240, vw - H_PAD * 2 - railW - H_GAP) // board column width
    : Math.max(240, vw - H_PAD * 2); // full width on narrow
  const cell = Math.max(
    MIN_CELL,
    Math.min(MAX_CELL, Math.floor(availableW / BOARD_SIZE))
  );
  const boardPx = BOARD_SIZE * cell; // board width == height

  const [ghostCell, setGhostCell] = useState<{ x: number; y: number } | null>(
    null
  );

  const BOT_BASE_DELAY_MS = 850; // was 220
  const BOT_JITTER_MS = 250; // +- random jitter
  const botDelay = () =>
    BOT_BASE_DELAY_MS + (Math.random() * 2 - 1) * BOT_JITTER_MS;
  const [botThinking, setBotThinking] = useState(false);

  const cur = state.players[state.current];
  const isVsBots = state.players.some((p) => p.isBot);
  const who = isVsBots ? (cur?.isBot ? "bot" : "you") : null;
  const curColorHex = cur ? pal.player[cur.id].fill : pal.text;

  // Any pre-game overlay active? (rolling to determine seats or showing results once)
  const preGameOverlayUp =
    !!state.meta?.rollPending ||
    (!!state.meta?.lastRoll && !state.meta?.showedRollOnce);

  // Show prompt if we need the human to roll
  const rollPending = !!state.meta?.rollPending;
  const rollQueue = state.meta?.rollQueue ?? [];
  const nextRollerId = rollQueue[0];
  // Which seat should the overlay show right now?
  const [rollFreezeSeat, setRollFreezeSeat] = React.useState<number | null>(
    null
  );
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
    .sort((a, b) => a.id - b.id) // seats P1..P4
    .map((r) => ({ seat: r.id + 1, value: r.value }));

  const rollerKey = overlaySeatId ?? -1; // force prompt reset per-seat

  const dismissRollResults = () => {
    // SFX
    playStart();
    // Animate board/controls in
    introA.setValue(0);
    Animated.timing(introA, {
      toValue: 1,
      duration: 420,
      useNativeDriver: Platform.OS !== "web",
    }).start();

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

    // Don’t think/place while any pre-game overlay is up
    if (
      state.meta?.rollPending ||
      (state.meta?.lastRoll && !state.meta?.showedRollOnce)
    ) {
      return;
    }

    if (!p?.isBot || state.winnerIds || botThinkingRef.current) return;

    botThinkingRef.current = true;
    setBotThinking(true);

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
      setBotThinking(false);
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
  ]);

  // choose from palette -> spawn ghost centered
  const handleChoose = (pieceId: PieceId, shape: Shape) => {
    setPending({ pieceId, shape });
    const seed = centerCellFor(shape);
    const at = firstLegalNear(state, state.current, shape, seed);
    setGhostCell(at);
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

  // confetti when game ends
  useEffect(() => {
    if (state.winnerIds && !confettiOn) setConfettiOn(true);
  }, [state.winnerIds]);

  const restart = async () => {
    // Clear the finished match before starting a new one
    try {
      await clearMatch();
    } catch {}
    const humans = state.players.filter((p) => !p.isBot).length as 1 | 4;
    dispatch({ type: "START", humans });
    setPending(null);
    setConfettiOn(false);
  };

  // --- mid-game exit guard ---
  const isMidGame = !!(
    !state.winnerIds &&
    (state.history.length > 0 || state.players.some((p) => p.hasPlayed))
  );

  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const requestExit = () => {
    if (!onExitHome) return;
    if (isMidGame) setConfirmExitOpen(true);
    else onExitHome();
  };

  // keep the latest onExitHome in a ref to avoid stale closures
  const onExitHomeRef = React.useRef<undefined | (() => void)>(onExitHome);
  React.useEffect(() => {
    onExitHomeRef.current = onExitHome;
  }, [onExitHome]);

  const confirmExit = () => {
    setConfirmExitOpen(false);
    // call on the next tick to let the overlay close cleanly
    requestAnimationFrame(() => {
      if (onExitHomeRef.current) {
        try {
          saveMatch(state);
          onExitHomeRef.current();
        } catch (e) {
          console.error("onExitHome threw:", e);
        }
      } else {
        // helpful during dev if the prop wasn't passed
        console.warn(
          "[HUD] onExitHome is undefined. Did you pass <HUD onExitHome={...} /> from your App/Home navigator?"
        );
      }
    });
  };

  const cancelExit = () => setConfirmExitOpen(false);

  // Android hardware back → confirm
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isMidGame && !confirmExitOpen) {
        setConfirmExitOpen(true);
        return true; // prevent default
      }
      return false;
    });
    return () => sub.remove();
  }, [isMidGame, confirmExitOpen]);

  // Web: warn on refresh/close if mid-game
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: BeforeUnloadEvent) => {
      if (isMidGame) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isMidGame]);

  // Shortcuts (web)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => {
      // Don’t allow shortcuts while roll overlay is up
      if (preGameOverlayUp) return;

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
        if (pending && ghostCell) {
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
  }, [pending, hoverCell, preGameOverlayUp]);

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

  const introScale = introA.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });
  const introOpacity = introA.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  React.useEffect(() => {
    if (!state.meta?.rollPending && !state.meta?.showedRollOnce) {
      // Safety run on first render of a match
      introA.setValue(0);
      Animated.timing(introA, {
        toValue: 1,
        duration: 420,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }
  }, []);

  return (
    <View
      style={{
        gap: 16,
        alignItems: "stretch",
        paddingTop: insets.top + TOPBAR_H + 8,
      }}
    >
      <TopBar
        matchId={state.meta?.matchId}
        botThinking={botThinking}
        onHelpPress={showShortcutsNow}
        onHomePress={requestExit}
      />
      <View style={{ alignItems: "center" }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            // alignItems: "center",
            width: "100%",
            paddingHorizontal: 8,
          }}
        >
          <AppLogo size={120} />
        </View>
        {preGameOverlayUp ? (
          <Text style={{ color: pal.text, fontSize: 18, fontWeight: "700" }}>
            Rolling for order…
          </Text>
        ) : (
          <Text style={{ color: pal.text, fontSize: 18, fontWeight: "700" }}>
            Turn:{" "}
            <Text style={{ color: curColorHex, fontWeight: "900" }}>
              {cur?.color.toUpperCase()}
            </Text>
            {who && <> [{who}]</>}
          </Text>
        )}
      </View>

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
            <Animated.View
              style={{
                transform: [{ scale: introScale }],
                opacity: introOpacity,
              }}
            >
              <Board
                cellSize={cell}
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
            </Animated.View>
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
                <PiecePalette
                  onChoose={handleChoose}
                  disabled={preGameOverlayUp}
                />
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
            <Animated.View
              style={{
                transform: [{ scale: introScale }],
                opacity: introOpacity,
              }}
            >
              <Board
                cellSize={cell}
                ghost={
                  pending && ghostCell
                    ? { shape: pending.shape, at: ghostCell }
                    : null
                }
                onGhostMove={(cell) => setGhostCell(cell)}
              />
            </Animated.View>
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
                  handleChoose(id, shape);
                  setSheetOpen(false);
                }}
                disabled={preGameOverlayUp}
              />
            </ScrollView>
          </BottomSheet>
        </>
      )}

      {/* Confirm leave mid-game */}
      {confirmExitOpen && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: 480,
              maxWidth: "92%",
              borderRadius: 12,
              backgroundColor: pal.card,
              padding: 20,
              borderWidth: 1,
              borderColor: pal.grid,
            }}
          >
            <Text
              style={{
                color: pal.text,
                fontSize: 18,
                fontWeight: "800",
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              Leave this game?
            </Text>
            <Text
              style={{
                color: pal.text,
                opacity: 0.85,
                textAlign: "center",
                marginBottom: 16,
              }}
            >
              Your current match will be discarded.
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                justifyContent: "center",
              }}
            >
              <Pressable
                onPress={cancelExit}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  backgroundColor: pal.btnBg,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: pal.grid,
                }}
              >
                <Text style={{ color: pal.btnText, fontWeight: "700" }}>
                  Stay
                </Text>
              </Pressable>
              <Pressable
                onPress={confirmExit}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  backgroundColor: pal.accent,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  Leave game
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
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

      {/* Dice prompt while in roll phase (each human in turn) */}
      {rollPending && nextRollerLabel && (
        <DiceRollOverlay
          mode="prompt"
          rollerLabel={nextRollerLabel}
          onRoll={() => {
            // remember which seat just rolled; unfreeze after 1s
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

      {/* One-time final results overlay after resolving order */}
      {showRollResults && state.meta?.lastRoll && (
        <DiceRollOverlay
          mode="result"
          rolls={state.meta.lastRoll}
          tieBreaks={state.meta?.tieBreaks || {}}
          onDone={dismissRollResults}
        />
      )}

      {/* End-game overlay with confetti */}
      {state.winnerIds && (
        <View
          style={{
            position: "absolute",
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
              ...shadow(10),
            }}
          >
            <Text
              style={{
                color: pal.text,
                fontSize: 22,
                fontWeight: "800",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              Game Over 🎉
            </Text>
            <Text
              style={{ color: pal.text, marginBottom: 16, textAlign: "center" }}
            >
              Winner{state.winnerIds.length > 1 ? "s" : ""}:{" "}
              <Text
                style={{
                  color: pal.player[state.winnerIds![0]].fill,
                  fontWeight: "900",
                }}
              >
                {state.players[state.winnerIds![0]].color.toUpperCase()}
              </Text>
            </Text>
            <View style={{ gap: 6, marginBottom: 16 }}>
              {state.players.map((p) => {
                const isWinner = state.winnerIds?.includes(p.id);
                const colorHex = pal.player[p.id].fill;
                const bg = isWinner ? "#ffffff10" : "transparent";
                const border = isWinner ? pal.accent : "transparent";
                const weight = isWinner ? ("800" as const) : ("600" as const);

                return (
                  <View
                    key={p.id}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 8,
                      backgroundColor: bg,
                      borderWidth: isWinner ? 1 : 0,
                      borderColor: border,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Text style={{ color: colorHex, fontWeight: weight }}>
                      {p.color.toUpperCase()}
                    </Text>
                    <Text
                      style={{
                        color: pal.text,
                        opacity: 0.9,
                        fontWeight: weight,
                      }}
                    >
                      score: {p.score}
                    </Text>
                  </View>
                );
              })}
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
              {onExitHome && (
                <Pressable
                  onPress={async () => {
                    try {
                      await clearMatch();
                    } catch {}
                    onExitHome();
                  }}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    backgroundColor: pal.btnBg,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: pal.grid,
                  }}
                >
                  <Text style={{ color: pal.btnText, fontWeight: "700" }}>
                    Main menu
                  </Text>
                </Pressable>
              )}
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
