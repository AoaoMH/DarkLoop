# Type Safety

> Type definition conventions for `@darkloop/shared`. All types live in a single file `types/index.ts`, grouped by system with comment separators.

---

## When This Applies

Every type, enum, interface, and type alias in the shared package. The shared package is the single source of truth for types consumed by `client` and `server`.

---

## Local Patterns

### String enums for closed value sets

Use `enum` with string values for finite, named categories:

```typescript
// packages/shared/src/types/index.ts
export enum HeroClass { Warrior = 'Warrior' }
export enum Rarity { Common = 'Common', Rare = 'Rare', Epic = 'Epic', Legendary = 'Legendary' }
export enum SkillType { Passive = 'passive', Active = 'active' }
export enum ServerEvent { RoomCreated = 'room_created', BattleStart = 'battle_start' }
```

Reference: `packages/shared/src/types/index.ts` — `HeroClass`, `Rarity`, `EquipSlot`, `SkillType`, `ResourceKind`, `ServerEvent`, `BattlePhase`.

### Union types for open or flag-like strings

Use `type` alias with union for targeting modes, status flags, or values that may grow:

```typescript
export type SkillTargeting = 'single' | 'chain' | 'multi' | 'auto_all' | 'self';
```

### Interfaces for data structures

All game data shapes use `interface`. Fields carry Chinese inline comments:

```typescript
export interface MonsterTemplate {
  id: string;
  name: string;
  icon: string;        // emoji 或资源路径
  baseStats: PrimaryStats;
  growth: Partial<Record<keyof PrimaryStats, number>>; // 每级成长率
  skills: string[];    // 技能ID列表
  tags: string[];
}
```

Reference: `packages/shared/src/types/index.ts` — every `interface` follows this pattern.

### Type aliases for compatibility and readability

Use `type` alias to provide shorter names or preserve backward compatibility:

```typescript
export type HeroStats = PrimaryStats;
```

### Deprecation via alias preservation

When renaming a type, keep the old name as a `@deprecated` alias — do not delete it:

```typescript
/** @deprecated 使用 MonsterTemplate 替代 */
export type MonsterDef = MonsterTemplate;
```

Reference: `packages/shared/src/types/index.ts` — `MonsterDef`, `Monster`, `Affix` are all deprecated aliases.

### Section separators in types/index.ts

Group related types with a full-width comment separator:

```typescript
// ─── 装备系统 ─────────────────────────────────────────
export interface Equipment { ... }
export enum EquipSlot { ... }

// ─── 技能系统 ─────────────────────────────────────────
export interface Skill { ... }
```

---

## Import Conventions

- **Type-only imports**: Always use `import type { ... }` when importing only types:
  ```typescript
  import type { MonsterTemplate, PrimaryStats } from '../types';
  ```
- **Mixed imports**: Separate type and value imports:
  ```typescript
  import { GAME_BALANCE } from '../constants/balance';
  import type { DamageResult } from '../types';
  ```

---

## Common Mistakes

- **Adding runtime code to `types/index.ts`** — the file must contain only type declarations.
- **Deleting renamed types** — keep `@deprecated` aliases to avoid breaking consumer imports.
- **Using `any`** — use `unknown` + type guards, or define a proper interface. See `isPrimaryStatKey` in `logic/combat.ts` for the type-guard pattern.
- **Scattering types across multiple files** — all shared types belong in `types/index.ts` unless the file grows unmanageably large (currently 596 lines, still manageable).

---

## Reference Files

- `packages/shared/src/types/index.ts` — single source of truth for all shared types
- `packages/shared/src/logic/combat.ts` — type guard pattern: `isPrimaryStatKey`, `isDerivedStatKey`
