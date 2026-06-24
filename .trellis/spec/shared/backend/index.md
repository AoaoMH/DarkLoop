# Shared Package Guidelines

> `@darkloop/shared` — pure TypeScript package with types, constants, and game logic. Consumed by both `@darkloop/client` and `@darkloop/server`. No runtime dependencies.

---

## Overview

The shared package is the single source of truth for game types, static data, and pure calculation logic. It follows a strict three-layer separation: `types/` → `constants/` → `logic/`. No layer may import from a higher layer.

---

## Guidelines Index

| Guide | Description |
|-------|-------------|
| [Directory Structure](./directory-structure.md) | Package layout, module organization, naming conventions |
| [Type Safety](./type-safety.md) | Enum/interface/union patterns, deprecation aliases, import type rules |
| [Quality Guidelines](./quality-guidelines.md) | Pure functions, frozen constants, backward-compat, forbidden patterns |
| [Error Handling](./error-handling.md) | Throw-with-context, no try-catch, type guards |

---

## Key Facts

- **No `frontend/` directory** — shared has no UI code; it is pure logic consumed by both client and server.
- **No database or logging specs** — shared has no I/O. Database and logging concerns belong to `server`.
- **Single type file** — all types live in `types/index.ts` (~600 lines), grouped by `// ─── 系统名 ───` comment separators.
- **Comments in Chinese** — inline field comments and section headers use Chinese (中文).
- **Named exports only** — no `export default` anywhere in the package.

---

## Verification

```bash
cd packages/shared && pnpm run typecheck   # tsc --noEmit
cd packages/shared && pnpm run build       # tsc (emits JS + .d.ts)
```
