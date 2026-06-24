# Error Handling

> Error patterns for `@darkloop/server`. Fastify provides built-in error handling via reply codes and the `main().catch()` top-level guard.

---

## When This Applies

All code in `packages/server/src/`.

---

## Local Patterns

### Top-level guard in index.ts

The server entry point wraps bootstrap in `main().catch()` to ensure unhandled errors crash the process with a clear message:

```typescript
// packages/server/src/index.ts
async function main() {
  const app = Fastify({ logger: true });
  // ... setup ...
  await app.listen({ port: config.port, host: config.host });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### Route handler error responses

Route handlers return appropriate HTTP status codes via `reply.code()` or throw to let Fastify handle:

```typescript
// packages/server/src/routes/player.ts
app.get('/api/player/:id', async (request, reply) => {
  const { id } = request.params as { id: string };

  // TODO: Prisma query
  // const player = await prisma.player.findUnique({ where: { id } });
  // if (!player) {
  //   reply.code(404).send({ error: 'Player not found' });
  //   return;
  // }

  reply.code(501).send({ error: 'Not implemented' });  // stub response
});
```

### Fastify logger for errors

Use `app.log.error()` or `request.log.error()` for error logging within route handlers:

```typescript
app.get('/api/player/:id', async (request, reply) => {
  try {
    // ... logic
  } catch (err) {
    request.log.error(err);
    reply.code(500).send({ error: 'Internal server error' });
  }
});
```

### Socket.IO error propagation

Socket event handlers log errors via `app.log` and emit error events back to the client — they do not crash the process:

```typescript
// packages/server/src/index.ts
io.on('connection', (socket) => {
  socket.on(ServerEvent.JoinRoom, (data) => {
    try {
      socket.join(data.roomId);
      app.log.info(`Player ${data.playerId} joined room ${data.roomId}`);
    } catch (err) {
      app.log.error(err);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });
});
```

---

## Forbidden Patterns

- **No swallowing errors** — every `catch` must log or rethrow
- **No `process.exit()` outside `main().catch()`** — only the top-level guard may exit the process
- **No custom error classes (yet)** — use Fastify's built-in error handling. If custom errors are needed later, extend `FastifyError`.
- **No `throw` in Socket.IO handlers** — catch and emit error events instead; throwing would crash the connection handler

---

## Common Mistakes

- **Forgetting to `reply.code()` before `send()`** — Fastify defaults to 200; always set the correct status for error responses
- **Letting Prisma errors reach the client** — wrap database calls in try-catch and return a generic error message, not the Prisma error details
- **Not logging in catch blocks** — `catch (err) { request.log.error(err); ... }` is required, not optional

---

## Reference Files

- `packages/server/src/index.ts` — top-level `main().catch()` guard
- `packages/server/src/routes/player.ts` — route handler with `reply.code()` pattern
