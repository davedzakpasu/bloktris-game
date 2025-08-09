import React from "react";
import Svg, { Path, Rect } from "react-native-svg";

export const RotateIconFilled: React.FC<{ size?: number; color?: string }> = ({
  size = 24,
  color = "currentColor",
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    {/* Base circle with cut for arrow */}
    <Path
      d="M12 4a8 8 0 1 1-5.66 13.66 8 8 0 0 1 5.66-13.66z"
      fill={color}
      opacity={0.2}
    />
    {/* Arrow arc */}
    <Path
      d="M20 6v6h-6"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

export const PlaceIconFilled: React.FC<{ size?: number; color?: string }> = ({
  size = 24,
  color = "currentColor",
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    {/* Filled target cell */}
    <Rect
      x={5}
      y={16}
      width={14}
      height={5}
      rx={1.6}
      fill={color}
      opacity={0.2}
    />
    {/* Arrow down */}
    <Path
      d="M12 3v8"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      fill="none"
    />
    <Path
      d="M8.5 9.5L12 13l3.5-3.5"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);
