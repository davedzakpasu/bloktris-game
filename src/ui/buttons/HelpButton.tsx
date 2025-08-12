import React, { useRef } from "react";
import { Animated, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { shadow } from "../../helpers/shadow";
import { usePalette } from "../theme";

// ⬇️ Try to load icons from your existing sets; fall back to "?"
type IconFC = React.FC<{ size?: number; color?: string }>;
let HelpGlyph: IconFC = ({ size = 20, color = "#fff" }) => (
  <Text style={{ color, fontSize: size, fontWeight: "900" }}>?</Text>
);
let HelpGlyphFilled: IconFC | null = null;
try {
  const maybe = require("../icons/icons"); // e.g., exports { HelpIcon }
  if (maybe.HelpIcon) {
    const Base: IconFC = ({ size = 20, color = "#fff" }) => (
      <maybe.HelpIcon size={size} color={color} />
    );
    HelpGlyph = Base;
  }
} catch {}
try {
  const maybeFilled = require("../icons/iconsFilled"); // e.g., exports { HelpIconFilled }
  if (maybeFilled.HelpIconFilled) {
    HelpGlyphFilled = ({ size = 20, color = "#fff" }) => (
      <maybeFilled.HelpIconFilled size={size} color={color} />
    );
  }
} catch {}

// … keep the rest of the component from the version I sent,
// but replace the inner Pressable’s content with this:

/*
<Pressable ...>
  {pressed && HelpGlyphFilled ? (
    <HelpGlyphFilled size={20} color="#fff" />
  ) : (
    <HelpGlyph size={20} color="#fff" />
  )}
</Pressable>
*/

// Full component body for clarity (unchanged props/API):

export const HelpButton: React.FC<{
  onPress: () => void;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  offset?: number;
  offsetTop?: number;
  offsetRight?: number;
  offsetBottom?: number;
  offsetLeft?: number;
  safeArea?: boolean;
  topReserve?: number;
  size?: number;
  label?: string;
  disabled?: boolean;
}> = ({
  onPress,
  position = "bottom-right",
  offset = 16,
  offsetTop,
  offsetRight,
  offsetBottom,
  offsetLeft,
  safeArea = true,
  topReserve = 0,
  size = 44,
  label,
  disabled,
}) => {
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const isTop = position.startsWith("top");
  const isLeft = position.endsWith("left");

  const effTop = isTop
    ? (safeArea ? insets.top : 0) + topReserve + (offsetTop ?? offset)
    : undefined;
  const effBottom = !isTop
    ? (safeArea ? insets.bottom : 0) + (offsetBottom ?? offset)
    : undefined;
  const effLeft = isLeft ? offsetLeft ?? offset : undefined;
  const effRight = !isLeft ? offsetRight ?? offset : undefined;

  const a = useRef(new Animated.Value(0)).current;
  const pressedIn = () =>
    Animated.spring(a, {
      toValue: 1,
      useNativeDriver: Platform.OS !== "web",
      friction: 6,
    }).start();
  const pressedOut = () =>
    Animated.spring(a, {
      toValue: 0,
      useNativeDriver: Platform.OS !== "web",
      friction: 6,
    }).start();
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] });

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: effTop,
        bottom: effBottom,
        left: effLeft,
        right: effRight,
        zIndex: 60,
      }}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
        <Pressable
          disabled={disabled}
          onPress={onPress}
          onPressIn={pressedIn}
          onPressOut={pressedOut}
          accessibilityRole="button"
          accessibilityLabel="Show help and shortcuts"
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: pal.accent,
            alignItems: "center",
            justifyContent: "center",
            opacity: disabled ? 0.6 : 1,
            ...shadow(8),
          }}
        >
          {/* icon */}
          {/* @ts-expect-error pressed is from Pressable state; use a local pressed state if you prefer */}
          {a.__getValue?.() > 0 && HelpGlyphFilled ? (
            <HelpGlyphFilled size={20} color="#fff" />
          ) : (
            <HelpGlyph size={20} color="#fff" />
          )}
        </Pressable>

        {label ? (
          <Text
            style={{
              marginTop: 6,
              color: pal.text,
              opacity: 0.9,
              fontWeight: "700",
              fontSize: 12,
            }}
          >
            {label}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
};
