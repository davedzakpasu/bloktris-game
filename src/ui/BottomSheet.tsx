import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { shadow } from "../../src/helpers/shadow";
import { usePalette } from "./theme";

export const BottomSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  maxHeightPct?: number; // 0..1 (default 0.6 -> 60% height)
  title?: string;
  children: React.ReactNode;
}> = ({ open, onClose, maxHeightPct = 0.6, title = "Palette", children }) => {
  const pal = usePalette();
  const H = Dimensions.get("window").height;
  const MAX = Math.max(240, Math.min(H * maxHeightPct, H - 80)); // sane bounds

  const y = useRef(new Animated.Value(H)).current;

  // Lock body scroll on web while open
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const body = document?.body;
    if (!body) return;
    const prev = body.style.overflow;
    if (open) body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prev;
    };
  }, [open]);

  // open/close animate
  useEffect(() => {
    Animated.spring(y, {
      toValue: open ? H - MAX : H,
      useNativeDriver: Platform.OS !== "web",
      bounciness: 6,
    }).start();
  }, [open, MAX]);

  // drag to close
  const drag = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        const next = Math.max(H - MAX, Math.min(H, H - MAX + g.dy));
        y.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const at = H - MAX + g.dy;
        const shouldClose = g.vy > 0.6 || at > H - MAX / 2;
        Animated.spring(y, {
          toValue: shouldClose ? H : H - MAX,
          useNativeDriver: Platform.OS !== "web",
        }).start(() => {
          if (shouldClose) onClose();
        });
      },
    })
  ).current;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <Pressable
          onPress={onClose}
          style={{
            position: Platform.OS === "web" ? ("fixed" as any) : "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,.4)",
            zIndex: 90,
          }}
        />
      )}

      {/* Sheet */}
      <Animated.View
        style={[
          {
            position: Platform.OS === "web" ? ("fixed" as any) : "absolute",
            left: 0,
            right: 0,
            transform: [{ translateY: y }],
            backgroundColor: pal.card,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            ...shadow(10),
            zIndex: 100,
            // smoother on some browsers:
            ...(Platform.OS === "web"
              ? ({ willChange: "transform" } as any)
              : null),
          },
        ]}
        {...drag.panHandlers}
      >
        {/* Grab handle + header */}
        <View style={{ alignItems: "center", paddingTop: 8 }}>
          <View
            style={{
              width: 48,
              height: 4,
              borderRadius: 2,
              backgroundColor: pal.grid,
              marginBottom: 8,
            }}
          />
        </View>
        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: pal.text, fontWeight: "800" }}>{title}</Text>
          <Pressable
            onPress={onClose}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: pal.btnBg,
            }}
          >
            <Text style={{ color: pal.btnText, fontWeight: "700" }}>Close</Text>
          </Pressable>
        </View>

        {/* Body: let caller pass a ScrollView to own scrolling */}
        <View
          style={{
            maxHeight: MAX - 56,
            paddingHorizontal: 8,
            paddingBottom: 12,
          }}
        >
          {children}
        </View>
      </Animated.View>
    </>
  );
};
