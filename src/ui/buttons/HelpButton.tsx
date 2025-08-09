import React from "react";
import { Platform, Pressable, Text, ViewStyle } from "react-native";
import { usePalette } from "../theme";

type Pos = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export const HelpButton: React.FC<{
  onPress: () => void;
  position?: Pos; // default: bottom-right
  offset?: number; // px from edges, default: 16
}> = ({ onPress, position = "bottom-right", offset = 16 }) => {
  const pal = usePalette();

  // compute edge anchors
  const posStyle: ViewStyle = {
    position: "absolute",
    ...(position.includes("right") ? { right: offset } : { left: offset }),
    ...(position.includes("top") ? { top: offset } : { bottom: offset }),
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Show keyboard shortcuts"
      onPress={onPress}
      style={[
        {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: pal.accent,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          zIndex: 50,
          ...posStyle,
        },
        // Web: true viewport anchoring
        Platform.OS === "web" ? ({ position: "fixed" } as any) : null,
      ]}
    >
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 20 }}>?</Text>
    </Pressable>
  );
};
