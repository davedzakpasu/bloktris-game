import React, { useEffect, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GameProvider, useGame } from "./src/GameProvider";
import { initSfx } from "./src/sfx";
import { AppLogo } from "./src/ui/AppLogo";
import { HUD } from "./src/ui/HUD";
import { SplashIntro } from "./src/ui/SplashIntro";
import { usePalette } from "./src/ui/theme";

const Home: React.FC = () => {
  const pal = usePalette();
  const { state, dispatch } = useGame();
  const [mode, setMode] = useState<1 | 4 | null>(null);

  useEffect(() => {
    initSfx();
  }, []);

  useEffect(() => {
    if (mode) dispatch({ type: "START", humans: mode });
  }, [mode]);

  // Menu
  if (!mode) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          backgroundColor: pal.boardBg,
        }}
      >
        <AppLogo size={200} />
        <Text style={{ color: pal.text, opacity: 0.8 }}>
          Premium Blokus x Tetris — React Native (Web)
        </Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable
            onPress={() => setMode(1)}
            style={{
              padding: 12,
              backgroundColor: pal.accent,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>
              1 Player vs Bots
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode(4)}
            style={{ padding: 12, backgroundColor: pal.btnBg, borderRadius: 8 }}
          >
            <Text style={{ color: pal.btnText, fontWeight: "700" }}>
              4 Players (Hot-seat)
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Wait one render until START has populated players
  if (state.players.length < 4) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pal.boardBg,
        }}
      >
        <Text style={{ color: pal.text, opacity: 0.8 }}>Setting up game…</Text>
      </View>
    );
  }

  // Game
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ flex: 1, padding: 16, backgroundColor: pal.boardBg }}>
        <HUD />
      </View>
    </ScrollView>
  );
};

function Root() {
  const [showIntro, setShowIntro] = useState(true);

  // Optional: only show once per session (web)
  // useEffect(() => {
  //   if (typeof window !== "undefined" && sessionStorage.getItem("bloktris.intro") === "1") {
  //     setShowIntro(false);
  //   }
  // }, []);
  // const onIntroFinish = () => {
  //   setShowIntro(false);
  //   if (typeof window !== "undefined") sessionStorage.setItem("bloktris.intro", "1");
  // };

  const onIntroFinish = () => setShowIntro(false);

  if (showIntro) {
    return <SplashIntro onFinish={onIntroFinish} />;
  }
  return <Home />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GameProvider>
        <SafeAreaView style={{ flex: 1 }}>
          <Root />
        </SafeAreaView>
      </GameProvider>
    </SafeAreaProvider>
  );
}
