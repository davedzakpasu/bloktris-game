import React from "react";
import { Platform, Pressable, Text } from "react-native";
import { usePalette } from "../theme";

export const PALETTE_FAB_HEIGHT = 44;

export const PaletteFab: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const pal = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          position: "absolute",
          right: 16,
          bottom: 16,
          paddingHorizontal: 14,
          height: PALETTE_FAB_HEIGHT,
          borderRadius: PALETTE_FAB_HEIGHT / 2,
          backgroundColor: pal.accent,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          zIndex: 40,
        },
        Platform.OS === "web" ? ({ position: "fixed" } as any) : null,
      ]}
    >
      <Text style={{ color: "#fff", fontWeight: "800" }}>Palette</Text>
    </Pressable>
  );
};
