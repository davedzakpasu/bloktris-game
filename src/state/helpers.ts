import { BOARD_SIZE } from "../constants";
import { ALL_PIECE_IDS, PIECE_SIZES } from "../pieces";
import { PLAYER_COLORS } from "../rules";
import { PieceId, PlayerId, PlayerState } from "../types";

export function makeEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

export function buildPlayers(humans: 1 | 4): PlayerState[] {
  const ids: PlayerId[] = [0, 1, 2, 3];
  return ids.map((id) => ({
    id,
    color: PLAYER_COLORS[id], // placeholder; will be reassigned after dice
    remaining: [...ALL_PIECE_IDS],
    hasPlayed: false,
    isBot: humans === 1 ? id !== 0 : false, // seat 0 is human in 1vBots
    score: 0,
    active: true,
  }));
}

export function scoreForRemaining(remaining: PieceId[]) {
  return remaining.reduce((sum, id) => sum + PIECE_SIZES[id], 0);
}
