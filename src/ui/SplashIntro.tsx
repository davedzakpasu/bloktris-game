import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";

let playStart = () => {};
try {
  // optional start sound
  ({ playStart } = require("../../sfx"));
} catch {}

export const SplashIntro: React.FC<{ onFinish: () => void }> = ({
  onFinish,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.7)).current;
  const useNativeDriv = Platform.OS !== "web";

  useEffect(() => {
    playStart?.();
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: useNativeDriv,
      }),
      Animated.delay(1400),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: useNativeDriv,
      }),
    ]).start(onFinish);

    // pulse glow indefinitely
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 900,
          useNativeDriver: useNativeDriv,
        }),
        Animated.timing(glow, {
          toValue: 0.7,
          duration: 900,
          useNativeDriver: useNativeDriv,
        }),
      ])
    ).start();
  }, []);

  const glowScale = glow.interpolate({
    inputRange: [0.7, 1],
    outputRange: [1, 1.15],
  });

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={["#0f2027", "#203a43", "#2c5364"]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={{
          transform: [{ scale: glowScale }],
          shadowColor: "#fff",
          shadowOpacity: 0.5,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        <Animated.Image
          source={require("../../assets/logo.png")}
          style={[styles.logo, { opacity }]}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  logo: {
    width: 220,
    height: 220,
  },
});
