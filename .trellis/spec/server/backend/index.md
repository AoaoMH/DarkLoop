# Server Backend Guidelines

> `@darkloop/server` — Fastify 5 + Prisma 6 (SQLite) + Socket.IO 4.8. Runs as ESM (`"type": "module"`).

---

## Overview

The server is a Fastify application with REST routes for player data and Socket.IO for multiplayer room management. Prisma with SQLite handles persistence. Configuration is environment-driven with development defaults.

**Current state**: REST routes and Prisma integration are partially stubbed (TODOs in `player.ts`). Socket.IO room management is functional for solo play.

---

## Guidelines Index

| Guide | Description |
|-------|-------------|
| [Directory Structure](./directory-structure.md) | Package layout, ESM import rules, naming conventions |
| [Database Guidelines](./database-guidelines.md) | Prisma schema, save data as JSON string, migration commands |
| [Error Handling](./error-handling.md) | Top-level guard, route error responses, Socket.IO error events |
| [Logging Guidelines](./logging-guidelines.md) | Fastify Pino logger, log levels, no console.log |
| [Quality Guidelines](./quality-guidelines.md) | Route plugin pattern, ServerEvent enum, config, forbidden patterns |

---

## Key Facts

- **ESM module** — `"type": "module"` in `package.json`. Relative imports require `.js` extension.
- **Path alias**: `@shared/*` maps to `packages/shared/src/` (configured in `tsconfig.json`)
- **Comments in Chinese** — inline comments and file headers use Chinese (中文)
- **Fastify logger** — `Fastify({ logger: true })` enables Pino. Use `app.log` / `request.log`.
- **Socket.IO events** — use `ServerEvent` enum from `@shared/types`, never hardcode strings
- **Database** — SQLite via Prisma. Schema in `prisma/schema.prisma`. Dev uses `db:push` (no migration files).
- **No `frontend/` directory** — server has no frontend code
- **No test files** — the project has no test framework configured

---

## Verification

```bash
cd packages/server && pnpm run build       # tsc (type-check + emit)
cd packages/server && pnpm run start       # node dist/index.js

# Database
pnpm db:generate     # regenerate Prisma client after schema change
pnpm db:push         # push schema to SQLite database
```
