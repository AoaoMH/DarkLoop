# Directory Structure

> How `@darkloop/shared` is organized. This package is pure TypeScript — types, constants, and logic with zero runtime dependencies. It is consumed by both `client` and `server`.

---

## Directory Layout

```
packages/shared/src/
├── constants/          # Static game data (frozen objects, Record maps)
│   ├── balance.ts      # GAME_BALANCE — combat/属性/element tuning knobs
│   ├── defaults.ts     # Default player/equipment state
│   ├── equipment.ts    # Equipment templates, affixes
│   ├── levels.ts       # Level definitions per region
│   ├── monsters.ts     # MONSTER_TEMPLATES — monster definitions
│   ├── regions.ts      # Region (大地区) definitions
│   ├── resources.ts    # Resource kinds and metadata
│   ├── skills.ts       # Skill definitions for heroes and monsters
│   └── talents.ts      # Talent tree definitions
├── logic/              # Pure functions — game rules and calculations
│   ├── combat.ts       # Damage formulas, stat calculation, simulateCombat
│   ├── loot.ts         # Drop table rolling
│   ├── monsterAI.ts    # Utility-scored AI skill selection
│   ├── monsterScale.ts # Monster stat scaling by level
│   ├── turnBasedCombat.ts # Turn state machine, multi-target battle logic
│   └── index.ts        # Barrel: export * from each logic module
├── types/
│   └── index.ts        # All type definitions (enums, interfaces, aliases)
└── index.ts            # Barrel: re-exports types, logic, constants
```

---

## Module Organization

The package follows a strict three-layer separation:

1. **`types/`** — Type definitions only. Zero runtime code. No imports from `constants/` or `logic/`.
2. **`constants/`** — Static data objects. Import types from `types/` only. No logic beyond simple getter helpers.
3. **`logic/`** — Pure functions. Import types from `types/` and data from `constants/`. No I/O, no side effects (with documented exceptions like uid counters).

**Dependency direction**: `logic/` → `constants/` → `types/`. Never reverse. `types/` depends on nothing.

### Adding new content

| What | Where | Pattern |
|------|-------|---------|
| New type/interface/enum | `types/index.ts` | Add in the matching `// ─── 系统名 ───` section |
| New static data | `constants/<domain>.ts` | `export const XXX: Record<string, Interface> = { ... }` |
| New game rule/calculation | `logic/<domain>.ts` | Pure exported function, import types via `import type` |
| New domain crossing boundaries | Create file in matching layer, add to barrel `index.ts` |

---

## Naming Conventions

- **Files**: `camelCase.ts` — e.g. `monsterScale.ts`, `turnBasedCombat.ts`
- **Constants**: `UPPER_SNAKE_CASE` — e.g. `GAME_BALANCE`, `MONSTER_TEMPLATES`
- **Types/Interfaces**: `PascalCase` — e.g. `MonsterTemplate`, `TurnState`
- **Enums**: `PascalCase` with `PascalCase` members — e.g. `enum HeroClass { Warrior }`
- **Functions**: `camelCase` — e.g. `calcDamage`, `getMonsterTemplate`
- **Barrel files**: Always `index.ts` using `export * from './module'`

---

## Reference Files

- `packages/shared/src/index.ts` — root barrel, shows full export surface
- `packages/shared/src/types/index.ts` — 596-line type file, sectioned by `// ───` comment separators
- `packages/shared/src/constants/monsters.ts` — example of `Record<string, Interface>` data pattern
- `packages/shared/src/logic/combat.ts` — example of pure function module with internal helpers
