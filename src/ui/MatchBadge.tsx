import React, { useState } from "react";
import { Platform, Text, View } from "react-native";
import { usePalette } from "./theme";

export const MatchBadge: React.FC<{ id: string }> = ({ id }) => {
  const pal = usePalette();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      if (Platform.OS === "web" && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <View
      style={{
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: pal.card,
        borderWidth: 1,
        borderColor: pal.grid,
      }}
    >
      <Text style={{ color: pal.text, fontWeight: "800", fontSize: 10 }}>
        Match ID:
      </Text>
      <Text style={{ color: pal.text, opacity: 0.8, fontSize: 10 }}>{id}</Text>
      {/* <Pressable
        onPress={copy}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: pal.btnBg,
        }}
      >
        <Text style={{ color: pal.btnText, fontWeight: "700" }}>
          {copied ? "Copied!" : "Copy"}
        </Text>
      </Pressable> */}
    </View>
  );
};
