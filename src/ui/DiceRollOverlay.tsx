import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { shadow } from "../helpers/shadow";
import { usePalette } from "./theme";

type RollRow = { color: string; value: number };
type Mode = "prompt" | "result";

export const DiceRollOverlay: React.FC<{
  mode: Mode;
  rollerLabel?: string; // prompt: label to show (e.g., "You" or "Player 2")
  onRoll?: () => void; // prompt: dispatch HUMAN_ROLL (deterministic in reducer)
  rolls?: RollRow[]; // result: final color-ordered rolls
  onDone?: () => void; // result: dismiss
  revealedValue?: number | null; // the actual roll value once reducer sets it
  partial?: Array<{ seat: number; value: number | null }>;
  tieBreaks?: Record<number, { from: number; to: number }>;
}> = ({
  mode,
  rollerLabel,
  onRoll,
  rolls,
  onDone,
  revealedValue,
  partial = [],
  tieBreaks = {},
}) => {
  const pal = usePalette();
  const { width: winW } = useWindowDimensions();

  // entry spring
  const scaleIn = useRef(new Animated.Value(0.9)).current;
  useEffect(() => {
    Animated.spring(scaleIn, {
      toValue: 1,
      useNativeDriver: Platform.OS !== "web",
      friction: 7,
    }).start();
  }, []);

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,.5)",
        zIndex: 200,
      }}
    >
      <Animated.View
        style={{
          transform: [{ scale: scaleIn }],
          backgroundColor: pal.card,
          borderRadius: 12,
          padding: 20,
          width: Math.min(360, winW - 32),
          ...shadow(10),
          gap: 12,
        }}
      >
        {mode === "prompt" ? (
          <Prompt
            rollerLabel={rollerLabel}
            onRoll={onRoll}
            revealedValue={revealedValue}
            partial={partial}
          />
        ) : (
          <Result rolls={rolls || []} onDone={onDone} tieBreaks={tieBreaks} />
        )}
      </Animated.View>
    </View>
  );
};

/* ---------- Prompt: animated tumbling die + Roll button ---------- */
const Prompt: React.FC<{
  rollerLabel?: string;
  onRoll?: () => void;
  revealedValue?: number | null;
  partial: Array<{ seat: number; value: number | null }>;
}> = ({ rollerLabel, onRoll, revealedValue, partial }) => {
  const pal = usePalette();
  // 0 = blank face until we reveal the true value
  const [face, setFace] = useState<number>(0);
  const [animating, setAnimating] = useState(false);
  const spin = useRef(new Animated.Value(0)).current; // 0..1
  const squash = useRef(new Animated.Value(0)).current; // 0..1
  const raf = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    []
  );

  // When the store publishes the final seeded value, snap the face to it.
  useEffect(() => {
    if (revealedValue != null) {
      setFace(revealedValue);
      setAnimating(false);
    }
  }, [revealedValue]);

  const startRollAnim = () => {
    if (animating) return;
    setAnimating(true);

    // spin & squash
    spin.setValue(0);
    squash.setValue(0);
    Animated.parallel([
      Animated.timing(spin, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.sequence([
        Animated.timing(squash, {
          toValue: 1,
          duration: 420,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(squash, {
          toValue: 0,
          duration: 780,
          easing: Easing.out(Easing.quad),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    ]).start(() => setAnimating(false));

    // keep the die blank while it tumbles; snap to revealedValue above
    setFace(0);

    // trigger deterministic roll in reducer
    onRoll?.();
  };

  const rot = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "1900deg"], // tumble
  });
  const sclX = squash.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.96],
  });
  const sclY = squash.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  return (
    <>
      <Text
        style={{
          fontWeight: "800",
          fontSize: 18,
          textAlign: "center",
          color: pal.text,
        }}
      >
        {(rollerLabel ?? "Player").toUpperCase()} — roll the die
      </Text>
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 8,
        }}
      >
        <Animated.View
          style={{
            transform: [{ rotate: rot }, { scaleX: sclX }, { scaleY: sclY }],
          }}
        >
          <DiePips face={face} />
          {/* Overlayed Roll button on top of the die (hidden while animating) */}
          {!animating && (
            <Pressable
              onPress={startRollAnim}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                backgroundColor: "rgba(0,0,0,.0)",
              }}
            >
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: pal.accent,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>Roll</Text>
              </View>
            </Pressable>
          )}
        </Animated.View>
      </View>
      <Pressable
        onPress={startRollAnim}
        disabled={animating}
        style={{
          alignSelf: "center",
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 8,
          backgroundColor: pal.accent,
          opacity: animating ? 0.7 : 1,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "800" }}>
          {animating ? "Rolling…" : "Roll"}
        </Text>
      </Pressable>
      <Text style={{ color: pal.text, opacity: 0.8, textAlign: "center" }}>
        Highest becomes <Text style={{ fontWeight: "800" }}>BLUE</Text>, then
        YELLOW, RED, GREEN.
      </Text>
      {/* Partial results (live as humans roll) */}
      {partial.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            justifyContent: "center",
            marginTop: 4,
          }}
        >
          {partial.map((r, i) => (
            <View
              key={i}
              style={{
                minWidth: 54,
                paddingHorizontal: 8,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: "#ffffff0e",
                alignItems: "center",
              }}
            >
              <Text style={{ color: pal.text, opacity: 0.8, fontSize: 12 }}>
                P{r.seat}
              </Text>
              <Text
                style={{ color: pal.text, fontWeight: "800", fontSize: 16 }}
              >
                {r.value ?? "—"}
              </Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
};

/* ---------- Result: show four final dice with pips ---------- */
const Result: React.FC<{
  rolls: RollRow[];
  onDone?: () => void;
  tieBreaks?: Record<number, { from: number; to: number }>;
}> = ({ rolls, onDone, tieBreaks = {} }) => {
  const pal = usePalette();
  const [reveal, setReveal] = useState(0);
  useEffect(() => {
    setReveal(0);
    // progressive reveal for fun
    const t1 = setTimeout(() => setReveal(1), 150);
    const t2 = setTimeout(() => setReveal(2), 350);
    const t3 = setTimeout(() => setReveal(3), 550);
    const t4 = setTimeout(() => setReveal(4), 750);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [rolls]);
  return (
    <>
      <Text
        style={{
          color: pal.text,
          fontWeight: "800",
          fontSize: 18,
          textAlign: "center",
        }}
      >
        Dice roll — order set
      </Text>
      <View style={{ flexDirection: "row", gap: 12, justifyContent: "center" }}>
        {rolls.map((r, i) => {
          // Color order here is Blue (0), Yellow (1), Red (2), Green (3)
          const baseHex = pal.player[i].fill;
          const labelHex = r.color === "yellow" ? "#bfa500" : baseHex; // darker gold for contrast

          return (
            <View
              key={i}
              style={{
                alignItems: "center",
                gap: 6,
                opacity: i < reveal ? 1 : 0.15,
              }}
            >
              <DiePips face={i < reveal ? r.value : 0} />
              <Text style={{ fontWeight: "900", color: labelHex }}>
                {r.color.toUpperCase()}
              </Text>
              <Text style={{ color: pal.text }}>
                rolled <Text style={{ fontWeight: "900" }}>{r.value}</Text>
              </Text>
            </View>
          );
        })}
      </View>
      {!!Object.keys(tieBreaks).length && (
        <View style={{ marginTop: 6 }}>
          <Text
            style={{
              color: pal.text,
              opacity: 0.85,
              textAlign: "center",
              fontSize: 12,
            }}
          >
            Tie-breaks applied for seats{" "}
            {Object.keys(tieBreaks)
              .map((k) => Number(k) + 1)
              .sort((a, b) => a - b)
              .join(", ")}
          </Text>
        </View>
      )}
      <Pressable
        onPress={onDone}
        accessibilityRole="button"
        style={{
          alignSelf: "center",
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 6,
        }}
      >
        <Text
          style={{
            color: pal.text,
            opacity: 0.9,
            textAlign: "center",
            fontWeight: "700",
          }}
        >
          Tap to start
        </Text>
      </Pressable>
    </>
  );
};

/* ---------- Die with pips ---------- */
const DiePips: React.FC<{ face: number }> = ({ face }) => {
  // 56x56 die with absolute pips
  const size = 56;
  const dot = 8;
  const off = 12;
  const center = size / 2 - dot / 2;

  // pip positions
  type Abs = { left?: number; right?: number; top?: number; bottom?: number };
  const TL: Abs = { left: off, top: off };
  const TR: Abs = { right: off, top: off };
  const BL: Abs = { left: off, bottom: off };
  const BR: Abs = { right: off, bottom: off };
  const ML: Abs = { left: off, top: center };
  const MR: Abs = { right: off, top: center };
  const C: Abs = { left: center, top: center };

  const pipsByFace: Record<number, Abs[]> = {
    0: [], // blank face until reveal
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
        borderRadius: 12,
        backgroundColor: "#fff",
        ...shadow(10),
        position: "relative",
      }}
    >
      {(pipsByFace[face] || pipsByFace[1]).map((pos, i) => (
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
