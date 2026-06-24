# Logging Guidelines

> `@darkloop/server` uses Fastify's built-in Pino logger (`app.log`) and Socket.IO's logger. No external logging library.

---

## When This Applies

All code in `packages/server/src/`.

---

## Local Patterns

### Fastify built-in logger

Fastify is created with `logger: true`, which enables Pino as `app.log`:

```typescript
// packages/server/src/index.ts
const app = Fastify({ logger: true });

// Usage:
app.log.info(`DarkLoop server running at http://${config.host}:${config.port}`);
app.log.info(`Socket connected: ${socket.id}`);
app.log.error(err);
```

### Request-scoped logger

Inside route handlers, use `request.log` for request-scoped logging:

```typescript
app.get('/api/player/:id', async (request, reply) => {
  request.log.info({ id: request.params }, 'Fetching player');
  // ...
});
```

### Log levels in practice

| Level | Usage |
|-------|-------|
| `info` | Server startup, socket connect/disconnect, room join/leave |
| `warn` | (Reserved — not currently used) |
| `error` | Unhandled errors in catch blocks, failed operations |

### Console.error only in top-level guard

`console.error` is used only in `main().catch()` for the top-level fatal error handler. All other logging goes through `app.log`:

```typescript
// index.ts — the ONLY place console.error is acceptable
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

---

## Forbidden Patterns

- **No `console.log`** — use `app.log.info()` or `request.log.info()`
- **No `console.error` outside `main().catch()`** — use `app.log.error()` instead
- **No string interpolation in log objects** — Pino supports structured logging; pass objects for searchability:
  ```typescript
  // CORRECT
  request.log.info({ playerId: id }, 'Player fetched');

  // LESS IDEAL (but acceptable for simple messages)
  app.log.info(`Player ${id} joined room ${roomId}`);
  ```
- **No external logging libraries** — Pino (via Fastify) is the logger

---

## Common Mistakes

- **Using `console.log` for debugging** — remove before commit, or use `app.log.debug()` if the log level is enabled
- **Logging sensitive data** — never log passwords, tokens, or full save data. Log the player id and a summary instead.

---

## Reference Files

- `packages/server/src/index.ts` — `Fastify({ logger: true })`, `app.log.info()` / `app.log.error()` usage
