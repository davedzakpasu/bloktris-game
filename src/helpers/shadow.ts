import { Platform, ViewStyle } from "react-native";

/** Cross-platform shadow helper */
export function shadow(depth = 8): ViewStyle {
  if (Platform.OS === "web") {
    const y = Math.round(depth * 0.8);
    const blur = Math.round(depth * 2.2);
    const spread = Math.round(depth * 0.2);
    const color = "rgba(0,0,0,0.25)";
    // RN Web accepts CSS boxShadow via style prop
    return { boxShadow: `0 ${y}px ${blur}px ${spread}px ${color}` } as any;
  }

  if (Platform.OS === "android") {
    return { elevation: Math.max(1, Math.round(depth)) };
  }

  // iOS default
  return {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: depth * 0.6,
    shadowOffset: { width: 0, height: Math.round(depth * 0.8) },
  };
}
