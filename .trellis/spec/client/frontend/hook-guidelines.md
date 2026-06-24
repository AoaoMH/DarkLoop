# Hook Guidelines

> React hook usage in `@darkloop/client`. The `hooks/` directory is currently empty — custom hooks are reserved for future extraction. In-component hook usage follows the patterns below.

---

## When This Applies

All `.tsx` files in `packages/client/src/components/` and `App.tsx`.

---

## Local Patterns

### useState for local UI state

Component-local state (modal open, selected index, hover state) uses `useState`:

```typescript
// packages/client/src/components/TurnBattleUI.tsx
const [showResult, setShowResult] = useState(false);
const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
```

### useEffect for battleBridge subscriptions

When a component needs to listen to Phaser events, subscribe in `useEffect` with an empty dependency array and return a cleanup function:

```typescript
useEffect(() => {
  const onTargetSelected = (target: EnemyDisplay) => {
    setSelectedTarget(target.index);
    setWaitingForTarget(false);
  };

  battleBridge.on('target-selected', onTargetSelected);

  return () => {
    battleBridge.off('target-selected', onTargetSelected);
  };
}, []);
```

**Rules**:
- Dependency array is `[]` for event subscriptions — the handler should read latest state via store, not closures.
- Every `on()` must have a matching `off()` in cleanup.
- Never subscribe inside render or outside `useEffect`.

### useGameStore selectors as the primary data hook

The most common hook usage is `useGameStore((s) => s.field)` — one selector per field:

```typescript
const enemyHp = useGameStore((s) => s.enemyHp);
const enemyMaxHp = useGameStore((s) => s.enemyMaxHp);
const isPlayerTurn = useGameStore((s) => s.isPlayerTurn);
```

See [State Management](./state-management.md) for the full store pattern.

### No useEffect for derived data

If a value can be computed from existing state during render, do not sync it via `useEffect`:

```typescript
// CORRECT — compute during render
const hpPercent = enemyHp / enemyMaxHp * 100;

// WRONG — syncing via useEffect
const [hpPercent, setHpPercent] = useState(0);
useEffect(() => { setHpPercent(enemyHp / enemyMaxHp * 100); }, [enemyHp, enemyMaxHp]);
```

---

## When to Extract a Custom Hook

The `hooks/` directory is empty by design — extract a custom hook only when:

1. The same `useEffect` + state logic is duplicated across 2+ components
2. The hook encapsulates a non-trivial battleBridge protocol (e.g. `useTargetSelection()`)
3. The hook name would improve component readability

When extracting, place in `hooks/useXxx.ts` and export as named export.

---

## Forbidden Patterns

- **No `useEffect` for store sync** — Zustand is already reactive. Do not mirror store state into local `useState` via `useEffect`.
- **No async `useEffect` without cleanup** — if the effect starts an async operation, ensure it can be cancelled (flag check, AbortController).
- **No hooks in conditionals or loops** — Rules of Hooks. Always call hooks at the top level of the component.

---

## Reference Files

- `packages/client/src/components/TurnBattleUI.tsx` — `useEffect` + `battleBridge` subscription pattern
- `packages/client/src/components/AdventureMap.tsx` — `useState` for local UI state
