import { useColorScheme } from "react-native";

export function usePalette() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";

  if (dark) {
    return {
      text: "#f2f2f2",
      boardBg: "#0e0f14",
      cellBg: "#171923",
      grid: "#2a2f3a",
      ghostOk: "#3ddc91",
      ghostBad: "#f05a69",
      accent: "#7b5cff",
      card: "#1d2030",
      btnBg: "#21273a",
      btnText: "#fff",
      btnDisabled: "#2b2f3a",
      // NEW
      btnHover: "#2d2f42",
      accentText: "#b9a4ff",
      player: [
        { fill: "#3b82f6" }, // blue
        { fill: "#f59e0b" }, // yellow
        { fill: "#ef4444" }, // red
        { fill: "#10b981" }, // green
      ],
    };
  }

  // light
  return {
    text: "#1b1b1b",
    boardBg: "#f7f8fb",
    cellBg: "#ffffff",
    grid: "#dde1ea",
    ghostOk: "#3ddc91",
    ghostBad: "#f05a69",
    accent: "#7b5cff",
    card: "#eef1f7",
    btnBg: "#e5e9f2",
    btnText: "#111",
    btnDisabled: "#d5d9e2",
    // NEW
    btnHover: "#e5e5f0",
    accentText: "#7b5cff",
    player: [
      { fill: "#3b82f6" },
      { fill: "#f59e0b" },
      { fill: "#ef4444" },
      { fill: "#10b981" },
    ],
  };
}
