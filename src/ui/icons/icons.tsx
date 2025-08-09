import React from "react";
import Svg, { Path, Rect } from "react-native-svg";

export const RotateIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 24,
  color = "currentColor",
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* circular refresh arc */}
    <Path
      d="M20 12a8 8 0 1 0-2.34 5.66"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* arrow head */}
    <Path
      d="M20 6v6h-6"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const PlaceIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 24,
  color = "currentColor",
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* down arrow */}
    <Path d="M12 3v8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    <Path
      d="M8.5 9.5L12 13l3.5-3.5"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* target cell (rounded rect) */}
    <Rect
      x={5}
      y={16}
      width={14}
      height={5}
      rx={1.6}
      stroke={color}
      strokeWidth={1.8}
    />
  </Svg>
);
