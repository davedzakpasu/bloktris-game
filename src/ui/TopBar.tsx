import React, { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatchBadge } from "./MatchBadge";
import { usePalette } from "./theme";

// Optional shadow helper; if you don't have it, replace with your own shadow styles
let shadow: (e?: number) => any = () => ({
  ...(Platform.OS === "web"
    ? { boxShadow: `0 4px 16px rgba(0,0,0,.18)` }
    : {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      }),
});

// Inline help icon (uses your icon set if available; falls back to "?")
type IconFC = React.FC<{ size?: number; color?: string }>;
let HelpGlyph: IconFC = ({ size = 18, color = "#fff" }) => (
  <Text style={{ color, fontSize: size, fontWeight: "900" }}>?</Text>
);
let HomeGlyph: IconFC = ({ size = 18, color = "#fff" }) => (
  <Text style={{ color, fontSize: size, fontWeight: "900" }}>⌂</Text>
);

try {
  const icons = require("./icons/icons");
  if (icons.HelpIcon) {
    HelpGlyph = ({ size = 18, color = "#fff" }) => (
      <icons.HelpIcon size={size} color={color} />
    );
  }
  if (icons.HomeIcon) {
    HomeGlyph = ({ size = 18, color = "#fff" }) => (
      <icons.HomeIcon size={size} color={color} />
    );
  }
} catch {}

export const TOPBAR_H = 48;

export const TopBar: React.FC<{
  matchId?: string;
  botThinking?: boolean;
  onHelpPress?: () => void;
  onHomePress?: () => void;
}> = ({ matchId, botThinking, onHelpPress, onHomePress }) => {
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: botThinking ? 1 : 0,
      duration: 180,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [botThinking]);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: insets.top,
        height: TOPBAR_H,
        backgroundColor: pal.card,
        borderBottomWidth: 1,
        borderBottomColor: pal.grid,
        zIndex: 50,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        ...shadow(8),
      }}
    >
      {/* Left: Match ID (reserve width to avoid jitter) */}
      <View style={{ minWidth: 160 }}>
        {matchId ? <MatchBadge id={matchId} /> : null}
      </View>

      {/* Center: (optional) title/logo spot */}
      <View />

      {/* Right: bot thinking pill + help + home */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Animated.View
          style={{
            opacity: fade,
            transform: [
              {
                translateY: fade.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-4, 0],
                }),
              },
            ],
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: pal.card,
              borderWidth: 1,
              borderColor: pal.grid,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: pal.accent,
              }}
            />
            <Text style={{ color: pal.text, opacity: 0.9, fontWeight: "600" }}>
              Bot is thinking…
            </Text>
          </View>
        </Animated.View>

        <Pressable
          onPress={onHelpPress}
          accessibilityRole="button"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: pal.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <HelpGlyph size={18} color="#fff" />
        </Pressable>
        {onHomePress && (
          <Pressable
            onPress={onHomePress}
            accessibilityRole="button"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: pal.btnBg,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: pal.grid,
            }}
          >
            <HomeGlyph size={18} color={pal.btnText} />
          </Pressable>
        )}
      </View>
    </View>
  );
};
