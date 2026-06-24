# Component Guidelines

> React component patterns for `@darkloop/client`. Function components only — no class components in React layer (classes are reserved for Phaser scenes).

---

## When This Applies

All `.tsx` files in `packages/client/src/components/` and the root `App.tsx`.

---

## Local Patterns

### Function component with named or default export

```typescript
// packages/client/src/components/TurnBattleUI.tsx
export function TurnBattleUI() {
  const enemyHp = useGameStore((s) => s.enemyHp);
  // ...
  return <div className="turn-battle-ui">...</div>;
}
```

`App.tsx` uses default export; feature components use named exports.

### Props interface above the component

Define a `interface XxxProps` immediately above the component:

```typescript
interface UnitFrameProps {
  name: string;
  hp: number;
  maxHp: number;
  isHero: boolean;
}

function UnitFrame({ name, hp, maxHp, isHero }: UnitFrameProps) {
  // ...
}
```

### Sub-components in the same file

Small sub-components used only by one parent are defined in the same file, below the main component:

```typescript
// packages/client/src/components/TurnBattleUI.tsx
export function TurnBattleUI() { ... }

function UnitFrame(props: UnitFrameProps) { ... }
function StepBar(props: StepBarProps) { ... }
function BattleLog(props: BattleLogProps) { ... }
function BattleResultPanel(props: BattleResultPanelProps) { ... }
```

Only the main component is exported. Sub-components are file-private.

### Zustand selector pattern — one per field

Subscribe to store fields with individual selectors, not a single object selector:

```typescript
// CORRECT — fine-grained selectors
const enemyHp = useGameStore((s) => s.enemyHp);
const enemyMaxHp = useGameStore((s) => s.enemyMaxHp);
const isPlayerTurn = useGameStore((s) => s.isPlayerTurn);

// WRONG — causes re-render on any state change
const { enemyHp, enemyMaxHp } = useGameStore((s) => s);
```

### battleBridge event subscription via useEffect

Subscribe to Phaser events in `useEffect` with a cleanup return:

```typescript
useEffect(() => {
  const handler = (target: EnemyDisplay) => { /* ... */ };
  battleBridge.on('target-selected', handler);
  return () => { battleBridge.off('target-selected', handler); };
}, []);
```

### BEM-style CSS classes

Class names follow `block__element--modifier` convention:

```tsx
<div className="turn-battle-ui">
  <div className="party-panel party-panel--left">
    <div className="unit-frame">
      <div className="unit-frame__header">{name}</div>
    </div>
  </div>
  <button className="action-btn action-btn--attack">攻击</button>
</div>
```

All styles live in `styles/global.css` — no CSS modules, no styled-components.

---

## Forbidden Patterns

- **No class components** — `class Xxx extends React.Component` is forbidden in the React layer
- **No object selectors** — `useGameStore((s) => s)` causes excessive re-renders
- **No direct Phaser imports from components** — use `battleBridge` for communication
- **No inline styles** — use BEM classes in `global.css`
- **No `useMemo`/`useCallback` without measurement** — this project is small; premature optimization adds noise

---

## Common Mistakes

- **Forgetting cleanup in useEffect** — every `battleBridge.on()` must have a matching `off()` in the cleanup return
- **Creating new objects in selectors** — `useGameStore((s) => ({ a: s.a, b: s.b }))` creates a new object every render, causing infinite loops. Use separate selectors instead.
- **Mixing Phaser state into Zustand** — Phaser sprite positions and scene state stay in Phaser. Only game logic state (hp, turn, rewards) goes in Zustand.

---

## Reference Files

- `packages/client/src/components/TurnBattleUI.tsx` — sub-component pattern, BEM classes, battleBridge subscription
- `packages/client/src/components/AdventureMap.tsx` — SVG-based component with Zustand selectors
- `packages/client/src/App.tsx` — root layout, conditional rendering based on store state
