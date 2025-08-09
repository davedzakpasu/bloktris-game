import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { usePalette } from "./theme";

type RollRow = { color: string; value: number };
type Mode = "prompt" | "result";

export const DiceRollOverlay: React.FC<{
  mode: Mode;
  rollerColor?: string; // prompt: whose turn to roll (e.g., "blue")
  onRoll?: () => void; // prompt: dispatch HUMAN_ROLL (deterministic in reducer)
  rolls?: RollRow[]; // result: final color-ordered rolls
  onDone?: () => void; // result: dismiss
}> = ({ mode, rollerColor, onRoll, rolls, onDone }) => {
  const pal = usePalette();

  // entry spring
  const scaleIn = useRef(new Animated.Value(0.9)).current;
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
        position: "fixed" as any,
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
          minWidth: 360,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          gap: 12,
        }}
      >
        {mode === "prompt" ? (
          <Prompt rollerColor={rollerColor} onRoll={onRoll} />
        ) : (
          <Result rolls={rolls || []} onDone={onDone} />
        )}
      </Animated.View>
    </View>
  );
};

/* ---------- Prompt: animated tumbling die + Roll button ---------- */
const Prompt: React.FC<{
  rollerColor?: string;
  onRoll?: () => void;
}> = ({ rollerColor, onRoll }) => {
  const pal = usePalette();
  const [face, setFace] = useState<number>(1);
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
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(squash, {
          toValue: 1,
          duration: 420,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(squash, {
          toValue: 0,
          duration: 780,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => setAnimating(false));

    // shuffle faces quickly for ~650ms (purely visual)
    const t0 = Date.now();
    const tick = () => {
      setFace(1 + Math.floor(Math.random() * 6));
      if (Date.now() - t0 < 1100) {
        raf.current = requestAnimationFrame(tick);
      }
    };
    raf.current = requestAnimationFrame(tick);

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
        {rollerColor ? rollerColor.toUpperCase() : "Player"} — roll the die
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
    </>
  );
};

/* ---------- Result: show four final dice with pips ---------- */
const Result: React.FC<{ rolls: RollRow[]; onDone?: () => void }> = ({
  rolls,
  onDone,
}) => {
  const pal = usePalette();
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
            <View key={i} style={{ alignItems: "center", gap: 6 }}>
              <DiePips face={r.value} />
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
  const TL = { left: off, top: off };
  const TR = { right: off, top: off };
  const BL = { left: off, bottom: off };
  const BR = { right: off, bottom: off };
  const ML = { left: off, top: center };
  const MR = { right: off, top: center };
  const C = { left: center, top: center };

  const pipsByFace: Record<number, Array<React.CSSProperties>> = {
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
        boxShadow: "0 6px 18px rgba(0,0,0,.25)" as any,
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
