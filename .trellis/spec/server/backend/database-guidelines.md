# Database Guidelines

> Prisma 6 with SQLite for development. The schema currently has `Player` and `Session` models. Prisma client integration is partially stubbed (route handlers have TODOs).

---

## When This Applies

All database access in `packages/server/`. Schema lives in `prisma/schema.prisma` at the repo root.

---

## Local Patterns

### Prisma schema — SQLite for dev

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Player {
  id        String   @id @default(uuid())
  username  String   @unique
  email     String?  @unique
  password  String
  saveData  String   @default("{}") // JSON 序列化的 PlayerSave
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  sessions  Session[]
}
```

### Save data as JSON string

Player save data is stored as a JSON-serialized string in `saveData`, not as a relation or JSON column:

```typescript
// Saving
const saveJson = JSON.stringify(playerSave);
await prisma.player.update({ where: { id }, data: { saveData: saveJson } });

// Loading
const player = await prisma.player.findUnique({ where: { id } });
const save = JSON.parse(player.saveData) as PlayerSave;
```

This keeps the schema simple and avoids migration when `PlayerSave` fields change.

### Config-driven database URL

The database URL comes from `config.ts`, which reads from `DATABASE_URL` env var with a default of `file:./darkloop.db`:

```typescript
// packages/server/src/config.ts
export const config = {
  database: {
    url: process.env.DATABASE_URL || 'file:./darkloop.db',
  },
  // ...
};
```

### Prisma client instantiation

Prisma client is imported as `@prisma/client`:

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
```

**Note**: As of this writing, route handlers in `player.ts` have commented-out Prisma code with TODO markers. The integration is not yet active.

---

## Migration Commands

```bash
# Generate Prisma client from schema
pnpm db:generate

# Push schema to database (dev — no migration files)
pnpm db:push
```

The project uses `db:push` (schema push) for development, not `db:migrate`. This avoids migration file management during rapid development.

---

## Forbidden Patterns

- **No raw SQL** — use Prisma client methods only
- **No `saveData` as a relation** — save data is a JSON string, not a separate table
- **No Prisma client in `@shared`** — database access is server-only

---

## Common Mistakes

- **Forgetting `.js` extension** — ESM imports of Prisma client work without extension (it's a node_modules package), but relative imports in server code must have `.js`
- **Not running `db:generate` after schema change** — the Prisma client type won't update until you regenerate

---

## Reference Files

- `prisma/schema.prisma` — Player + Session models, SQLite provider
- `packages/server/src/config.ts` — database URL config
- `packages/server/src/routes/player.ts` — TODO stubs for Prisma queries
