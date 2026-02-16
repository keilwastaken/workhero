# File Path Reference

A map of the codebase for folks navigating the project.

## Overview

```
workhero/
├── packages/           # pnpm workspace packages
│   ├── db/             # @workhero/db — LMDB connection, models
│   ├── repositories/   # @workhero/repositories — BirdRepository, TicketRepository
│   └── queue/          # @workhero/queue — processor, runner
├── src/                # Application layer
│   ├── api/            # HTTP layer (routers, swagger, trace)
│   ├── service/        # BirdService, BirdController, DTOs
│   ├── config.ts
│   ├── index.ts        # API server entry
│   ├── worker.ts       # Worker process entry
│   └── scripts/        # db:clear
└── pnpm-workspace.yaml
```

---

## packages/ (pnpm workspace)

### @workhero/db

LMDB connection and models. Import: `import { DbConnection, Bird, Ticket } from '@workhero/db'`

| File | Purpose |
|------|---------|
| `connection.ts` | `DbConnection(path)` — opens LMDB, provides `table<V>(name)` |
| `models/bird.ts` | `Bird` interface |
| `models/ticket.ts` | `Ticket<TResult>`, `BirdSummary`, `BirdTicket` |
| `index.ts` | Re-exports |

### @workhero/repositories

Data access layer. Import: `import { BirdRepository, TicketRepository } from '@workhero/repositories'`

| Path | Purpose |
|------|---------|
| `birds/index.ts` | `BirdRepository` — create, findById, findByName, updateStatus |
| `tickets/index.ts` | `TicketRepository` — create, claimNextQueued, complete, fail. Constructor takes `(db, { leaseTimeoutMs, maxRetries })` |
| `index.ts` | Re-exports |

### @workhero/queue

Job processing and worker loop. Import: `import { processBirdJob, runWorkerLoop } from '@workhero/queue'`

| File | Purpose |
|------|---------|
| `processor.ts` | `processBirdJob(birdId, birdRepo, wikipediaApiUrl)` — fetches Wikipedia summary |
| `runner.ts` | `runWorkerLoop(workerId, deps, signal, options)` — poll, claim, process |
| `index.ts` | Re-exports |

---

## src/

### service/birds/

| File | Purpose |
|------|---------|
| `service.ts` | `BirdService` — createBird (command), getBirdByName (query) |
| `controller.ts` | `BirdController` — HTTP handlers for POST/GET /bird |
| `dto.ts` | Zod schemas + inferred types |

### api/

| File | Purpose |
|------|---------|
| `index.ts` | Main API router — json, trace middleware, mounts /health, /bird, /admin |
| `trace.ts` | `traceMiddleware`, `logTrace()` — request correlation IDs |
| `swagger.ts` | OpenAPI spec from Zod schemas |
| `routers/bird.ts` | Bird routes — wires DbConnection, BirdRepository, TicketRepository, BirdService, BirdController |
| `routers/admin.ts` | Admin routes — GET /admin/queue, GET /admin/tickets |

### Root

| File | Purpose |
|------|---------|
| `config.ts` | Env-based config (port, lmdbPath, workerConcurrency, etc.) |
| `index.ts` | Express app, Swagger UI, api router, graceful shutdown |
| `worker.ts` | Spawns workers, graceful shutdown on SIGTERM |

### scripts/

| File | Purpose |
|------|---------|
| `clear-db.ts` | Deletes LMDB data dir (`pnpm run db:clear`) |

---

## Tests

| Path | What it covers |
|------|----------------|
| `__tests__/unit/bird-repository.test.ts` | BirdRepository CRUD |
| `__tests__/unit/ticket-repository.test.ts` | TicketRepository claim, complete, fail, reclaim |
| `__tests__/unit/bird-service.test.ts` | BirdService create, query, idempotency |
| `__tests__/concurrency.test.ts` | No double-claiming (50 tickets, 20 workers) |
| `__tests__/integration.test.ts` | Full flow: create → process → query (mocked fetch) |
| `__tests__/resilience.test.ts` | LMDB durability across close/reopen |
