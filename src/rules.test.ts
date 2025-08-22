import { BOARD_SIZE, isLegalMove } from "./rules";
import { GameState, PlayerId, PlayerState, Shape } from "./types";

describe("isLegalMove", () => {
  const emptyBoard = (): (PlayerId | null)[][] =>
    Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));

  const makePlayers = (hasPlayed: boolean): PlayerState[] => [
    {
      id: 0,
      color: "blue",
      remaining: [],
      hasPlayed,
      isBot: false,
      score: 0,
      active: true,
    },
    {
      id: 1,
      color: "yellow",
      remaining: [],
      hasPlayed: false,
      isBot: false,
      score: 0,
      active: true,
    },
    {
      id: 2,
      color: "red",
      remaining: [],
      hasPlayed: false,
      isBot: false,
      score: 0,
      active: true,
    },
    {
      id: 3,
      color: "green",
      remaining: [],
      hasPlayed: false,
      isBot: false,
      score: 0,
      active: true,
    },
  ];

  it("allows first move covering corner", () => {
    const state: GameState = {
      board: emptyBoard(),
      players: makePlayers(false),
      current: 0,
      history: [],
      winnerIds: null,
    };
    const shape: Shape = [[1]];
    expect(isLegalMove(state, 0, shape, { x: 0, y: 0 })).toBe(true);
  });

  it("rejects move touching existing piece along side", () => {
    const board = emptyBoard();
    board[0][0] = 0;
    const state: GameState = {
      board,
      players: makePlayers(true),
      current: 0,
      history: [],
      winnerIds: null,
    };
    const shape: Shape = [[1]];
    expect(isLegalMove(state, 0, shape, { x: 1, y: 0 })).toBe(false);
  });
});
