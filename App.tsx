import React, { useEffect, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
  const [screen, setScreen] = useState<"home" | "game">("home");

  useEffect(() => {
    initSfx();
  }, []);

  // Start a brand-new match only when user picked a mode
  useEffect(() => {
    if (mode) dispatch({ type: "START", humans: mode });
  }, [mode, dispatch]);

  // Menu
  if (screen === "home") {
    // show Resume only for an active, started match (not finished)
    const canResume =
      state.meta?.hydrated === true &&
      state.players.length === 4 &&
      !state.winnerIds &&
      (state.history.length > 0 || // started
        // or there are tiles on the board (cheap check)
        state.board.some((row) => row.some((cell) => cell !== null)));
    return (
      <View style={[styles.homeContainer, { backgroundColor: pal.boardBg }]}>
        <AppLogo size={200} />
        <Text style={[styles.subtitle, { color: pal.text }]}>
          Premium Blokus x Tetris — React Native (Web)
        </Text>
        <View style={styles.buttonRow}>
          <Pressable
            onPress={() => {
              setMode(1);
              setScreen("game");
            }}
            style={[styles.button, { backgroundColor: pal.accent }]}
          >
            <Text style={[styles.buttonText, { color: "white" }]}>
              1 Player vs Bots
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMode(4);
              setScreen("game");
            }}
            style={[styles.button, { backgroundColor: pal.btnBg }]}
          >
            <Text style={[styles.buttonText, { color: pal.btnText }]}>
              4 Players (Hot-seat)
            </Text>
          </Pressable>
        </View>
        {/* Show Resume if a saved match is present (hydrated provider) */}
        {canResume && (
          <Pressable
            onPress={() => setScreen("game")} // no START — uses hydrated state
            style={[
              styles.resumeBtn,
              { backgroundColor: pal.btnBg, borderColor: pal.grid },
            ]}
          >
            <Text style={[styles.buttonText, { color: pal.btnText }]}>
              Resume match
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  // Wait one render until START has populated players
  if (state.players.length < 4) {
    return (
      <View style={[styles.waitContainer, { backgroundColor: pal.boardBg }]}>
        <Text style={[styles.subtitle, { color: pal.text }]}>
          Setting up game…
        </Text>
      </View>
    );
  }

  // Game
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View style={[styles.gameContainer, { backgroundColor: pal.boardBg }]}>
        <HUD
          onExitHome={() => {
            setScreen("home");
            setMode(null); // ensures START won't fire when returning to menu
          }}
        />
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
        <SafeAreaView style={styles.fullFlex}>
          <Root />
        </SafeAreaView>
      </GameProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  homeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  subtitle: {
    opacity: 0.8,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    padding: 12,
    borderRadius: 8,
  },
  buttonText: {
    fontWeight: "700",
  },
  resumeBtn: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  waitContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  gameContainer: {
    flex: 1,
    padding: 16,
  },
  fullFlex: {
    flex: 1,
  },
});
