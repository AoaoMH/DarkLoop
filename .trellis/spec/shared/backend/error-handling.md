# Error Handling

> Error patterns for `@darkloop/shared`. Logic functions are pure and do not catch errors — they throw and let the caller decide.

---

## When This Applies

All code in `packages/shared/src/logic/` and `packages/shared/src/constants/` helper functions.

---

## Local Patterns

### Throw with contextual messages

When a precondition fails, throw an `Error` with a message that includes the offending value:

```typescript
// packages/shared/src/constants/monsters.ts
export function getMonsterTemplate(id: string): MonsterTemplate {
  const t = MONSTER_TEMPLATES[id];
  if (!t) throw new Error(`Monster template not found: ${id}`);
  return t;
}

// packages/shared/src/logic/monsterScale.ts
export function createMonsterFromTemplate(templateId: string, level: number): Monster {
  const template = MONSTER_TEMPLATES[templateId];
  if (!template) throw new Error(`Monster template not found: ${templateId}`);
  // ...
}
```

### No try-catch in shared

Shared logic functions never wrap their own code in `try-catch`. Errors propagate to the caller (`client` store or `server` route), which is responsible for user-facing handling.

### Guard clauses at function entry

Validate inputs early and return or throw before the main logic:

```typescript
export function calcDamage(attacker: PrimaryStats, defender: PrimaryStats, ...): DamageResult {
  if (attacker.atk <= 0) return { damage: 0, isCrit: false, ... };
  // ... main calculation
}
```

### Type guards for runtime safety

Use type-guard functions to narrow `unknown` or `string` to specific types:

```typescript
// packages/shared/src/logic/combat.ts
const PRIMARY_KEYS = ['str', 'agi', 'int', 'vit', 'luk'] as const;
function isPrimaryStatKey(key: string): key is keyof PrimaryStats {
  return (PRIMARY_KEYS as string[]).includes(key);
}
```

---

## Forbidden Patterns

- **No `try-catch` inside shared logic** — let errors propagate
- **No silent failures** — never return `undefined` or a default value when an invariant is violated; throw instead
- **No custom error classes** — use plain `Error`. The shared package has no error hierarchy.
- **No error codes** — the message string is the error identity

---

## Common Mistakes

- **Catching errors too early** — a `client` component wrapping `calcDamage` in try-catch hides bugs. Let it throw; the store or UI boundary should handle it.
- **Throwing without context** — `throw new Error('Not found')` is useless. Always include the id/value: `throw new Error('Monster template not found: ${id}')`.

---

## Reference Files

- `packages/shared/src/constants/monsters.ts` — `getMonsterTemplate` throws with id context
- `packages/shared/src/logic/monsterScale.ts` — `createMonsterFromTemplate` validates template existence
- `packages/shared/src/logic/combat.ts` — type guard pattern `isPrimaryStatKey`
