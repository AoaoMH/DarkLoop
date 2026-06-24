# Directory Structure

> How `@darkloop/server` is organized. Fastify 5 + Prisma 6 + Socket.IO 4.8.

---

## Directory Layout

```
packages/server/src/
├── config.ts              # Env-driven config with defaults
├── index.ts               # Entry point — Fastify + Socket.IO bootstrap
├── middleware/            # Fastify middleware (currently empty — reserved)
├── rooms/
│   └── RoomManager.ts     # Socket.IO room management class
├── routes/
│   ├── index.ts           # Barrel: export { playerRoutes }
│   └── player.ts          # Player REST routes (Fastify plugin)
└── services/              # Business services (currently empty — reserved)

prisma/
└── schema.prisma          # Prisma schema — Player + Session models (SQLite)
```

---

## Module Organization

The server follows Fastify's plugin architecture:

1. **`index.ts`** — Bootstrap: creates Fastify instance, registers CORS + routes, attaches Socket.IO, starts listening.
2. **`routes/`** — Fastify route plugins. Each file exports an `async function xxxRoutes(app: FastifyInstance)`.
3. **`rooms/`** — Socket.IO room management. The `RoomManager` class handles multiplayer room state.
4. **`config.ts`** — Centralized configuration read from environment variables with defaults.
5. **`middleware/`** and **`services/`** — Reserved for future use (currently empty).

### Adding new content

| What | Where | Pattern |
|------|-------|---------|
| New REST route group | `routes/<domain>.ts` | `export async function xxxRoutes(app: FastifyInstance) {}`, register in `index.ts` |
| New Socket.IO handler | `rooms/<Name>Manager.ts` | Class with constructor injection of `SocketServer` |
| New middleware | `middleware/<name>.ts` | Fastify plugin, register in `index.ts` |
| New Prisma model | `prisma/schema.prisma` | Add model, run `pnpm db:generate` |

---

## Naming Conventions

- **Files**: `camelCase.ts` — e.g. `RoomManager.ts`, `player.ts`
- **Route plugins**: `xxxRoutes` function name — e.g. `playerRoutes`
- **Classes**: `PascalCase` — e.g. `RoomManager`
- **Config object**: `config` (lowercase, single export)
- **ESM imports**: Always use `.js` extension in relative imports: `from './config.js'`

---

## ESM Import Rule

The server runs as ESM (`"type": "module"` in `package.json`). All relative imports must include the `.js` extension:

```typescript
// CORRECT
import { config } from './config.js';
import { playerRoutes } from './routes/index.js';

// WRONG — will fail at runtime in ESM
import { config } from './config';
```

Imports from `@shared/*` do not need extensions — they resolve through the workspace package.

---

## Reference Files

- `packages/server/src/index.ts` — bootstrap pattern, Fastify + Socket.IO setup
- `packages/server/src/routes/player.ts` — route plugin pattern
- `packages/server/src/rooms/RoomManager.ts` — class with Socket.IO integration
- `packages/server/src/config.ts` — env-driven config pattern
- `prisma/schema.prisma` — database schema
