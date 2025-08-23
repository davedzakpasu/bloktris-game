import React from "react";
import { Image, ImageStyle } from "react-native";

export const AppLogo: React.FC<{ size?: number; style?: ImageStyle }> = ({
  size = 120,
  style,
}) => {
  return (
    <Image
      resizeMode="contain"
      source={require("../../assets/logo.png")} // adjust path if needed
      style={[
        {
          width: size,
          height: size * 0.33, // keeps logo proportions
        },
        style,
      ]}
    />
  );
};
