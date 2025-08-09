// src/ui/PiecePalette.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useGame } from "../GameProvider";
import { PIECES } from "../pieces";
import { orientationsOf } from "../rules";
import type { Orientation, PieceId } from "../types";
import { PlaceIcon, RotateIcon } from "./icons/icons";
import { PlaceIconFilled, RotateIconFilled } from "./icons/iconsFilled";
import { usePalette } from "./theme";

const TILE = 16;

export const PiecePalette: React.FC<{
  onChoose: (pieceId: PieceId, shape: Orientation) => void;
}> = ({ onChoose }) => {
  const { state } = useGame();
  const pal = usePalette();

  const player = state.players[state.current];
  if (!player) {
    return <Text style={{ color: pal.text, opacity: 0.8 }}>Setting up…</Text>;
  }

  const [pieceId, setPieceId] = useState<PieceId | null>(null);
  const [index, setIndex] = useState(0);

  const orients = useMemo(() => {
    if (!pieceId) return [] as Orientation[];
    return orientationsOf(PIECES[pieceId]);
  }, [pieceId]);

  const shape = orients[index];

  const cycleOrientation = () => {
    if (!orients.length) return;
    setIndex((i) => (i + 1) % orients.length);
  };

  const pickAndPlace = () => {
    if (pieceId && shape) onChoose(pieceId, shape);
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: pal.text, fontWeight: "600" }}>
        {player.color.toUpperCase()} — Choose a piece
      </Text>

      {/* Remaining pieces */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
          maxWidth: 420,
        }}
      >
        {player.remaining.map((id: PieceId) => {
          const preview = orientationsOf(PIECES[id])[0];
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
              onPress={() => {
                setPieceId(id);
                setIndex(0);
                onChoose(id, preview); // spawn ghost immediately
              }}
            />
          );
        })}
      </View>

      {/* Optional orientation viewer (still useful if you want to preview flips/rotates) */}
      {shape && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: pal.text }}>
            Orientation ({index + 1}/{orients.length})
          </Text>

          <Svg
            width={10 * TILE}
            height={10 * TILE}
            style={{ backgroundColor: pal.card, borderRadius: 8 }}
          >
            {shape.map((row, y) =>
              row.map((v, x) =>
                v ? (
                  <Rect
                    key={`o-${x}-${y}`}
                    x={x * TILE}
                    y={y * TILE}
                    width={TILE}
                    height={TILE}
                    fill={pal.player[player.id].fill}
                    stroke={pal.grid}
                  />
                ) : null
              )
            )}
          </Svg>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <AnimatedButton
              onPress={cycleOrientation}
              baseBg={pal.btnBg}
              hoverBg={pal.btnBg}
              pressBg={pal.accent}
              textColor={pal.btnText}
              textColorPressed="#fff"
              iconDefault={<RotateIcon size={18} color={pal.btnText} />}
              iconActive={<RotateIconFilled size={18} color="#fff" />}
              label="Rotate / Flip"
            />

            <AnimatedButton
              onPress={pickAndPlace}
              disabled={!pieceId}
              baseBg={pal.accent}
              hoverBg={pal.accent}
              pressBg={pal.accent}
              textColor="#fff"
              textColorPressed="#fff"
              iconDefault={<PlaceIcon size={18} color="#fff" />}
              iconActive={<PlaceIconFilled size={18} color="#fff" />}
              label="Pick & Place"
            />
          </View>
        </View>
      )}
    </View>
  );
};

const PieceCard: React.FC<{
  id: PieceId;
  preview: Orientation;
  selected: boolean;
  colorFill: string;
  borderColor: string;
  accent: string;
  onPress: () => void;
}> = ({ id, preview, selected, colorFill, borderColor, accent, onPress }) => {
  const glow = useRef(new Animated.Value(0)).current;

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

  return (
    <Pressable onPress={onPress}>
      <Animated.View
        style={{
          transform: [{ translateY: selected ? lift : 0 }],
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? (outline as unknown as string) : borderColor,
          padding: 4,
          borderRadius: 8,
          backgroundColor: "#1116",
          // (web warns about shadow* props; it's okay to keep or replace with boxShadow in a web-only style)
          shadowColor: "#000",
          shadowOpacity: selected ? 0.25 : 0.1,
          shadowRadius: selected ? 8 : 4,
          shadowOffset: { width: 0, height: selected ? 4 : 2 },
        }}
      >
        <Svg width={6 * TILE} height={6 * TILE}>
          {preview.map((row, y) =>
            row.map((v, x) =>
              v ? (
                <Rect
                  key={`${id}-${x}-${y}`}
                  x={x * TILE}
                  y={y * TILE}
                  width={TILE}
                  height={TILE}
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
