# Quality Guidelines

> Code standards for `@darkloop/client`. React 19 + Vite 6 + Phaser 3.87 + Zustand 5.

---

## When This Applies

All code in `packages/client/src/`.

---

## Local Patterns

### Import ordering

1. External packages (`react`, `zustand`, `phaser`)
2. Shared package (`@shared/types`, `@shared/constants/*`, `@shared/logic/*`)
3. Local modules (`./components/`, `./stores/`, `./game/`)

```typescript
import { useEffect, useState } from 'react';
import type { Equipment, Skill } from '@shared/types';
import { GAME_BALANCE } from '@shared/constants/balance';
import { calcDamage } from '@shared/logic/combat';
import { useGameStore } from '../stores/gameStore';
import { battleBridge } from '../game/battleBridge';
```

### Type-only imports

Use `import type` for all type-only imports:

```typescript
import type { Equipment, Skill, MonsterTemplate } from '@shared/types';
import { useGameStore } from '../stores/gameStore';
```

### Path alias `@shared/*`

All imports from the shared package use the `@shared/*` alias, configured in `tsconfig.json` and `vite.config.ts`:

```typescript
import type { Hero } from '@shared/types';
import { SKILLS } from '@shared/constants/skills';
import { simulateCombat } from '@shared/logic/combat';
```

### DOM ↔ Phaser boundary via battleBridge

React components must not import Phaser scenes or sprites directly. All cross-layer communication goes through `battleBridge`:

```typescript
// React → Phaser: request target selection
battleBridge.emit('target-request', { skillId });

// Phaser → React: target selected
battleBridge.on('target-selected', (target) => { /* ... */ });
```

See `packages/client/src/game/battleBridge.ts` for the full event protocol.

### Phaser scenes use definite assignment

Phaser scene class fields that are initialized in `create()` use the `!` definite assignment assertion:

```typescript
export class BattleScene extends Phaser.Scene {
  private heroSprite!: Phaser.Physics.Arcade.Sprite;
  private enemySprites!: EnemyDisplay[];

  create() {
    this.heroSprite = this.physics.add.sprite(...);
    // ...
  }
}
```

### CSS in global.css only

All styles go in `packages/client/src/styles/global.css`. No CSS modules, no styled-components, no inline styles. BEM class naming:

```css
.turn-battle-ui { /* ... */ }
.unit-frame__header { /* ... */ }
.action-btn--attack { /* ... */ }
```

---

## Forbidden Patterns

- **No class components** — use function components with hooks
- **No direct Phaser imports from React components** — use `battleBridge`
- **No `any` type** — import proper types from `@shared/types`
- **No `export default` for feature components** — use named exports (only `App.tsx` uses default export)
- **No scattered CSS files** — everything in `global.css`
- **No `console.log` in production** — remove debug logs before commit

---

## Common Mistakes

- **Importing Phaser into a React component** — this breaks the layer boundary. If a component needs Phaser data, emit a `battleBridge` event and let the scene respond.
- **Forgetting `import type`** — mixing type and value imports from `@shared` can cause bundler issues. Use `import type` for interfaces/enums used only as types.
- **Storing non-serializable data in Zustand** — Phaser sprites, DOM elements, and functions do not belong in the store.

---

## Verification

```bash
cd packages/client && pnpm run typecheck   # tsc --noEmit
cd packages/client && pnpm run build       # tsc && vite build
```

---

## Reference Files

- `packages/client/src/game/battleBridge.ts` — the DOM↔Phaser boundary
- `packages/client/src/stores/gameStore.ts` — `@shared/*` import pattern
- `packages/client/src/components/TurnBattleUI.tsx` — import ordering, `import type` usage
- `packages/client/src/game/scenes/BattleScene.ts` — Phaser scene class with `!` assertion
