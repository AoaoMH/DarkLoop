# Type Safety

> Type patterns for `@darkloop/client`. All game types are imported from `@shared/types` — the client defines very few local types.

---

## When This Applies

All `.tsx` and `.ts` files in `packages/client/src/`.

---

## Local Patterns

### Import game types from shared

All game domain types (Hero, Equipment, Skill, Monster, etc.) come from `@shared/types`:

```typescript
import type { Hero, Equipment, Skill, MonsterTemplate, LevelProgress } from '@shared/types';
```

The client package must not redefine game domain types locally.

### Local interfaces for component props and display

Define local interfaces for React props and Phaser display objects:

```typescript
// React component props
interface UnitFrameProps {
  name: string;
  hp: number;
  maxHp: number;
  isHero: boolean;
}

// Phaser display object (BattleScene.ts)
interface EnemyDisplay {
  sprite: Phaser.GameObjects.Container;
  hpText: Phaser.GameObjects.Text;
  index: number;
  monster: Monster;
}
```

### Type-only imports for shared types

When importing only types from `@shared`, use `import type`:

```typescript
import type { Equipment, Skill } from '@shared/types';
import { SKILLS } from '@shared/constants/skills';  // value import
```

### Definite assignment in Phaser scenes

Phaser scene fields initialized in `create()` use `!` to satisfy the compiler:

```typescript
export class BattleScene extends Phaser.Scene {
  private heroSprite!: Phaser.Physics.Arcade.Sprite;
  private enemySprites!: EnemyDisplay[];
  private currentTurn!: 'hero' | 'enemy';
}
```

This is safe because Phaser's lifecycle guarantees `create()` runs before any method using these fields.

### Record maps for emoji and color lookups

Static lookup tables in Phaser scenes use `Record<string, string>` or `Record<string, number>`:

```typescript
// packages/client/src/game/scenes/BattleScene.ts
const BUFF_EMOJI: Record<string, string> = {
  poison: '🟢',
  stun: '💫',
  bleed: '🩸',
};

const DAMAGE_COLOR: Record<string, number> = {
  physical: 0xff4444,
  magical: 0x4444ff,
  crit: 0xffaa00,
};
```

### Event payload types on battleBridge

The `battleBridge` event payloads are typed via interfaces:

```typescript
// packages/client/src/game/battleBridge.ts
export interface TargetRequestPayload {
  skillId: string;
  targeting: SkillTargeting;
}

export interface TargetSelectedPayload {
  index: number;
  monsterId: string;
}
```

---

## Forbidden Patterns

- **No `any`** — use `unknown` or import a proper type from `@shared/types`
- **No local redefinition of shared types** — if a type exists in `@shared/types`, import it; do not redefine
- **No non-null assertion `!` on React refs** — use optional chaining or null checks. `!` is only for Phaser scene lifecycle fields.
- **No `as unknown as X` double cast** — refactor the type boundary instead

---

## Common Mistakes

- **Forgetting `import type`** — `import { Hero } from '@shared/types'` when `Hero` is only used as a type causes unnecessary runtime imports
- **Using `any` for Phaser event payloads** — define an interface in `battleBridge.ts` and use it
- **Storing Phaser types in Zustand** — `Phaser.GameObjects.Sprite` is not serializable. Store the monster's `index` or `id` instead.

---

## Reference Files

- `packages/client/src/components/TurnBattleUI.tsx` — `interface XxxProps` pattern
- `packages/client/src/game/scenes/BattleScene.ts` — `EnemyDisplay` interface, `!` definite assignment
- `packages/client/src/game/battleBridge.ts` — typed event payloads
- `packages/client/src/stores/gameStore.ts` — `@shared/types` import pattern
