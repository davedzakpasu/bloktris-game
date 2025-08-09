import React, { useEffect, useMemo } from "react";
import { Animated, Dimensions, Easing, View } from "react-native";

type ConfettiBit = {
  x: number; // start X (px)
  size: number; // square size (px)
  color: string;
  duration: number; // fall duration (ms)
  delay: number; // delay before falling (ms)
  rotate: Animated.Value;
  translateY: Animated.Value;
  translateX: Animated.Value;
};

const COLORS = [
  "#7b5cff",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#e11d48",
];

export const Confetti: React.FC<{ count?: number; onDone?: () => void }> = ({
  count = 120,
  onDone,
}) => {
  const { width, height } = Dimensions.get("window");

  const bits = useMemo<ConfettiBit[]>(() => {
    const arr: ConfettiBit[] = [];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const size = 6 + Math.random() * 8;
      const color = COLORS[i % COLORS.length];
      const duration = 2500 + Math.random() * 2000;
      const delay = Math.random() * 600;
      arr.push({
        x,
        size,
        color,
        duration,
        delay,
        rotate: new Animated.Value(0),
        translateY: new Animated.Value(-40),
        translateX: new Animated.Value(0),
      });
    }
    return arr;
  }, [count, width]);

  useEffect(() => {
    const anims: Animated.CompositeAnimation[] = [];

    bits.forEach((b) => {
      const rot = Animated.timing(b.rotate, {
        toValue: 1,
        duration: b.duration,
        easing: Easing.linear,
        useNativeDriver: true,
      });

      const fall = Animated.timing(b.translateY, {
        toValue: height + 80,
        duration: b.duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });

      const sway = Animated.timing(b.translateX, {
        toValue: (Math.random() * 2 - 1) * 80, // +/- 80px
        duration: b.duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      });

      anims.push(
        Animated.sequence([
          Animated.delay(b.delay),
          Animated.parallel([rot, fall, sway]),
        ])
      );
    });

    Animated.stagger(8, anims).start(() => {
      onDone?.();
    });
  }, [bits]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
      }}
    >
      {bits.map((b, idx) => {
        const spin = b.rotate.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", `${Math.random() > 0.5 ? "" : "-"}720deg`],
        });
        return (
          <Animated.View
            key={idx}
            style={{
              position: "absolute",
              left: b.x,
              transform: [
                { translateY: b.translateY },
                { translateX: b.translateX },
                { rotate: spin },
              ],
              width: b.size,
              height: b.size,
              backgroundColor: b.color,
              borderRadius: 1.5,
              opacity: 0.95,
            }}
          />
        );
      })}
    </View>
  );
};
