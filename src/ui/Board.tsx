import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, GestureResponderEvent, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useGame } from "../GameProvider";
import { BOARD_SIZE, isLegalMove, PLAYER_CORNERS } from "../rules";
import { Orientation } from "../types";
import { usePalette } from "./theme";

const CELL = 24;

// Animated tile that "pops" when it appears
const AnimatedCell: React.FC<{
  x: number;
  y: number;
  fill: string;
  stroke: string;
  keyStr: string;
}> = ({ x, y, fill, stroke, keyStr }) => {
  const s = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    s.setValue(0.6);
    Animated.spring(s, {
      toValue: 1,
      friction: 6,
      useNativeDriver: true,
    }).start();
  }, [keyStr]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: x * CELL,
        top: y * CELL,
        width: CELL,
        height: CELL,
        transform: [{ scale: s }],
      }}
    >
      <Svg width={CELL} height={CELL}>
        <Rect
          x={0}
          y={0}
          width={CELL}
          height={CELL}
          fill={fill}
          stroke={stroke}
        />
      </Svg>
    </Animated.View>
  );
};

// Soft pulsing ring to indicate the required starting corner
const CornerPulse: React.FC<{ x: number; y: number; color: string }> = ({
  x,
  y,
  color,
}) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(a, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.35] });
  const opacity = a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: x * CELL,
        top: y * CELL,
        width: CELL,
        height: CELL,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ scale }],
        opacity,
      }}
    >
      <View
        style={{
          width: CELL,
          height: CELL,
          borderWidth: 2,
          borderColor: color,
          borderRadius: 4,
        }}
      />
    </Animated.View>
  );
};

export const Board: React.FC<{
  pending?: { shape: Orientation; pieceId: string } | null;
  onCellClick?: (x: number, y: number) => void;
}> = ({ pending, onCellClick }) => {
  const { state } = useGame();
  const pal = usePalette();
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const grid = useMemo(() => state.board, [state.board]);

  const updateHover = (xPx: number, yPx: number) => {
    const x = Math.floor(xPx / CELL);
    const y = Math.floor(yPx / CELL);
    if (x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE)
      setHover({ x, y });
    else setHover(null);
  };

  const onResponderMove = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    updateHover(locationX, locationY);
  };

  const onResponderRelease = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const x = Math.floor(locationX / CELL);
    const y = Math.floor(locationY / CELL);
    if (x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE) {
      onCellClick?.(x, y);
    }
    setHover(null);
  };

  const ghostOk = useMemo(() => {
    if (!pending || !hover) return false;
    return isLegalMove(state, state.current, pending.shape, hover);
  }, [pending, hover, state]);

  const width = BOARD_SIZE * CELL;
  const height = BOARD_SIZE * CELL;

  const current = state.players[state.current];
  const showCornerCue = !!current && !current.hasPlayed;
  const corner = PLAYER_CORNERS[state.current as 0 | 1 | 2 | 3];

  const ghostOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shouldShake = !!(pending && hover && !ghostOk);
    if (!shouldShake) {
      ghostOffset.stopAnimation();
      ghostOffset.setValue(0);
      return;
    }
    Animated.sequence([
      Animated.timing(ghostOffset, {
        toValue: 1,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(ghostOffset, {
        toValue: -1,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(ghostOffset, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pending, hover, ghostOk]);

  const ghostShake = ghostOffset.interpolate({
    inputRange: [-1, 1],
    outputRange: [-2, 2], // pixels
  });

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* Base grid (empty cells only) */}
      <Svg width={width} height={height}>
        {/* Ghost preview (overlay, shake when invalid) */}
        {pending && hover && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: hover.x * CELL,
              top: hover.y * CELL,
              transform: [{ translateX: ghostOk ? 0 : ghostShake }],
              opacity: 0.9,
            }}
          >
            <Svg
              width={pending.shape[0].length * CELL}
              height={pending.shape.length * CELL}
            >
              {pending.shape.map((r, yy) =>
                r.map((v, xx) =>
                  v ? (
                    <Rect
                      key={`ghost-${xx}-${yy}`}
                      x={xx * CELL}
                      y={yy * CELL}
                      width={CELL}
                      height={CELL}
                      fill={ghostOk ? pal.ghostOk : pal.ghostBad}
                      opacity={0.6}
                    />
                  ) : null
                )
              )}
            </Svg>
          </Animated.View>
        )}
      </Svg>

      {/* Placed tiles (animated overlay) */}
      {grid.map((row, y) =>
        row.map((owner, x) =>
          owner === null ? null : (
            <AnimatedCell
              key={`t-${x}-${y}-${owner}-${state.history.length}`}
              x={x}
              y={y}
              fill={pal.player[owner].fill}
              stroke={pal.grid}
              keyStr={`${x}-${y}-${owner}-${state.history.length}`}
            />
          )
        )
      )}

      {/* First-move corner pulse cue */}
      {showCornerCue && (
        <CornerPulse x={corner.x} y={corner.y} color={pal.accent} />
      )}

      {/* Input capture layer */}
      <View
        onStartShouldSetResponder={() => true}
        onResponderMove={onResponderMove}
        onResponderRelease={onResponderRelease}
        onResponderTerminate={() => setHover(null)}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height,
          backgroundColor: "transparent",
        }}
      />
    </View>
  );
};
