# Client Frontend Guidelines

> `@darkloop/client` — React 19 + Vite 6 + Phaser 3.87 + Zustand 5. The game UI is split into a React DOM layer and a Phaser canvas layer, connected by `battleBridge`.

---

## Overview

The client has two rendering layers that never import each other directly:
- **React DOM** (`components/`) — menus, panels, battle HUD
- **Phaser Canvas** (`game/scenes/`) — battle sprites, animations, target selection

All cross-layer communication goes through `battleBridge` (a `Phaser.Events.EventEmitter` singleton). Global state lives in a single Zustand store (`gameStore.ts`).

---

## Guidelines Index

| Guide | Description |
|-------|-------------|
| [Directory Structure](./directory-structure.md) | Package layout, two-layer architecture, naming conventions |
| [Component Guidelines](./component-guidelines.md) | Function components, props, sub-components, BEM CSS, store selectors |
| [Hook Guidelines](./hook-guidelines.md) | useState, useEffect for battleBridge, no custom hooks yet |
| [State Management](./state-management.md) | Single Zustand store, immutable updates, localStorage persistence |
| [Quality Guidelines](./quality-guidelines.md) | Import ordering, @shared alias, DOM↔Phaser boundary, forbidden patterns |
| [Type Safety](./type-safety.md) | Import types from @shared, local props interfaces, Phaser definite assignment |

---

## Key Facts

- **Path alias**: `@shared/*` maps to `packages/shared/src/` (configured in `tsconfig.json` + `vite.config.ts`)
- **Comments in Chinese** — inline comments use Chinese (中文)
- **Single CSS file** — `styles/global.css` contains all styles, BEM naming
- **No test files** — the project has no test framework configured
- **`hooks/` directory is empty** — custom hooks are reserved for future extraction
- **Build**: `tsc && vite build` — TypeScript must pass before Vite bundles

---

## Verification

```bash
cd packages/client && pnpm run typecheck   # tsc --noEmit
cd packages/client && pnpm run build       # tsc && vite build
```
