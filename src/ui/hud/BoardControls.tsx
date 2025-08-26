import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { PieceId } from "../../types";
import { PlaceIcon, RotateIcon } from "../icons/icons";
import { PlaceIconFilled, RotateIconFilled } from "../icons/iconsFilled";
import { FlipIcon, FlipIconFilled } from "../icons/iconsFlip";
import { usePalette } from "../theme";

export type Shape = number[][];

export const BoardControls: React.FC<{
  pending: { pieceId: PieceId; shape: Shape } | null;
  canPlaceHere: boolean;
  rotate: () => void;
  flip: () => void;
  placeAtHover: () => void;
}> = ({ pending, canPlaceHere, rotate, flip, placeAtHover }) => {
  const pal = usePalette();
  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          flexDirection: "row",
          gap: 12,
          justifyContent: "center",
        }}
      >
        <ControlButton
          label="Rotate"
          onPress={rotate}
          bg={pal.btnBg}
          activeBg={pal.accent}
          textColor={pal.btnText}
          textColorActive="#fff"
          Icon={RotateIcon}
          IconActive={RotateIconFilled}
          disabled={!pending}
        />
        <ControlButton
          label="Flip"
          onPress={flip}
          bg={pal.btnBg}
          activeBg={pal.accent}
          textColor={pal.btnText}
          textColorActive="#fff"
          Icon={FlipIcon}
          IconActive={FlipIconFilled}
          disabled={!pending}
        />
        <ControlButton
          label="Pick & Place"
          onPress={placeAtHover}
          bg={pal.accent}
          activeBg={pal.accent}
          textColor="#fff"
          textColorActive="#fff"
          Icon={PlaceIcon}
          IconActive={PlaceIconFilled}
          disabled={!canPlaceHere}
        />
      </View>
      <Text
        style={{
          color: pal.text,
          opacity: 0.7,
          marginTop: 6,
          textAlign: "center",
        }}
      >
        {pending
          ? canPlaceHere
            ? "Rotate/Flip then press Pick & Place (or tap a legal cell)."
            : "Rotate/Flip and hover a legal cell to enable Pick & Place."
          : "Pick a piece from the palette to begin."}
      </Text>
    </View>
  );
};

const ControlButton: React.FC<{
  label: string;
  onPress: () => void;
  bg: string;
  activeBg: string;
  textColor: string;
  textColorActive: string;
  Icon: React.FC<{ size?: number; color?: string }>;
  IconActive: React.FC<{ size?: number; color?: string }>;
  disabled?: boolean;
}> = ({
  label,
  onPress,
  bg,
  activeBg,
  textColor,
  textColorActive,
  Icon,
  IconActive,
  disabled,
}) => {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 8,
        backgroundColor: disabled ? "#9993" : pressed ? activeBg : bg,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {pressed ? (
        <IconActive size={18} color={textColorActive} />
      ) : (
        <Icon size={18} color={textColor} />
      )}
      <Text
        style={{
          color: pressed ? textColorActive : textColor,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};
