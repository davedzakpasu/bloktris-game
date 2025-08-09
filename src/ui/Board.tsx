import React, { useEffect, useMemo, useRef } from "react";
import { Animated, GestureResponderEvent, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { useGame } from "../GameProvider";
import { BOARD_SIZE, isLegalMove, PLAYER_CORNERS } from "../rules";
import type { Orientation } from "../types";
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

// Soft pulsing ring to indicate the required starting corner (first move)
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
  // NEW: draggable ghost controlled by HUD
  ghost?: { shape: Orientation; at: { x: number; y: number } } | null;
  onGhostMove?: (cell: { x: number; y: number }) => void;

  // Keep showing placed tiles etc.
}> = ({ ghost, onGhostMove }) => {
  const { state } = useGame();
  const pal = usePalette();

  const grid = useMemo(() => state.board, [state.board]);

  const width = BOARD_SIZE * CELL;
  const height = BOARD_SIZE * CELL;

  const current = state.players[state.current];
  const showCornerCue = !!current && !current.hasPlayed;
  const corner = PLAYER_CORNERS[state.current as 0 | 1 | 2 | 3];

  // Is the ghost currently in a legal spot?
  const ghostOk = useMemo(() => {
    if (!ghost) return false;
    return isLegalMove(state, state.current, ghost.shape, ghost.at);
  }, [ghost, state]);

  // invalid-ghost shake
  const ghostOffset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const shouldShake = !!(ghost && !ghostOk);
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
  }, [ghost, ghostOk]);

  const ghostShake = ghostOffset.interpolate({
    inputRange: [-1, 1],
    outputRange: [-2, 2],
  });

  // Drag-to-move ghost: snap to cell and clamp inside board
  const moveToEvent = (e: GestureResponderEvent) => {
    if (!ghost || !onGhostMove) return;
    const { locationX, locationY } = e.nativeEvent;
    let x = Math.floor(locationX / CELL);
    let y = Math.floor(locationY / CELL);
    // clamp using current shape dims
    const h = ghost.shape.length;
    const w = ghost.shape[0].length;
    x = Math.max(0, Math.min(BOARD_SIZE - w, x));
    y = Math.max(0, Math.min(BOARD_SIZE - h, y));
    onGhostMove({ x, y });
  };

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* 1) Base grid background + cell fills */}
      <Svg width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} fill={pal.boardBg} />
        {grid.map((row, y) =>
          row.map((_, x) => (
            <Rect
              key={`g-${x}-${y}`}
              x={x * CELL}
              y={y * CELL}
              width={CELL}
              height={CELL}
              fill={pal.cellBg}
            />
          ))
        )}
      </Svg>

      {/* 2) Crisp grid lines overlay */}
      <Svg
        width={width}
        height={height}
        style={{ position: "absolute", left: 0, top: 0 }}
        // @ts-ignore
        shapeRendering="crispEdges"
      >
        {Array.from({ length: BOARD_SIZE + 1 }).map((_, i) => (
          <Line
            key={`v-${i}`}
            x1={i * CELL}
            y1={0}
            x2={i * CELL}
            y2={height}
            stroke={pal.grid}
            strokeWidth={1}
            opacity={0.9}
          />
        ))}
        {Array.from({ length: BOARD_SIZE + 1 }).map((_, i) => (
          <Line
            key={`h-${i}`}
            x1={0}
            y1={i * CELL}
            x2={width}
            y2={i * CELL}
            stroke={pal.grid}
            strokeWidth={1}
            opacity={0.9}
          />
        ))}
      </Svg>

      {/* 3) Ghost preview (draggable, shake if illegal) */}
      {ghost && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: ghost.at.x * CELL,
            top: ghost.at.y * CELL,
            transform: [{ translateX: ghostOk ? 0 : ghostShake }],
            opacity: 0.9,
          }}
        >
          <Svg
            width={ghost.shape[0].length * CELL}
            height={ghost.shape.length * CELL}
          >
            {ghost.shape.map((r, yy) =>
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

      {/* 4) Placed tiles (animated overlay) */}
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

      {/* 5) First-move corner pulse cue */}
      {showCornerCue && (
        <CornerPulse x={corner.x} y={corner.y} color={pal.accent} />
      )}

      {/* 6) Input capture layer for dragging the ghost */}
      <View
        onStartShouldSetResponder={() => true}
        onResponderMove={moveToEvent}
        onResponderRelease={moveToEvent}
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
