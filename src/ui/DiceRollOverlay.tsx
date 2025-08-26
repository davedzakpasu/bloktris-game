import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {
  CHIP_BG,
  OVERLAY_BACKDROP,
  PIP_COLOR,
  PURE_BLACK,
  PURE_WHITE,
  YELLOW_TEXT,
} from './colors';
import { usePalette } from './theme';

/** ---------- Types ---------- */
type RollRow = { color: string; value: number };
type Mode = 'prompt' | 'result';

type PartialSeat = { seat: number; value: number | null };

export const DiceRollOverlay: React.FC<{
  mode: Mode;

  /** PROMPT */
  rollerLabel?: string; // e.g. "You", "Player 2", "Bot 3"
  onRoll?: () => void; // human: dispatch HUMAN_ROLL
  revealedValue?: number | null; // human: reducer-published final value
  lockRollButton?: boolean; // freeze during 1.2s hold
  partial?: PartialSeat[]; // progress chips P1..P4
  rollerKey?: number | string; // reset per-seat

  /** PROMPT - bots auto-play */
  autoPlay?: boolean;
  autoPlayValue?: number | null; // bot’s final value (from store)
  onAutoDone?: () => void; // tell HUD to advance to next bot

  /** RESULT */
  rolls?: RollRow[];
  onDone?: () => void;
  tieBreaks?: Record<number, { from: number; to: number }>;
}> = (props) => {
  const pal = usePalette();
  const styles = StyleSheet.create({
    card: {
      backgroundColor: pal.card,
      borderColor: pal.grid,
      borderRadius: 14,
      borderWidth: 1,
      gap: 14,
      maxWidth: 560,
      minWidth: 360,
      padding: 20,
    },
    overlay: {
      alignItems: 'center',
      backgroundColor: OVERLAY_BACKDROP,
      bottom: 0,
      justifyContent: 'center',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 200,
    },
  });

  // Entry spring
  const scaleIn = useRef(new Animated.Value(0.94)).current;
  useEffect(() => {
    Animated.spring(scaleIn, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
    }).start();
  }, []);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View style={[styles.card, { transform: [{ scale: scaleIn }] }]}>
        {props.mode === 'prompt' ? (
          <Prompt {...props} />
        ) : (
          <Result rolls={props.rolls || []} onDone={props.onDone} />
        )}
      </Animated.View>
    </View>
  );
};

/** ---------- Prompt (one overlay for human & bots) ---------- */
const Prompt: React.FC<{
  rollerLabel?: string;
  onRoll?: () => void;
  revealedValue?: number | null;
  lockRollButton?: boolean;
  partial?: PartialSeat[];
  rollerKey?: number | string;
  autoPlay?: boolean;
  autoPlayValue?: number | null;
  onAutoDone?: () => void;
}> = ({
  rollerLabel,
  onRoll,
  revealedValue,
  lockRollButton,
  partial = [],
  rollerKey,
  autoPlay = false,
  onAutoDone,
}) => {
  const pal = usePalette();
  const styles = StyleSheet.create({
    dieWrapper: { alignItems: 'center', paddingVertical: 6 },
    infoStrong: { fontWeight: '800' },
    infoText: { color: pal.text, opacity: 0.8, textAlign: 'center' },
    rollButton: {
      alignSelf: 'center',
      backgroundColor: pal.accent,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    rollButtonDisabled: { opacity: 0.7 },
    rollButtonText: { color: PURE_WHITE, fontWeight: '800' },
    title: {
      color: pal.text,
      fontSize: 18,
      fontWeight: '800',
      textAlign: 'center',
    },
  });

  // face: 0 = blank; 1..6 = pips
  const [face, setFace] = useState<number>(0);
  const [animating, setAnimating] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  const squash = useRef(new Animated.Value(0)).current;
  const raf = useRef<number | null>(null);
  const rollingRef = useRef(false); // <-- drives RAF; not subject to stale closures
  const MAX_SPIN_MS = 900;

  // Reset whenever the seat changes
  useEffect(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    rollingRef.current = false;
    setAnimating(false);
    setFace(0);
    spin.setValue(0);
    squash.setValue(0);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [rollerKey]);

  // When reducer publishes the true value (human), snap → hold
  useEffect(() => {
    if (revealedValue != null) {
      if (raf.current) cancelAnimationFrame(raf.current);
      rollingRef.current = false;
      setFace(revealedValue);
      setAnimating(false);
    }
  }, [revealedValue]);

  // Bot auto-play: tumble for ~900ms, then ask HUD to commit the value.
  // The committed value will arrive via `revealedValue` and snap the face.
  useEffect(() => {
    if (!autoPlay) return;

    setAnimating(true);
    rollingRef.current = true;
    spin.setValue(0);
    squash.setValue(0);

    Animated.parallel([
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(squash, {
          toValue: 1,
          duration: 300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(squash, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    const t0 = Date.now();
    const tick = () => {
      if (!rollingRef.current) return;
      if (Date.now() - t0 > 900) {
        rollingRef.current = false;
        setAnimating(false);
        setTimeout(() => onAutoDone?.(), 200); // allow animation to finish
        return;
      }
      setFace(1 + Math.floor(Math.random() * 6));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      rollingRef.current = false;
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [autoPlay, onAutoDone]);

  const startRoll = () => {
    if (animating || lockRollButton) return;
    setAnimating(true);
    rollingRef.current = true;
    spin.setValue(0);
    squash.setValue(0);

    Animated.parallel([
      Animated.timing(spin, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(squash, {
          toValue: 1,
          duration: 200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(squash, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    const t0 = Date.now();
    const tick = () => {
      // shuffle until reducer publishes the value, or we hit a sane cap
      if (!rollingRef.current) return;
      if (revealedValue != null || Date.now() - t0 > MAX_SPIN_MS) {
        rollingRef.current = false;
        return;
      }
      setFace(1 + Math.floor(Math.random() * 6));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    onRoll?.();
  };

  const rot = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '1900deg'],
  });
  const sclX = squash.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.965],
  });
  const sclY = squash.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.035],
  });

  return (
    <>
      <Text style={styles.title}>
        {rollerLabel ? `${rollerLabel} — roll the die` : 'Roll the die'}
      </Text>

      <View style={styles.dieWrapper}>
        <Animated.View
          style={{
            transform: [{ rotate: rot }, { scaleX: sclX }, { scaleY: sclY }],
          }}
        >
          <DiePips face={face} />
        </Animated.View>
      </View>

      {/* Roll button (hidden during bot auto-play) */}
      {!autoPlay && (
        <Pressable
          onPress={startRoll}
          disabled={animating || !!lockRollButton}
          style={[
            styles.rollButton,
            (animating || lockRollButton) && styles.rollButtonDisabled,
          ]}
        >
          <Text style={styles.rollButtonText}>
            {animating ? 'Rolling…' : 'Roll'}
          </Text>
        </Pressable>
      )}

      <Text style={styles.infoText}>
        Highest becomes <Text style={styles.infoStrong}>BLUE</Text>, then
        YELLOW, RED, GREEN.
      </Text>

      {/* Progress chips */}
      <Chips partial={partial} />
    </>
  );
};

/** ---------- Result ---------- */
const Result: React.FC<{
  rolls: RollRow[];
  onDone?: () => void;
}> = ({ rolls, onDone }) => {
  const pal = usePalette();
  const styles = StyleSheet.create({
    colorText: { fontWeight: '900' },
    doneButton: {
      alignSelf: 'center',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    doneButtonText: { color: pal.text, fontWeight: '700' },
    item: { alignItems: 'center', gap: 6 },
    rollStrong: { fontWeight: '900' },
    rollText: { color: pal.text },
    row: { flexDirection: 'row', gap: 14, justifyContent: 'center' },
    title: {
      color: pal.text,
      fontSize: 18,
      fontWeight: '900',
      textAlign: 'center',
    },
  });

  return (
    <>
      <Text style={styles.title}>Dice roll — order set</Text>

      <View style={styles.row}>
        {rolls.map((r, i) => (
          <View key={i} style={styles.item}>
            <DiePips face={r.value} />
            <Text
              style={[
                styles.colorText,
                {
                  color:
                    r.color === 'yellow' ? YELLOW_TEXT : pal.player[i].fill,
                },
              ]}
            >
              {r.color.toUpperCase()}
            </Text>
            <Text style={styles.rollText}>
              rolled <Text style={styles.rollStrong}>{r.value}</Text>
            </Text>
          </View>
        ))}
      </View>

      <Pressable onPress={onDone} style={styles.doneButton}>
        <Text style={styles.doneButtonText}>Tap to start</Text>
      </Pressable>
    </>
  );
};

/** ---------- Progress chips (P1..P4) ---------- */
const Chips: React.FC<{ partial: PartialSeat[] }> = ({ partial }) => {
  const pal = usePalette();
  const styles = StyleSheet.create({
    chip: {
      alignItems: 'center',
      backgroundColor: CHIP_BG,
      borderColor: pal.grid,
      borderRadius: 10,
      borderWidth: 1,
      gap: 2,
      paddingVertical: 6,
      width: 56,
    },
    row: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      marginTop: 2,
    },
    seatText: { color: pal.text, fontSize: 12, opacity: 0.8 },
    valueText: { color: pal.text, fontWeight: '900' },
  });

  return (
    <View style={styles.row}>
      {(partial.length
        ? partial
        : [1, 2, 3, 4].map((n) => ({ seat: n, value: null }))
      ).map((r, i) => (
        <View key={i} style={styles.chip}>
          <Text style={styles.seatText}>P{r.seat}</Text>
          <Text style={styles.valueText}>
            {r.value == null ? '—' : r.value}
          </Text>
        </View>
      ))}
    </View>
  );
};

/** ---------- Die ---------- */
const DiePips: React.FC<{ face: number }> = ({ face }) => {
  // 56x56 die; face=0 ⇒ blank
  const size = 56;
  const dot = 8;
  const off = 12;
  const center = size / 2 - dot / 2;

  const TL = { left: off, top: off };
  const TR = { right: off, top: off };
  const BL = { left: off, bottom: off };
  const BR = { right: off, bottom: off };
  const ML = { left: off, top: center };
  const MR = { right: off, top: center };
  const C = { left: center, top: center };

  const pipsByFace: Record<number, Array<React.CSSProperties>> = {
    0: [], // blank
    1: [C],
    2: [TL, BR],
    3: [TL, C, BR],
    4: [TL, TR, BL, BR],
    5: [TL, TR, C, BL, BR],
    6: [TL, TR, ML, MR, BL, BR],
  };
  const styles = StyleSheet.create({
    die: {
      backgroundColor: PURE_WHITE,
      borderRadius: 14,
      height: size,
      position: 'relative',
      shadowColor: PURE_BLACK,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      width: size,
    },
    pip: {
      backgroundColor: PIP_COLOR,
      borderRadius: dot / 2,
      height: dot,
      position: 'absolute',
      width: dot,
    },
  });

  return (
    <View style={styles.die}>
      {(pipsByFace[face] || []).map((pos, i) => (
        <View key={i} style={[styles.pip, pos as ViewStyle]} />
      ))}
    </View>
  );
};
