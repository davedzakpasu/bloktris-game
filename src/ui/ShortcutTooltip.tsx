import React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { usePalette } from "./theme";

const KeyCap: React.FC<{ label: string }> = ({ label }) => {
  const pal = usePalette();
  return (
    <View
      style={{
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: pal.card,
        borderWidth: 1,
        borderColor: pal.grid,
        minWidth: 24,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: pal.text, fontWeight: "700" }}>{label}</Text>
    </View>
  );
};

export const ShortcutTooltip: React.FC<{
  onDismiss?: () => void;
  canPlace?: boolean;
}> = ({ onDismiss, canPlace }) => {
  const pal = usePalette();
  const isWeb = Platform.OS === "web";

  return (
    <View
      style={{
        marginTop: 10,
        padding: 10,
        backgroundColor: pal.boardBg,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: pal.grid,
        maxWidth: 760,
        alignSelf: "center",
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        gap: 8,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ color: pal.text, fontWeight: "800" }}>Shortcuts</Text>
        {isWeb && (
          <Pressable
            onPress={onDismiss}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: pal.btnBg,
            }}
          >
            <Text style={{ color: pal.btnText, fontWeight: "700" }}>Hide</Text>
          </Pressable>
        )}
      </View>

      {isWeb ? (
        <>
          <Row>
            <KeyCap label="R" />
            <Text style={{ color: pal.text }}>Rotate piece (clockwise)</Text>
          </Row>
          <Row>
            <KeyCap label="F" />
            <Text style={{ color: pal.text }}>Flip piece (horizontal)</Text>
          </Row>
          <Row>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <KeyCap label="Enter" />
              <KeyCap label="Space" />
            </View>
            <Text style={{ color: pal.text }}>
              Place at hovered cell{canPlace ? "" : " (hover a legal cell)"}.
            </Text>
          </Row>
          <Row>
            <KeyCap label="Esc" />
            <Text style={{ color: pal.text }}>Cancel current selection</Text>
          </Row>
        </>
      ) : (
        <Text style={{ color: pal.text, opacity: 0.85 }}>
          On mobile: tap the board to place, use the buttons below to Rotate /
          Flip.
        </Text>
      )}
    </View>
  );
};

const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
    {children}
  </View>
);
