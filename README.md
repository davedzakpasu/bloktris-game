## Bloktris

An Expo-powered React Native game blending Blokus-style pieces with Tetris-like placement.

## Overview

Bloktris uses `index.ts` to register the root component, `App.tsx` for providers and main menu setup, and keeps all core game logic in `src/`.

## Project Layout

```text
.
├── package.json                # Scripts and Expo/React Native dependencies
├── index.ts                    # Registers the root component
├── App.tsx                     # Providers and main menu setup
└── src/
    ├── GameProvider.tsx        # Central state manager (useReducer + seeded RNG)
    ├── rules.ts                # Board, corners, legal move logic
    ├── pieces.ts               # 21 pieces + precomputed orientations
    ├── bots.ts                 # Baseline AI/heuristics
    ├── types.ts                # Type models for pieces/players/state
    ├── sfx.ts                  # Sound helpers (expo-av, WebAudio fallback)
    └── ui/
        ├── Board.tsx           # Grid, animated tiles, drag ghost, corner cue
        ├── HUD.tsx             # Gameplay UI, bot turns, dice overlays
        └── theme.ts            # Light/dark palettes, player colors, accents
```
### Files & Modules

| Path | Description |
|---|---|
| `src/GameProvider.tsx` | Central state manager using `useReducer` and seeded RNG utilities for deterministic dice rolls, player order, and match IDs. |
| `src/rules.ts` / `src/pieces.ts` | Definitions of the 20×20 board, player corners, legal move logic, and the full set of 21 Blokus pieces with precomputed orientations. |
| `src/bots.ts` | Simple AI that scores candidate moves by mobility, outward spread, and piece size to pick the best placement. |
| `src/types.ts` | TypeScript models for pieces, players, and game state. |
| `src/sfx.ts` | Sound effect helpers using `expo-av`, with a WebAudio fallback for the start chime. |
| `src/ui/Board.tsx` | Renders the grid, animated tiles, draggable ghost preview, and first-move corner cue. |
| `src/ui/HUD.tsx` | Orchestrates gameplay UI, responsive layout, and bot turns; shows dice-roll overlays and auto-plays bots after a delay. |
| `src/ui/theme.ts` | Provides light/dark palettes with per-player colors and accent hues. |

### Key Concepts

- **State and actions** — `GameProvider` defines actions for starting games, rolling dice, placing pieces, skipping turns, and marking roll overlays.
- **Game rules** — `rules.ts` enforces Blokus-style constraints:
  - First moves must cover a player’s corner.
  - Later moves must touch **by corners only**.
  - Each placement is checked against board bounds and overlaps.
- **Pieces and orientations** — `pieces.ts` builds each piece via string grids and precomputes all rotations/flips for efficient iteration.
- **AI heuristics** — `bots.ts` offers a baseline bot that evaluates mobility and board expansion.
- **UI interaction flow** — `HUD.tsx` ties together palette selection, drag-and-drop placement on `Board.tsx`, dice overlays, and end-of-game handling.
- **Theming and SFX** — `usePalette` in `theme.ts` supplies light/dark colors, and `sfx.ts` centralizes audio playback.

### Next Steps

- Explore `GameProvider` to add new actions or track extra metadata (e.g., per-turn timers).
- Extend `rules.ts` or `pieces.ts` for variant boards or custom piece sets.
- Enhance `bots.ts` with deeper search or difficulty settings.
- Customize UI components in `src/ui/` (animations, accessibility, etc.).
- Consult Expo/React Native docs for platform-specific optimizations.

### Testing

> **Note:** No tests executed; repository is read-only.
