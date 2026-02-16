import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DbConnection } from '@workhero/db';
import { TicketRepository } from '@workhero/repositories';

let db: DbConnection;
let ticketRepo: TicketRepository;
let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'workhero-test-'));
  db = new DbConnection(tmpDir);
  ticketRepo = new TicketRepository(db, { leaseTimeoutMs: 30_000, maxRetries: 3 });
});

afterEach(async () => {
  await db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('TicketRepository', () => {
  it('creates and finds a ticket by entity id', async () => {
    const ticket = { id: 't1', entityId: 'b1', status: 'queued' as const, retryCount: 0 };
    await ticketRepo.create(ticket);

    const found = ticketRepo.findByEntityId('b1');
    expect(found?.id).toBe('t1');
  });

  it('findById returns undefined for unknown ticket', () => {
    expect(ticketRepo.findById('nonexistent')).toBeUndefined();
  });

  it('findByEntityId returns undefined for unknown entity', () => {
    expect(ticketRepo.findByEntityId('nonexistent')).toBeUndefined();
  });

  it('claims next queued ticket atomically', async () => {
    await ticketRepo.create({ id: 't1', entityId: 'b1', status: 'queued', retryCount: 0 });
    await ticketRepo.create({ id: 't2', entityId: 'b2', status: 'queued', retryCount: 0 });

    const first = ticketRepo.claimNextQueued('w-0');
    const second = ticketRepo.claimNextQueued('w-1');
    const third = ticketRepo.claimNextQueued('w-2');

    expect(first?.id).toBe('t1');
    expect(first?.status).toBe('processing');
    expect(first?.workerId).toBe('w-0');
    expect(first?.claimedAt).toBeDefined();
    expect(second?.id).toBe('t2');
    expect(third).toBeNull();
  });

  it('completes a ticket with result', async () => {
    await ticketRepo.create({ id: 't1', entityId: 'b1', status: 'queued', retryCount: 0 });
    ticketRepo.claimNextQueued('w-0');

    const result = { title: 'Robin', extract: 'A bird', fetchedAt: new Date().toISOString() };
    const completed = await ticketRepo.complete('t1', result);

    expect(completed?.status).toBe('completed');
    expect(completed?.result).toEqual(result);
    expect(completed?.completedAt).toBeDefined();
  });

  it('complete returns undefined for nonexistent ticket', async () => {
    const result = await ticketRepo.complete('nonexistent', {});
    expect(result).toBeUndefined();
  });

  it('fails a ticket', async () => {
    await ticketRepo.create({ id: 't1', entityId: 'b1', status: 'queued', retryCount: 0 });
    ticketRepo.claimNextQueued('w-0');

    const failed = await ticketRepo.fail('t1');
    expect(failed?.status).toBe('failed');
    expect(failed?.completedAt).toBeDefined();
  });

  it('reclaims stale tickets by re-queuing', async () => {
    await ticketRepo.create({ id: 't1', entityId: 'b1', status: 'queued', retryCount: 0 });
    const claimed = ticketRepo.claimNextQueued('w-0');
    expect(claimed?.status).toBe('processing');

    // Backdate claimedAt to simulate lease timeout
    const ticket = ticketRepo.findById('t1')!;
    const stale = { ...ticket, claimedAt: new Date(Date.now() - 60_000).toISOString() };
    const ticketsDb = db.table('tickets');
    await ticketsDb.put('t1', stale);

    const reclaimed = ticketRepo.reclaimStaleTickets();
    expect(reclaimed).toBe(1);

    const requeued = ticketRepo.findById('t1');
    expect(requeued?.status).toBe('queued');
    expect(requeued?.retryCount).toBe(1);
  });

  it('reclaimStaleTickets marks as failed when retries exhausted', async () => {
    await ticketRepo.create({ id: 't1', entityId: 'b1', status: 'queued', retryCount: 3 });
    ticketRepo.claimNextQueued('w-0');

    // Backdate claimedAt to simulate lease timeout
    const ticket = ticketRepo.findById('t1')!;
    const stale = { ...ticket, claimedAt: new Date(Date.now() - 60_000).toISOString() };
    const ticketsDb = db.table('tickets');
    await ticketsDb.put('t1', stale);

    const reclaimed = ticketRepo.reclaimStaleTickets();
    expect(reclaimed).toBe(0); // not reclaimed, permanently failed

    const failed = ticketRepo.findById('t1');
    expect(failed?.status).toBe('failed');
    expect(failed?.completedAt).toBeDefined();
  });
});
