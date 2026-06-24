# Quality Guidelines

> Code standards for `@darkloop/shared`. This package is pure TypeScript with no runtime dependencies — every function must be deterministic and side-effect-free (with documented exceptions).

---

## When This Applies

All code in `packages/shared/src/`. Specifically `constants/`, `logic/`, and `types/`.

---

## Local Patterns

### Pure functions in logic/

Functions in `logic/` must be pure: same input → same output, no external state mutation, no I/O.

```typescript
// packages/shared/src/logic/combat.ts
export function calcDamage(attacker: PrimaryStats, defender: PrimaryStats, ...): DamageResult {
  // pure calculation, returns new object
}
```

**Documented exception**: `logic/monsterScale.ts` uses a module-level mutable counter `let uidCounter = 0` for runtime uid generation. This is the only acceptable side effect in `logic/`.

### Frozen constants

All static data objects use `as const` or are typed as `Record<string, Interface>`:

```typescript
// packages/shared/src/constants/balance.ts
export const GAME_BALANCE = {
  combat: { defenseK: 100, ... },
  level: { growthPerLevel: 0.05, ... },
} as const;

// packages/shared/src/constants/monsters.ts
export const MONSTER_TEMPLATES: Record<string, MonsterTemplate> = {
  'slime_green': { id: 'slime_green', name: '绿色史莱姆', ... },
  ...
};
```

### Helper getters at module bottom

Static data files may include a simple getter function at the end, placed after the data map:

```typescript
// packages/shared/src/constants/monsters.ts
export const MONSTER_TEMPLATES: Record<string, MonsterTemplate> = { ... };

export function getMonsterTemplate(id: string): MonsterTemplate {
  const t = MONSTER_TEMPLATES[id];
  if (!t) throw new Error(`Monster template not found: ${id}`);
  return t;
}
```

### Backward-compatible aliases

When refactoring a function name, keep the old name as an alias export:

```typescript
// packages/shared/src/logic/combat.ts
export const calcFinalStats = calcCombinedPrimary; // backward-compat alias
```

### Internal helpers are not exported

Utility functions used only within a module are defined but not exported. Exported functions form the public API.

```typescript
// packages/shared/src/logic/combat.ts
function getAllMods(equipment: Equipment[]): Partial<PrimaryStats> { ... }  // internal
function isPrimaryStatKey(key: string): key is keyof PrimaryStats { ... }   // internal type guard

export function calcCombinedPrimary(...): PrimaryStats { ... }              // public
```

### Math operations

Use `Math.floor` for integer results, `Math.min`/`Math.max` for clamping, `Math.random` for RNG. Never use `~~` or bitwise tricks for rounding.

---

## Forbidden Patterns

- **No `any` type** — use `unknown` with type guards, or define a proper interface
- **No side effects in `logic/`** — except the documented `uidCounter` in `monsterScale.ts`
- **No imports from `client` or `server`** — dependency direction is one-way: `shared` is imported, never imports
- **No class declarations** — shared uses functions and interfaces, not classes
- **No `console.log`** — shared has no logging responsibility
- **No async/await** — all functions are synchronous

---

## Common Mistakes

- **Forgetting `as const`** on balance/config objects — without it, TypeScript widens literal types and numeric tuning knobs lose their precision
- **Exporting internal helpers** — if a function is only used in its own module, don't export it
- **Importing types without `import type`** — causes unnecessary runtime imports in some bundlers
- **Using `export default`** — shared uses named exports only, so consumers can selectively import

---

## Verification

```bash
# Type-check the shared package
cd packages/shared && pnpm run typecheck

# Build (emits JS + .d.ts)
cd packages/shared && pnpm run build
```

---

## Reference Files

- `packages/shared/src/logic/combat.ts` — pure functions, internal helpers, backward-compat alias
- `packages/shared/src/constants/balance.ts` — `as const` frozen object pattern
- `packages/shared/src/constants/monsters.ts` — `Record<string, Interface>` + getter pattern
- `packages/shared/src/logic/monsterScale.ts` — documented side-effect exception (uid counter)
