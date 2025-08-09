import React from "react";
import Svg, { Path } from "react-native-svg";

export const FlipIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 24,
  color = "currentColor",
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* horizontal flip arrows */}
    <Path d="M4 12h7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    <Path
      d="M3 12l3-3m-3 3l3 3"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M20 12h-7"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
    <Path
      d="M21 12l-3-3m3 3l-3 3"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const FlipIconFilled: React.FC<{ size?: number; color?: string }> = ({
  size = 24,
  color = "currentColor",
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* hint bars */}
    <Path d="M4 12h7" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Path d="M20 12h-7" stroke={color} strokeWidth={2} strokeLinecap="round" />
    {/* filled arrows */}
    <Path d="M3 12l3-3v6l-3-3Z" fill={color} />
    <Path d="M21 12l-3-3v6l3-3Z" fill={color} />
  </Svg>
);
