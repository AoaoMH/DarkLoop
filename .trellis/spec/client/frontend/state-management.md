# State Management

> `@darkloop/client` uses a single Zustand store for all global game state. No Redux, no React Context, no server state library.

---

## When This Applies

All state management in `packages/client/src/`. Specifically `stores/gameStore.ts` and any component subscribing to store state.

---

## Local Patterns

### Single store — `useGameStore`

All game state lives in one Zustand store. The store is created in `stores/gameStore.ts` and imported by components:

```typescript
// packages/client/src/stores/gameStore.ts
import { create } from 'zustand';

interface GameState {
  // Data fields
  hero: Hero;
  inventory: Equipment[];
  levelProgress: Record<string, LevelProgress>;
  // ...Action Methods
  startBattle: (levelId: string) => void;
  playerAction: (skillId: string, targetIndex?: number) => void;
  // ...
}

export const useGameStore = create<GameState>((set, get) => ({
  // ...initial state
  // ...actions
}));
```

### State + Actions in one interface

The `GameState` interface declares both data fields and action methods. Actions are implemented in the `create()` callback:

```typescript
interface GameState {
  // data
  enemyHp: number;
  // action
  setEnemyHp: (hp: number) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  enemyHp: 0,
  setEnemyHp: (hp) => set({ enemyHp: hp }),
}));
```

### Immutable updates via `set((s) => ({...}))`

Actions use the functional form of `set` to read previous state and return a partial update:

```typescript
playerAction: (skillId, targetIndex) => {
  const state = get();
  // ... compute new state ...
  set((s) => ({
    enemyHp: newEnemyHp,
    battleLog: [...s.battleLog, entry],
  }));
},
```

### `get()` for reads before writes

When an action needs to read current state before deciding what to set, use `get()`:

```typescript
advanceWave: () => {
  const { waveIndex, currentLevel } = get();
  const nextWave = waveIndex + 1;
  // ...
  set({ waveIndex: nextWave, ... });
},
```

### localStorage persistence

The store handles its own persistence via `saveGame()` / `loadGame()` methods:

```typescript
const STORAGE_KEY = 'darkloop_save';
const SAVE_VERSION = 5;

// Inside store:
saveGame: () => {
  const state = get();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SAVE_VERSION, ...state }));
},

loadGame: () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  const save = JSON.parse(raw);
  if (save.version !== SAVE_VERSION) return false;  // version check — no migration
  set({ ...save });
  return true;
},
```

**Important**: `SAVE_VERSION` is bumped when the save format changes. No migration is performed — old saves are rejected. This is intentional during development.

### Battle state machine

Battle flow is a state machine driven by store actions:

```
startBattle → playerAction → enemyTurn → advanceWave → endBattle → claimBattleReward
```

Each action transitions the battle phase and updates HP/turn state. The UI subscribes to these fields and re-renders accordingly.

---

## Forbidden Patterns

- **No multiple stores** — everything in `useGameStore`. If the store grows too large, split by domain using slices, not separate `create()` calls.
- **No mutable state updates** — always use `set()` with a new object. Never mutate `get()` results directly.
- **No async actions without error handling** — if an action is async, wrap the body in try-catch and set an error field.
- **No derived state in the store** — compute derived values in selectors or components, not in the store itself.

---

## Common Mistakes

- **Forgetting to bump `SAVE_VERSION`** — when the `GameState` interface changes, old saves will load with missing fields, causing undefined access. Always bump `SAVE_VERSION`.
- **Calling `set()` inside a `get()` read** — `get()` is for reading; `set()` is for writing. Mixing them inside a single action creates confusing control flow.
- **Storing Phaser sprite references in Zustand** — Phaser objects belong in the scene. Store only serializable game data (HP, level, rewards).

---

## Reference Files

- `packages/client/src/stores/gameStore.ts` — the complete single-store pattern (348 lines)
- `packages/client/src/components/TurnBattleUI.tsx` — example of fine-grained selector usage
