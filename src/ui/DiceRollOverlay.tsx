import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { usePalette } from "./theme";

/** ---------- Types ---------- */
type RollRow = { color: string; value: number };
type Mode = "prompt" | "result";

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
    <View
      style={{
        position: "absolute" as const,
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,.56)",
        zIndex: 200,
      }}
      pointerEvents="box-none"
    >
      <Animated.View
        style={{
          transform: [{ scale: scaleIn }],
          backgroundColor: pal.card,
          borderRadius: 14,
          padding: 20,
          minWidth: 360,
          maxWidth: 560,
          borderWidth: 1,
          borderColor: pal.grid,
          gap: 14,
        }}
      >
        {props.mode === "prompt" ? (
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
  autoPlayValue = null,
  onAutoDone,
}) => {
  const pal = usePalette();

  // face: 0 = blank; 1..6 = pips
  const [face, setFace] = useState<number>(0);
  const [animating, setAnimating] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  const squash = useRef(new Animated.Value(0)).current;
  const raf = useRef<number | null>(null);
  const rollingRef = useRef(false); // <-- drives RAF; not subject to stale closures
  const HOLD_MS = 1200;
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

  // Bot auto-play: tumble for ~450ms, then ask HUD to commit the value.
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
      if (!rollingRef.current) return;
      if (Date.now() - t0 > 450) {
        rollingRef.current = false;
        setAnimating(false);
        onAutoDone?.(); // <-- reducer writes the actual value
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
    outputRange: ["0deg", "1900deg"],
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
      <Text
        style={{
          color: pal.text,
          fontSize: 18,
          fontWeight: "800",
          textAlign: "center",
        }}
      >
        {rollerLabel ? `${rollerLabel} — roll the die` : "Roll the die"}
      </Text>

      <View style={{ alignItems: "center", paddingVertical: 6 }}>
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
          style={{
            alignSelf: "center",
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: pal.accent,
            opacity: animating || lockRollButton ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>
            {animating ? "Rolling…" : "Roll"}
          </Text>
        </Pressable>
      )}

      <Text style={{ color: pal.text, opacity: 0.8, textAlign: "center" }}>
        Highest becomes <Text style={{ fontWeight: "800" }}>BLUE</Text>, then
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

  return (
    <>
      <Text
        style={{
          color: pal.text,
          fontWeight: "900",
          fontSize: 18,
          textAlign: "center",
        }}
      >
        Dice roll — order set
      </Text>

      <View style={{ flexDirection: "row", gap: 14, justifyContent: "center" }}>
        {rolls.map((r, i) => (
          <View key={i} style={{ alignItems: "center", gap: 6 }}>
            <DiePips face={r.value} />
            <Text
              style={{
                fontWeight: "900",
                color: r.color === "yellow" ? "#bfa500" : pal.player[i].fill,
              }}
            >
              {r.color.toUpperCase()}
            </Text>
            <Text style={{ color: pal.text }}>
              rolled <Text style={{ fontWeight: "900" }}>{r.value}</Text>
            </Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={onDone}
        style={{
          alignSelf: "center",
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: pal.text, fontWeight: "700" }}>Tap to start</Text>
      </Pressable>
    </>
  );
};

/** ---------- Progress chips (P1..P4) ---------- */
const Chips: React.FC<{ partial: PartialSeat[] }> = ({ partial }) => {
  const pal = usePalette();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        justifyContent: "center",
        marginTop: 2,
      }}
    >
      {(partial.length
        ? partial
        : [1, 2, 3, 4].map((n) => ({ seat: n, value: null }))
      ).map((r, i) => (
        <View
          key={i}
          style={{
            width: 56,
            borderRadius: 10,
            backgroundColor: "#0b0b0f",
            borderWidth: 1,
            borderColor: pal.grid,
            paddingVertical: 6,
            alignItems: "center",
            gap: 2,
          }}
        >
          <Text style={{ color: pal.text, opacity: 0.8, fontSize: 12 }}>
            P{r.seat}
          </Text>
          <Text style={{ color: pal.text, fontWeight: "900" }}>
            {r.value == null ? "—" : r.value}
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

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        backgroundColor: "#fff",
        position: "relative",
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      {(pipsByFace[face] || []).map((pos, i) => (
        <View
          key={i}
          style={
            {
              position: "absolute",
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: "#111",
              ...pos,
            } as any
          }
        />
      ))}
    </View>
  );
};
