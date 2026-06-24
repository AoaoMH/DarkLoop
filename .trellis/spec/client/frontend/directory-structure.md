# Directory Structure

> How `@darkloop/client` is organized. React 19 + Vite 6 + Phaser 3.87 + Zustand 5.

---

## Directory Layout

```
packages/client/src/
├── App.tsx              # Root component — layout + menu routing
├── main.tsx             # Vite entry — ReactDOM.createRoot
├── assets/              # Static assets imported by Vite
├── components/          # React DOM components (UI layer)
│   ├── AdventureMap.tsx     # Level selection map
│   ├── CharacterPanel.tsx   # Hero stats and equipment
│   ├── EquipSelectPopup.tsx # Equipment selection modal
│   ├── EquipTooltip.tsx     # Equipment hover tooltip
│   ├── GameCanvas.tsx       # Phaser game container
│   ├── InventoryPanel.tsx   # Inventory grid
│   ├── ResourceBar.tsx      # Top resource bar (gold/exp/diamond)
│   ├── SideMenu.tsx         # Navigation menu
│   ├── TalentPanel.tsx      # Talent tree panel
│   └── TurnBattleUI.tsx     # Battle HUD overlay
├── game/                # Phaser game engine layer
│   ├── battleBridge.ts      # Singleton EventEmitter — DOM ↔ Phaser comms
│   ├── config.ts            # Phaser game config
│   ├── entities/            # Game entity factories
│   ├── scenes/              # Phaser scenes (BattleScene, etc.)
│   └── systems/             # Reusable game systems
├── hooks/              # Custom React hooks (currently empty — reserved)
├── stores/             # Global state
│   └── gameStore.ts         # Single Zustand store for all game state
└── styles/             # Global CSS
    └── global.css           # All game styles (BEM-style classes)
```

---

## Module Organization

The client has two distinct rendering layers:

1. **`components/`** — React DOM components. Render HTML/CSS, subscribe to Zustand store, emit events via `battleBridge`. One component per file.
2. **`game/`** — Phaser canvas game engine. Class-based scenes, imperative sprite manipulation. Communicates with React via `battleBridge` EventEmitter.

**Communication rule**: React and Phaser never import each other directly. All cross-layer communication goes through `battleBridge` (see `game/battleBridge.ts`).

### Adding new content

| What | Where | Pattern |
|------|-------|---------|
| New UI panel | `components/XxxPanel.tsx` | Function component, `useGameStore` selectors |
| New Phaser scene | `game/scenes/XxxScene.ts` | `class XxxScene extends Phaser.Scene` |
| New DOM↔Phaser event | `game/battleBridge.ts` | Add event name constant + JSDoc protocol comment |
| New global state | `stores/gameStore.ts` | Add field to `GameState` interface + action method |
| New custom hook | `hooks/useXxx.ts` | (Reserved — currently empty) |

---

## Naming Conventions

- **Components**: `PascalCase.tsx` — e.g. `TurnBattleUI.tsx`, `AdventureMap.tsx`
- **Phaser scenes**: `PascalCase.ts` ending with `Scene` — e.g. `BattleScene.ts`
- **Stores**: `camelCase.ts` — e.g. `gameStore.ts`
- **CSS classes**: BEM-style `block__element--modifier` — e.g. `turn-battle-ui`, `unit-frame__header`, `action-btn--attack`
- **Event names**: kebab-case strings — e.g. `'battle-end'`, `'target-selected'`

---

## Reference Files

- `packages/client/src/App.tsx` — root layout, shows component composition
- `packages/client/src/game/battleBridge.ts` — the DOM↔Phaser boundary (26 lines, well-documented)
- `packages/client/src/stores/gameStore.ts` — single Zustand store pattern
- `packages/client/src/components/TurnBattleUI.tsx` — largest component, shows sub-component pattern
