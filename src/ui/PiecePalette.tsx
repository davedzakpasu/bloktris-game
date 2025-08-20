// src/ui/PiecePalette.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useGame } from "../GameProvider";
import { shadow } from "../helpers/shadow";
import { ORIENTATIONS, PIECES } from "../pieces";
import type { Orientation, PieceId } from "../types";
import { usePalette } from "./theme";

// Palette layout constants
const COLS = 4;
const GAP = 8; // gap between cards
const CARD_PAD = 6; // inner padding inside each card

export const PiecePalette: React.FC<{
  onChoose: (pieceId: PieceId, shape: Orientation) => void;
  disabled?: boolean;
}> = ({ onChoose, disabled = false }) => {
  const { state } = useGame();
  const pal = usePalette();
  const [wrapW, setWrapW] = useState(0); // measured width of the grid container

  const player = state.players[state.current];
  if (!player) {
    return <Text style={{ color: pal.text, opacity: 0.8 }}>Setting up…</Text>;
  }

  const [pieceId, setPieceId] = useState<PieceId | null>(null);
  const [index, setIndex] = useState(0);

  const orients = useMemo(() => {
    if (!pieceId) return [] as Orientation[];
    return ORIENTATIONS[pieceId];
  }, [pieceId]);

  const shape = orients[index];

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: pal.text, fontWeight: "600" }}>
        {disabled
          ? "Rolling for order…"
          : `${player.color.toUpperCase()} — Choose a piece `}
        {!disabled && (
          <Text style={{ opacity: 0.7 }}>({player.remaining.length} left)</Text>
        )}
      </Text>

      {/* Remaining pieces */}
      <View
        onLayout={(e) => setWrapW(e.nativeEvent.layout.width)}
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: GAP,
          width: "100%",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {/*
          Card size = floor((container - gaps) / COLS)
          If wrapW is 0 on first render, fall back to a sensible default.
        */}
        {(() => {
          const cardSize =
            wrapW > 0 ? Math.floor((wrapW - GAP * (COLS - 1)) / COLS) : 88;
          return (
            <>
              {player.remaining.map((id: PieceId) => {
                const preview = ORIENTATIONS[id][0];
                const selected = id === pieceId;
                return (
                  <PieceCard
                    key={id}
                    id={id}
                    preview={preview}
                    selected={selected}
                    colorFill={pal.player[player.id].fill}
                    borderColor={pal.grid}
                    accent={pal.accent}
                    cardSize={cardSize}
                    sizeLabel={PIECES[id].size}
                    disabled={disabled}
                    onPress={() => {
                      if (disabled) return;
                      setPieceId(id);
                      setIndex(0);
                      onChoose(id, preview); // spawn ghost immediately
                    }}
                  />
                );
              })}
            </>
          );
        })()}
      </View>
    </View>
  );
};

const PieceCardBase: React.FC<{
  id: PieceId;
  preview: Orientation;
  selected: boolean;
  colorFill: string;
  borderColor: string;
  accent: string;
  onPress: () => void;
  cardSize: number;
  sizeLabel: number;
  disabled?: boolean;
}> = ({
  id,
  preview,
  selected,
  colorFill,
  borderColor,
  accent,
  onPress,
  cardSize,
  sizeLabel,
  disabled = false,
}) => {
  const glow = useRef(new Animated.Value(0)).current;
  const hp = useRef(new Animated.Value(0)).current; // hover/press blend 0..1
  const focusA = useRef(new Animated.Value(0)).current; // focus ring 0..1
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    if (!selected) {
      glow.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 900,
          useNativeDriver: false,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 900,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [selected]);

  const outline = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [accent, "#b9a4ff"],
  });
  const lift = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -1],
  });

  useEffect(() => {
    const target = press ? 1 : hover ? 0.5 : 0;
    Animated.timing(hp, {
      toValue: target,
      duration: press ? 80 : 140,
      useNativeDriver: false,
    }).start();
  }, [hover, press]);

  const scale = hp.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] });
  const overlayOpacity = hp.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.08],
  });

  useEffect(() => {
    Animated.timing(focusA, {
      toValue: focus ? 1 : 0,
      duration: 120,
      useNativeDriver: false,
    }).start();
  }, [focus]);

  // --- Dynamic sizing inside the square card ---
  const maxDim = Math.max(preview[0].length, preview.length);
  const cell = Math.max(
    6,
    Math.floor((cardSize - CARD_PAD * 2) / (maxDim + 1))
  );
  const svgW = cell * preview[0].length;
  const svgH = cell * preview.length;
  const offsetX = Math.floor((cardSize - svgW) / 2);
  const offsetY = Math.floor((cardSize - svgH) / 2);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onPressIn={() => setPress(true)}
      onPressOut={() => setPress(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      accessibilityRole="button"
      accessibilityLabel={`${id} piece, ${sizeLabel} squares`}
      focusable
      disabled={disabled}
      {...(Platform.OS === "android"
        ? { android_ripple: { color: "#fff2", borderless: false } }
        : {})}
      {...(Platform.OS === "web"
        ? ({
            onKeyDown: (e: any) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault?.();
                onPress();
              }
            },
          } as any)
        : {})}
      style={{ width: cardSize, height: cardSize }}
    >
      <Animated.View
        style={{
          width: "100%",
          height: "100%",
          transform: [{ translateY: selected ? lift : 0 }, { scale }],
          borderWidth: selected ? 2 : hover || focus ? 2 : 1,
          borderColor: selected
            ? (outline as unknown as string)
            : hover || focus
            ? accent
            : borderColor,
          borderRadius: 8,
          backgroundColor: "#1116",
          ...shadow(selected ? 10 : 6),
          zIndex: selected || hover || focus ? 1 : 0,
          opacity: disabled ? 0.75 : 1,
        }}
      >
        {/* hover/press dark overlay */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: "#000",
            opacity: overlayOpacity as unknown as number,
            borderRadius: 8,
          }}
        />
        {/* focus ring (soft outer glow) */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: -2,
            right: -2,
            top: -2,
            bottom: -2,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: accent,
            opacity: focusA as unknown as number,
          }}
        />
        <Svg width={cardSize} height={cardSize}>
          {preview.map((row, y) =>
            row.map((v, x) =>
              v ? (
                <Rect
                  key={`${id}-${x}-${y}`}
                  x={offsetX + x * cell}
                  y={offsetY + y * cell}
                  width={cell}
                  height={cell}
                  fill={colorFill}
                  stroke={borderColor}
                />
              ) : null
            )
          )}
        </Svg>
      </Animated.View>
    </Pressable>
  );
};

// Avoid re-rendering every card on hover of one item
const PieceCard = React.memo(PieceCardBase, (a, b) => {
  return (
    a.selected === b.selected &&
    a.cardSize === b.cardSize &&
    a.colorFill === b.colorFill &&
    a.borderColor === b.borderColor &&
    a.accent === b.accent &&
    a.sizeLabel === b.sizeLabel &&
    a.disabled === b.disabled &&
    a.preview === b.preview
  );
});

/** AnimatedButton unchanged (kept) */
const AnimatedButton: React.FC<{
  onPress: () => void;
  label: string;
  baseBg: string;
  hoverBg: string;
  pressBg: string;
  textColor: string;
  textColorPressed: string;
  iconDefault: React.ReactNode;
  iconActive: React.ReactNode;
  disabled?: boolean;
}> = ({
  onPress,
  label,
  baseBg,
  hoverBg,
  pressBg,
  textColor,
  textColorPressed,
  iconDefault,
  iconActive,
  disabled,
}) => {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const target = press ? 1 : hover ? 0.5 : 0;
    Animated.timing(anim, {
      toValue: target,
      duration: press ? 80 : 140,
      easing: press ? Easing.out(Easing.quad) : Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [hover, press]);

  const bgColor = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [baseBg, hoverBg, pressBg],
  });
  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.98],
  });
  const isActive = hover || press;

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        borderRadius: 6,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Pressable
        onPress={disabled ? undefined : onPress}
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        onPressIn={() => setPress(true)}
        onPressOut={() => setPress(false)}
        disabled={disabled}
        style={{
          padding: 10,
          borderRadius: 6,
          flexDirection: "row",
          gap: 8,
          alignItems: "center",
          backgroundColor: "#0000",
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            inset: 0 as any,
            backgroundColor: bgColor as any,
            borderRadius: 6,
          }}
        />
        {isActive ? iconActive : iconDefault}
        <Text
          style={{
            color: isActive ? textColorPressed : textColor,
            fontWeight: "600",
          }}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
};
