import React from "react";
import { Pressable, Text, View } from "react-native";
import { usePalette } from "../theme";

export const ConfirmExitOverlay: React.FC<{
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ visible, onConfirm, onCancel }) => {
  const pal = usePalette();
  if (!visible) return null;
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.55)",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <View
        style={{
          width: 480,
          maxWidth: "92%",
          borderRadius: 12,
          backgroundColor: pal.card,
          padding: 20,
          borderWidth: 1,
          borderColor: pal.grid,
        }}
      >
        <Text
          style={{
            color: pal.text,
            fontSize: 18,
            fontWeight: "800",
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          Leave this game?
        </Text>
        <Text
          style={{
            color: pal.text,
            opacity: 0.85,
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          Your current match will be discarded.
        </Text>
        <View
          style={{
            flexDirection: "row",
            gap: 12,
            justifyContent: "center",
          }}
        >
          <Pressable
            onPress={onCancel}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              backgroundColor: pal.btnBg,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: pal.grid,
            }}
          >
            <Text style={{ color: pal.btnText, fontWeight: "700" }}>Stay</Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              backgroundColor: pal.accent,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Leave game</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};
