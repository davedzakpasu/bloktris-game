import React from "react";
import { Platform, Pressable, Text } from "react-native";
import { shadow } from "../../helpers/shadow";
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
          ...shadow(10),
          zIndex: 40,
        },
        Platform.OS === "web" ? ({ position: "fixed" } as any) : null,
      ]}
    >
      <Text style={{ color: "#fff", fontWeight: "800" }}>Palette</Text>
    </Pressable>
  );
};
