# Quality Guidelines

> Code standards for `@darkloop/server`. Fastify 5 + Prisma 6 + Socket.IO 4.8, running as ESM.

---

## When This Applies

All code in `packages/server/src/`.

---

## Local Patterns

### Fastify route plugin pattern

Routes are organized as Fastify plugins, exported as async functions and registered in `index.ts`:

```typescript
// packages/server/src/routes/player.ts
import type { FastifyInstance } from 'fastify';

export async function playerRoutes(app: FastifyInstance) {
  app.get('/api/player/:id', async (request, reply) => {
    // ...
  });
}

// packages/server/src/routes/index.ts
export { playerRoutes } from './player';

// packages/server/src/index.ts
await app.register(playerRoutes);
```

### Type-only imports for Fastify types

```typescript
import type { FastifyInstance } from 'fastify';
import type { PlayerSave } from '@shared/types';
```

### Route parameter destructuring with type assertion

```typescript
app.get('/api/player/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  // ...
});
```

### Config from environment

All configuration reads from `process.env` with sensible defaults, centralized in `config.ts`:

```typescript
// packages/server/src/config.ts
export const config = {
  port: Number(process.env.PORT) || 4000,
  host: process.env.HOST || '0.0.0.0',
  database: { url: process.env.DATABASE_URL || 'file:./darkloop.db' },
  jwt: { secret: process.env.JWT_SECRET || 'darkloop-dev-secret-change-in-production', expiresIn: '7d' },
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3000' },
  balanceOverrides: {},
};
```

### ServerEvent enum for Socket.IO events

Socket.IO event names come from the shared `ServerEvent` enum, not hardcoded strings:

```typescript
import { ServerEvent } from '@shared/types';

io.on('connection', (socket) => {
  socket.on(ServerEvent.JoinRoom, (data) => { /* ... */ });
});
```

### RoomManager class with constructor injection

```typescript
// packages/server/src/rooms/RoomManager.ts
import type { Server as SocketServer } from 'socket.io';

export class RoomManager {
  constructor(private io: SocketServer) {}

  createPrivateRoom(playerId: string): string { /* ... */ }
  joinRoom(socketId: string, roomId: string, playerId: string): void { /* ... */ }
}
```

### Health check endpoint

```typescript
app.get('/api/health', async () => ({ status: 'ok', version: '0.1.0' }));
```

---

## Forbidden Patterns

- **No hardcoded event names** — use `ServerEvent` enum from `@shared/types`
- **No `.js`-less relative imports** — ESM requires extensions: `from './config.js'`
- **No `console.log`** — use `app.log` (see [Logging Guidelines](./logging-guidelines.md))
- **No Prisma client in `@shared`** — database access is server-only
- **No `any` for request params** — use `as { id: string }` type assertion or define a schema
- **No business logic in route handlers** — keep routes thin; move complex logic to `services/` (when populated)

---

## Common Mistakes

- **Forgetting `.js` in relative imports** — `import { config } from './config'` fails at runtime in ESM. Always use `from './config.js'`.
- **Not using `ServerEvent` enum** — hardcoding `'room_created'` as a string breaks if the enum value changes
- **Mixing `import type` and `import`** — `import { FastifyInstance } from 'fastify'` imports a type as a value. Use `import type`.

---

## Verification

```bash
cd packages/server && pnpm run build       # tsc (type-check + emit)
cd packages/server && pnpm run start       # node dist/index.js
```

---

## Reference Files

- `packages/server/src/index.ts` — bootstrap, plugin registration, Socket.IO setup
- `packages/server/src/routes/player.ts` — route plugin pattern, type assertion for params
- `packages/server/src/rooms/RoomManager.ts` — class with constructor injection
- `packages/server/src/config.ts` — env-driven config
