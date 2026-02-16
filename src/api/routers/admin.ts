import { Router } from 'express';
import type { Router as RouterType, Request, Response } from 'express';
import { DbConnection } from '@workhero/db';
import { TicketRepository } from '@workhero/repositories';
import { config } from '../../config.js';

const db = new DbConnection(config.lmdbPath);
const ticketRepo = new TicketRepository(db, {
  leaseTimeoutMs: config.leaseTimeoutMs,
  maxRetries: config.maxRetries,
});

const adminRouter: RouterType = Router();

/**
 * GET /admin/queue — queue stats by status
 */
adminRouter.get('/queue', (_req: Request, res: Response) => {
  const tickets = ticketRepo.findAll();
  const stats = { queued: 0, processing: 0, completed: 0, failed: 0, total: tickets.length };

  for (const t of tickets) {
    stats[t.status]++;
  }

  res.json(stats);
});

/**
 * GET /admin/tickets — list all tickets with worker info
 */
adminRouter.get('/tickets', (_req: Request, res: Response) => {
  const tickets = ticketRepo.findAll();

  const result = tickets.map((t) => ({
    id: t.id,
    entityId: t.entityId,
    status: t.status,
    retryCount: t.retryCount,
    workerId: t.workerId ?? null,
    claimedAt: t.claimedAt ?? null,
    completedAt: t.completedAt ?? null,
  }));

  res.json(result);
});

export { adminRouter };
