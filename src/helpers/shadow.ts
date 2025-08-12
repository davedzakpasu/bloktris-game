import { Platform } from "react-native";
export const shadow = (elev = 8) =>
  Platform.select({
    web: {
      boxShadow: `0 ${Math.round(elev / 2)}px ${elev * 2}px rgba(0,0,0,.25)`,
    },
    default: {
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: elev * 1.2,
      shadowOffset: { width: 0, height: Math.round(elev / 2) },
      elevation: elev,
    },
  })!;
