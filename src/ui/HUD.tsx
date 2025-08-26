import React, { useEffect, useState } from 'react';
import {
  Animated,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { botMove } from '../bots';
import { BOARD_SIZE } from '../constants';
import { useGame } from '../GameProvider';
import { shadow } from '../helpers/shadow';
import { clearMatch, saveMatch } from '../persist';
import { isLegalMove } from '../rules';
import type { GameState, PieceId, PlayerId } from '../types';
import { AppLogo } from './AppLogo';
import { Board } from './Board';
import { BottomSheet } from './BottomSheet';
import { PaletteFab } from './buttons/PaletteFab';
import { Confetti } from './Confetti';
import { DiceRollOverlay } from './DiceRollOverlay';
import { PlaceIcon, RotateIcon } from './icons/icons';
import { PlaceIconFilled, RotateIconFilled } from './icons/iconsFilled';
import { FlipIcon, FlipIconFilled } from './icons/iconsFlip';
import { PiecePalette } from './PiecePalette';
import { ShortcutTooltip } from './ShortcutTooltip';
import { usePalette } from './theme';
import { TopBar } from './TopBar';

type Shape = number[][];

const MIN_CELL = 16;
const MAX_CELL = 34;
const RAIL_W_OPEN = 380;
const RAIL_W_CLOSED = 48;
const H_GAP = 16; // gap between board and rail in wide layout
const H_PAD = 24;

const COLORS = {
  white: '#fff',
  overlayDim: 'rgba(0,0,0,0.55)',
  disabled: '#9993',
  winnerBg: '#ffffff10',
  transparent: 'transparent',
} as const;

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
  seedCell: { x: number; y: number },
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
  const { width: vw, height: vh } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = Platform.OS === 'web' && vw >= 1024;
  // const TOPBAR_H = 48;
  const introA = React.useRef(new Animated.Value(0)).current;
  const [showShortcuts, setShowShortcuts] = useState(true);
  const [pending, setPending] = useState<{
    pieceId: PieceId;
    shape: Shape;
  } | null>(null);
  const [confettiOn, setConfettiOn] = useState(false);
  const [railOpen, setRailOpen] = useState(true); // ← collapsible rail
  const [sheetOpen, setSheetOpen] = useState(false);

  // ---- optional SFX without require() ----
  type SfxModule = {
    playStart?: () => void;
    playPlace?: () => void;
    playInvalid?: () => void;
  };
  const sfxRef = React.useRef<SfxModule | null>(null);

  useEffect(() => {
    let mounted = true;
    // Optional dependency (web/CI may not have native sound)
    import('../sfx')
      .then((mod) => {
        if (!mounted) return;
        sfxRef.current = mod;
      })
      .catch((err) => {
        // best-effort: sounds are optional
        console.debug('[HUD] sfx module unavailable:', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const playStart = () => sfxRef.current?.playStart?.();
  const playPlace = () => sfxRef.current?.playPlace?.();
  const playInvalid = () => sfxRef.current?.playInvalid?.();

  // === Responsive board sizing (width AND height clamps) ===
  const railW = isWide ? (railOpen ? RAIL_W_OPEN : RAIL_W_CLOSED) : 0;

  // width-driven cell size
  const availableW = isWide
    ? Math.max(240, vw - H_PAD * 2 - railW - H_GAP)
    : Math.max(240, vw - H_PAD * 2);
  const cellFromWidth = Math.floor(availableW / BOARD_SIZE);

  // height-driven cell size (subtract chrome above/below the board)
  const TOPBAR_H = 56; // TopBar
  const TURN_LABEL_H = 28; // "Turn: ..."
  const CONTROLS_H = isWide ? 110 : 160; // Rotate/Flip/Place + hint
  const BOTTOM_PAD = 40; // breathing room
  const chromeH =
    insets.top +
    TOPBAR_H +
    TURN_LABEL_H +
    CONTROLS_H +
    BOTTOM_PAD +
    insets.bottom;
  const availableH = Math.max(240, vh - chromeH);
  const cellFromHeight = Math.floor(availableH / BOARD_SIZE);

  // final cell size (clamped)
  const cell = Math.max(
    MIN_CELL,
    Math.min(MAX_CELL, Math.min(cellFromWidth, cellFromHeight)),
  );

  // pixel board size for matching the rail’s height
  const boardPx = cell * BOARD_SIZE;

  const [ghostCell, setGhostCell] = useState<{ x: number; y: number } | null>(
    null,
  );

  const BOT_BASE_DELAY_MS = 850; // was 220
  const BOT_JITTER_MS = 250; // +- random jitter
  const botDelay = () =>
    BOT_BASE_DELAY_MS + (Math.random() * 2 - 1) * BOT_JITTER_MS;
  const [botThinking, setBotThinking] = useState(false);

  const cur = state.players[state.current];
  const isVsBots = state.players.some((p) => p.isBot);
  const who = isVsBots ? (cur?.isBot ? 'bot' : 'you') : null;
  const curColorHex = cur ? pal.player[cur.id].fill : pal.text;

  // Show prompt if we need the human to roll
  const rollPending = !!state.meta?.rollPending;
  const rollQueue = state.meta?.rollQueue ?? [];
  const nextRollerId = rollQueue[0];
  const [botShowcaseSeat, setBotShowcaseSeat] = React.useState<PlayerId | null>(
    null,
  );
  // one-time guard so the showcase can't restart while results are open
  const showcaseStartedRef = React.useRef(false);

  // convenience: are there any bots in this match?
  const botsInMatch = React.useMemo(
    () => state.players.some((p) => p.isBot),
    [state.players],
  );
  const [showRollResults, setShowRollResults] = useState(false);

  // Human roll “freeze” to avoid tap-spam and to keep the prompt up while value reveals
  const [rollFreezeSeat, setRollFreezeSeat] = React.useState<number | null>(
    null,
  );
  const overlaySeatId = rollFreezeSeat ?? botShowcaseSeat ?? nextRollerId;
  const nextRollerLabel =
    overlaySeatId != null
      ? (() => {
          const humans = state.players.filter((p) => !p.isBot).length;
          if (botShowcaseSeat !== null) return `Bot ${overlaySeatId + 1}`;
          return humans === 1 ? 'You' : `Player ${overlaySeatId + 1}`;
        })()
      : undefined;

  const currentRollValue =
    overlaySeatId != null
      ? (state.meta?.rolls?.find((r) => r.id === overlaySeatId)?.value ?? null)
      : null;

  const botQueue = state.meta?.botQueue ?? [];

  // 1) Sort rolls once
  const rollsSorted = React.useMemo(
    () => (state.meta?.rolls ?? []).slice().sort((a, b) => a.id - b.id),
    [state.meta?.rolls],
  );

  // 2) Chips while HUMANS are rolling: hide bots after the last human has rolled
  const partialHuman = React.useMemo(() => {
    const anyBots = state.players.some((p) => p.isBot);
    const maskBotsNow = anyBots && !rollPending && !state.meta?.showedRollOnce;
    return (state.meta?.rolls ?? [])
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((r) => ({
        seat: r.id + 1,
        value: maskBotsNow && state.players[r.id].isBot ? null : r.value,
      }));
  }, [
    state.players,
    state.meta?.rolls,
    rollPending,
    state.meta?.showedRollOnce,
  ]);

  // 4) Chips during BOT SHOWCASE: reveal up to current showcased bot
  const partialBot = React.useMemo(
    () =>
      rollsSorted.map((r) => {
        const isBot = state.players[r.id].isBot;
        return {
          seat: r.id + 1,
          value: isBot && botQueue.includes(r.id) ? null : r.value,
        };
      }),
    [rollsSorted, state.players, botQueue],
  );

  // Start bot showcase exactly once when the reducer publishes a botQueue
  useEffect(() => {
    if (rollPending) return; // still rolling humans
    if (!botsInMatch) return; // no bots → nothing to show
    if (showRollResults) return; // don't restart while results are open
    if (showcaseStartedRef.current) return;

    if (
      !rollPending &&
      botsInMatch &&
      botQueue.length > 0 &&
      !showcaseStartedRef.current
    ) {
      showcaseStartedRef.current = true;
      setBotShowcaseSeat(botQueue[0]);
    }
  }, [rollPending, botsInMatch, showRollResults, botQueue.length]);

  useEffect(() => {
    if (!showcaseStartedRef.current) return;
    if (botQueue.length === 0) {
      setBotShowcaseSeat(null);
      setShowRollResults(true);
    } else if (botShowcaseSeat !== botQueue[0]) setBotShowcaseSeat(botQueue[0]);
  }, [botQueue, botShowcaseSeat]);

  // Unfreeze when the head of the roll queue moves past the frozen seat
  React.useEffect(() => {
    if (rollFreezeSeat == null) return;
    const head = state.meta?.rollQueue?.[0];
    if (head !== rollFreezeSeat) {
      setRollFreezeSeat(null);
    }
  }, [state.meta?.rollQueue, rollFreezeSeat]);

  useEffect(() => {
    if (state.meta?.rollPending) {
      // new roll phase (or new match) begins
      showcaseStartedRef.current = false;
      setBotShowcaseSeat(null);
      setShowRollResults(false);
    }
  }, [state.meta?.rollPending, state.meta?.matchId]);

  // Any pre-game overlay active? (rolling to determine seats or showing results once)
  const preGameOverlayUp =
    !!state.meta?.rollPending ||
    botShowcaseSeat !== null ||
    (!!state.meta?.lastRoll && !state.meta?.showedRollOnce);

  const dismissRollResults = () => {
    // SFX
    playStart();
    // Animate board/controls in
    introA.setValue(0);
    Animated.timing(introA, {
      toValue: 1,
      duration: 420,
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    setShowRollResults(false);
    dispatch({ type: 'MARK_ROLL_SHOWN' });
    showcaseStartedRef.current = false;
  };

  // After roll resolves, show results once
  useEffect(() => {
    const anyBots = state.players.some((p) => p.isBot);
    if (!rollPending && state.meta?.lastRoll && !state.meta?.showedRollOnce) {
      if (!anyBots) setShowRollResults(true); // hot-seat only
    }
  }, [
    rollPending,
    state.meta?.lastRoll,
    state.meta?.showedRollOnce,
    state.players,
  ]);

  // Phase-aware key so human→bot transitions always remount prompt
  const phaseKey =
    (rollPending && nextRollerLabel && 'human') ||
    (botShowcaseSeat !== null && 'bot') ||
    (showRollResults && state.meta?.lastRoll && 'result') ||
    'none';
  const rollerKey = `${phaseKey}:${overlaySeatId ?? -1}`;

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
        dispatch({ type: 'SKIP', pid: cur });
      } else {
        dispatch({
          type: 'PLACE',
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
    if (!pending || preGameOverlayUp) return;
    if (!isLegalMove(state, state.current, pending.shape, { x, y })) {
      playInvalid();
      return;
    }
    dispatch({
      type: 'PLACE',
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
    if (!pending || !ghostCell || preGameOverlayUp) {
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
    } catch (e) {
      console.debug('[HUD] clearMatch failed:', e);
    }
    const humans = state.players.filter((p) => !p.isBot).length as 1 | 4;
    dispatch({ type: 'START', humans });
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
          console.error('onExitHome threw:', e);
        }
      } else {
        // helpful during dev if the prop wasn't passed
        console.warn(
          '[HUD] onExitHome is undefined. Did you pass <HUD onExitHome={...} /> from your App/Home navigator?',
        );
      }
    });
  };

  const cancelExit = () => setConfirmExitOpen(false);

  // Android hardware back → confirm
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
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
    if (Platform.OS !== 'web') return;
    const handler = (e: BeforeUnloadEvent) => {
      if (isMidGame) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isMidGame]);

  // Shortcuts (web)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      // Don’t allow shortcuts while roll overlay is up
      if (preGameOverlayUp) return;

      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      const editing =
        tag === 'input' ||
        tag === 'textarea' ||
        (t?.isContentEditable ?? false);
      if (editing) return;

      if (e.key === 'r' || e.key === 'R') {
        if (pending) {
          e.preventDefault();
          rotate();
        }
      } else if (e.key === 'f' || e.key === 'F') {
        if (pending) {
          e.preventDefault();
          flip();
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (pending && ghostCell) {
          e.preventDefault();
          placeAtHover();
        }
      } else if (e.key === 'Escape') {
        if (pending) {
          e.preventDefault();
          setPending(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, preGameOverlayUp]);

  // Tooltip persistence
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const v = window.localStorage.getItem('bloktris.shortcuts.hidden');
      if (v === '1') setShowShortcuts(false);
    } catch (e) {
      console.debug('[HUD] localStorage.getItem failed:', e);
    }
  }, []);

  const showShortcutsNow = () => {
    setShowShortcuts(true);
    if (Platform.OS === 'web')
      try {
        window.localStorage.setItem('bloktris.shortcuts.hidden', '1');
      } catch (e) {
        console.debug('[HUD] localStorage.setItem failed:', e);
      }
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
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + TOPBAR_H + 8 }]}>
      <TopBar
        matchId={state.meta?.matchId}
        botThinking={botThinking}
        onHelpPress={showShortcutsNow}
        onHomePress={requestExit}
      />
      <View style={styles.center}>
        <View style={styles.logoRow}>
          <AppLogo size={120} />
        </View>
        {preGameOverlayUp ? (
          <Text style={[styles.turnText, { color: pal.text }]}>
            Rolling for order…
          </Text>
        ) : (
          <Text style={[styles.turnText, { color: pal.text }]}>
            Turn:{' '}
            <Text style={[{ color: curColorHex }, styles.bold9]}>
              {cur?.color.toUpperCase()}
            </Text>
            {who && <> [{who}]</>}
          </Text>
        )}
      </View>

      {/* ====== Wide layout: Board (center) + Right palette rail (collapsible) ====== */}
      {isWide ? (
        <View style={styles.wideLayout}>
          {/* Left column: board + control row */}
          <View style={styles.center}>
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
                onGhostMove={(cell) => {
                  if (preGameOverlayUp) return;
                  setGhostCell(cell);
                }}
              />

              {/* Controls under the board */}
              <View style={[styles.center, styles.mt12]}>
                <View style={styles.row}>
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
                <Text style={[styles.helperText, { color: pal.text }]}>
                  {pending
                    ? canPlaceHere
                      ? 'Rotate/Flip then press Pick & Place (or click a legal cell).'
                      : 'Rotate/Flip and hover a legal cell to enable Pick & Place.'
                    : 'Pick a piece from the palette to begin.'}
                </Text>
              </View>
            </Animated.View>
          </View>

          {/* Right column: collapsible palette rail (same visual height as board) */}
          <View
            style={[
              styles.rail,
              railOpen ? styles.railOpen : styles.railClosed,
              {
                height: boardPx,
                backgroundColor: pal.card,
                borderColor: pal.grid,
              },
            ]}
          >
            {/* Rail header (collapse) */}
            <View style={[styles.railHeader, { borderBottomColor: pal.grid }]}>
              <Text style={[{ color: pal.text }, styles.bold8]}>
                {railOpen ? 'Palette' : ''}
              </Text>
              <Pressable
                onPress={() => setRailOpen((v) => !v)}
                style={[styles.railToggle, { backgroundColor: pal.btnBg }]}
              >
                <Text
                  style={[
                    styles.buttonText,
                    { color: pal.btnText },
                    styles.bold9,
                  ]}
                >
                  {railOpen ? '»' : '«'}
                </Text>
              </Pressable>
            </View>

            {/* Scrollable content */}
            {railOpen ? (
              <ScrollView
                style={styles.flex1}
                contentContainerStyle={styles.scrollContent}
              >
                <PiecePalette
                  onChoose={handleChoose}
                  disabled={preGameOverlayUp}
                />
              </ScrollView>
            ) : (
              <View style={styles.flex1} />
            )}
          </View>
        </View>
      ) : (
        /* ====== Narrow layout: board top, controls, then palette below ====== */
        <>
          <View style={styles.center}>
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
                onGhostMove={(cell) => {
                  if (preGameOverlayUp) return;
                  setGhostCell(cell);
                }}
              />
            </Animated.View>
          </View>

          {/* Controls under the board */}
          <View style={styles.center}>
            <View style={styles.row}>
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
            <Text style={[styles.helperText, { color: pal.text }]}>
              {pending
                ? canPlaceHere
                  ? 'Rotate/Flip then press Pick & Place (or tap a legal cell).'
                  : 'Rotate/Flip and hover a legal cell to enable Pick & Place.'
                : 'Pick a piece from the palette to begin.'}
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
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}
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
        <View style={[styles.overlay, styles.overlayDim]}>
          <View
            style={[
              styles.modal,
              { backgroundColor: pal.card, borderColor: pal.grid },
            ]}
          >
            <Text style={[styles.modalTitle, { color: pal.text }]}>
              Leave this game?
            </Text>
            <Text style={[styles.modalText, { color: pal.text }]}>
              Your current match will be discarded.
            </Text>
            <View style={styles.row}>
              <Pressable
                onPress={cancelExit}
                style={[
                  styles.button,
                  styles.outlinedButton,
                  { backgroundColor: pal.btnBg, borderColor: pal.grid },
                ]}
              >
                <Text style={[styles.buttonText, { color: pal.btnText }]}>
                  Stay
                </Text>
              </Pressable>
              <Pressable
                onPress={confirmExit}
                style={[styles.button, { backgroundColor: pal.accent }]}
              >
                <Text style={[styles.buttonText, styles.whiteText]}>
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
            if (Platform.OS === 'web')
              try {
                window.localStorage.setItem('bloktris.shortcuts.hidden', '1');
              } catch (e) {
                console.debug('[HUD] localStorage.setItem failed:', e);
              }
          }}
          canPlace={canPlaceHere}
        />
      )}

      {/* Cancel / Skip row */}
      <View style={styles.row}>
        <Pressable
          onPress={() => setPending(null)}
          style={[styles.smallButton, { backgroundColor: pal.btnBg }]}
        >
          <Text style={{ color: pal.btnText }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => dispatch({ type: 'SKIP', pid: state.current })}
          style={[styles.smallButton, { backgroundColor: pal.btnBg }]}
        >
          <Text style={{ color: pal.btnText }}>Skip</Text>
        </Pressable>
      </View>

      {/* ==== Single-overlay switch to prevent double-mounts ==== */}
      {(() => {
        const overlay = React.useMemo(() => {
          type OverlayPhase =
            | 'humanPrompt'
            | 'botShowcase'
            | 'finalResults'
            | null;
          let phase: OverlayPhase = null;
          if (rollPending && nextRollerLabel) phase = 'humanPrompt';
          else if (botShowcaseSeat !== null) phase = 'botShowcase';
          else if (showRollResults && state.meta?.lastRoll)
            phase = 'finalResults';
          return { phase };
        }, [
          rollPending,
          nextRollerLabel,
          botShowcaseSeat,
          showRollResults,
          state.meta?.lastRoll,
        ]);

        switch (overlay.phase) {
          case 'humanPrompt': {
            // LOCK the button if: still frozen OR the queue head hasn't advanced yet after clicking.
            const lock =
              rollFreezeSeat != null ||
              (rollPending && nextRollerId === rollFreezeSeat) ||
              nextRollerId == null;
            return (
              <DiceRollOverlay
                key={`overlay-human-${overlaySeatId ?? -1}`}
                mode="prompt"
                rollerLabel={nextRollerLabel!}
                onRoll={() => {
                  const justRolled = nextRollerId;
                  if (justRolled == null) return;
                  setRollFreezeSeat(justRolled);
                  dispatch({ type: 'HUMAN_ROLL' });
                }}
                revealedValue={currentRollValue}
                partial={partialHuman}
                rollerKey={rollerKey}
                lockRollButton={lock}
              />
            );
          }
          case 'botShowcase': {
            const revealed =
              state.meta?.rolls?.find((r) => r.id === botShowcaseSeat)?.value ??
              null;
            return (
              <DiceRollOverlay
                mode="prompt"
                rollerLabel={`Bot ${botShowcaseSeat! + 1}`}
                autoPlay
                revealedValue={revealed}
                partial={partialBot}
                rollerKey={rollerKey}
                onAutoDone={() =>
                  dispatch({ type: 'BOT_ROLL', pid: botShowcaseSeat! })
                }
              />
            );
          }
          case 'finalResults': {
            return (
              <DiceRollOverlay
                key="overlay-result"
                mode="result"
                rolls={state.meta!.lastRoll}
                tieBreaks={state.meta?.tieBreaks || {}}
                onDone={dismissRollResults}
              />
            );
          }
          default:
            return null;
        }
      })()}

      {/* End-game overlay with confetti */}
      {state.winnerIds && (
        <View style={[styles.overlay, styles.overlayDim]}>
          {confettiOn && <Confetti count={140} />}
          <View
            style={[
              styles.endGameContainer,
              { backgroundColor: pal.card, ...shadow(10) },
            ]}
          >
            <Text style={[styles.endGameTitle, { color: pal.text }]}>
              Game Over 🎉
            </Text>
            <Text style={[styles.endGameText, { color: pal.text }]}>
              Winner{state.winnerIds.length > 1 ? 's' : ''}:{' '}
              <Text
                style={[
                  { color: pal.player[state.winnerIds![0]].fill },
                  styles.bold9,
                ]}
              >
                {state.players[state.winnerIds![0]].color.toUpperCase()}
              </Text>
            </Text>
            <View style={styles.winnersList}>
              {state.players.map((p) => {
                const isWinner = state.winnerIds?.includes(p.id);
                const colorHex = pal.player[p.id].fill;
                const weight = isWinner ? ('800' as const) : ('600' as const);
                const scoreRowDyn = React.useMemo(
                  () => ({
                    backgroundColor: isWinner
                      ? COLORS.winnerBg
                      : COLORS.transparent,
                    borderColor: isWinner ? pal.accent : COLORS.transparent,
                  }),
                  [isWinner, pal.accent],
                );

                return (
                  <View
                    key={p.id}
                    style={[
                      styles.scoreRow,
                      isWinner && styles.scoreRowWinner,
                      scoreRowDyn,
                    ]}
                  >
                    <Text style={{ color: colorHex, fontWeight: weight }}>
                      {p.color.toUpperCase()}
                    </Text>
                    <Text
                      style={[
                        { color: pal.text },
                        styles.op90,
                        isWinner ? styles.bold8 : styles.w600,
                      ]}
                    >
                      score: {p.score}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.row}>
              <Pressable
                onPress={restart}
                style={[styles.button, { backgroundColor: pal.accent }]}
              >
                <Text style={[styles.buttonText, styles.whiteText]}>
                  Play again
                </Text>
              </Pressable>
              {onExitHome && (
                <Pressable
                  onPress={async () => {
                    try {
                      await clearMatch();
                    } catch (e) {
                      console.debug('[HUD] clearMatch failed:', e);
                    }
                    onExitHome();
                  }}
                  style={[
                    styles.button,
                    styles.outlinedButton,
                    { backgroundColor: pal.btnBg, borderColor: pal.grid },
                  ]}
                >
                  <Text style={[styles.buttonText, { color: pal.btnText }]}>
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

const styles = StyleSheet.create({
  bold7: { fontWeight: '700' },
  bold8: { fontWeight: '800' },
  bold9: { fontWeight: '900' },
  button: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: {
    fontWeight: '700',
  },
  center: {
    alignItems: 'center',
  },
  container: {
    alignItems: 'stretch',
    gap: 16,
  },
  // ControlButton base styles
  ctrlButtonBase: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ctrlDisabled: { opacity: 0.6 },
  endGameContainer: {
    borderRadius: 12,
    maxWidth: '90%',
    padding: 24,
    width: 520,
  },
  endGameText: {
    marginBottom: 16,
    textAlign: 'center',
  },
  endGameTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  flex1: {
    flex: 1,
  },
  helperText: {
    marginTop: 6,
    opacity: 0.7,
    textAlign: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    width: '100%',
  },
  modal: {
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: '92%',
    padding: 20,
    width: 480,
  },
  modalText: {
    marginBottom: 16,
    opacity: 0.85,
    textAlign: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  mt12: { marginTop: 12 },
  op90: { opacity: 0.9 },
  outlinedButton: { borderWidth: 1 },
  overlay: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    padding: 24,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  overlayDim: { backgroundColor: COLORS.overlayDim },
  rail: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  railClosed: { width: 48 },
  railHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    height: 44,
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  railOpen: { width: 380 },
  railToggle: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  scoreRow: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scoreRowWinner: { borderWidth: 1 },
  scrollContent: { gap: 8, padding: 8 },
  sheetScroll: { maxHeight: '100%' },
  sheetScrollContent: { paddingBottom: 8 },
  smallButton: {
    borderRadius: 6,
    padding: 10,
  },
  turnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  w600: { fontWeight: '600' },
  whiteText: { color: COLORS.white },
  wideLayout: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  winnersList: { gap: 6, marginBottom: 16 },
});

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

  const containerStyle = React.useMemo(
    () => [
      styles.ctrlButtonBase,
      disabled && styles.ctrlDisabled,
      {
        backgroundColor: disabled ? COLORS.disabled : pressed ? activeBg : bg,
      },
    ],
    [disabled, pressed, activeBg, bg],
  );

  const labelStyle = React.useMemo(
    () => [styles.bold7, { color: pressed ? textColorActive : textColor }],
    [pressed, textColor, textColorActive],
  );

  const iconColor = pressed ? textColorActive : textColor;
  const IconCmp = pressed ? IconActive : Icon;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={containerStyle}
    >
      <IconCmp size={18} color={iconColor} />
      <Text style={labelStyle}>{label}</Text>
    </Pressable>
  );
};
