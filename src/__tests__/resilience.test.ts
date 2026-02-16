import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DbConnection } from '@workhero/db';
import { BirdRepository, TicketRepository } from '@workhero/repositories';

let tmpDir: string;

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Resilience: LMDB durability', () => {
  it('queued tickets survive DB close and reopen', async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'workhero-test-'));

    // --- Session 1: write data ---
    const db1 = new DbConnection(tmpDir);
    const birdRepo1 = new BirdRepository(db1);
    const ticketRepo1 = new TicketRepository(db1, { leaseTimeoutMs: 30_000, maxRetries: 3 });

    await birdRepo1.create({
      id: 'b1',
      name: 'pelican',
      status: 'queued',
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    await ticketRepo1.create({
      id: 't1',
      entityId: 'b1',
      status: 'queued',
      retryCount: 0,
    });

    await db1.close();

    // --- Session 2: reopen and verify ---
    const db2 = new DbConnection(tmpDir);
    const birdRepo2 = new BirdRepository(db2);
    const ticketRepo2 = new TicketRepository(db2, { leaseTimeoutMs: 30_000, maxRetries: 3 });

    const bird = birdRepo2.findById('b1');
    expect(bird).toBeDefined();
    expect(bird!.name).toBe('pelican');
    expect(bird!.status).toBe('queued');
    expect(bird!.createdAt).toBe('2025-01-01T00:00:00.000Z');

    const ticket = ticketRepo2.findByEntityId('b1');
    expect(ticket).toBeDefined();
    expect(ticket!.id).toBe('t1');
    expect(ticket!.status).toBe('queued');
    expect(ticket!.retryCount).toBe(0);

    // Ticket should still be claimable
    const claimed = ticketRepo2.claimNextQueued('recovery-worker');
    expect(claimed).not.toBeNull();
    expect(claimed!.id).toBe('t1');

    await db2.close();
  });

  it('processing tickets survive DB close and reopen', async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'workhero-test-'));

    // --- Session 1: write and claim ---
    const db1 = new DbConnection(tmpDir);
    const birdRepo1 = new BirdRepository(db1);
    const ticketRepo1 = new TicketRepository(db1, { leaseTimeoutMs: 30_000, maxRetries: 3 });

    await birdRepo1.create({
      id: 'b1',
      name: 'eagle',
      status: 'queued',
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    await ticketRepo1.create({
      id: 't1',
      entityId: 'b1',
      status: 'queued',
      retryCount: 0,
    });

    const claimed = ticketRepo1.claimNextQueued('w-0');
    expect(claimed?.status).toBe('processing');

    await db1.close();

    // --- Session 2: reopen and verify ---
    const db2 = new DbConnection(tmpDir);
    const ticketRepo2 = new TicketRepository(db2, { leaseTimeoutMs: 30_000, maxRetries: 3 });

    const ticket = ticketRepo2.findById('t1');
    expect(ticket).toBeDefined();
    expect(ticket!.status).toBe('processing');
    expect(ticket!.workerId).toBe('w-0');
    expect(ticket!.claimedAt).toBeDefined();

    await db2.close();
  });
});
