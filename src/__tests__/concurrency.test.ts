import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DbConnection } from '@workhero/db';
import { TicketRepository } from '@workhero/repositories';

let db: DbConnection;
let ticketRepo: TicketRepository;
let tmpDir: string;

const TICKET_COUNT = 50;
const WORKER_COUNT = 20;

beforeEach(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'workhero-test-'));
  db = new DbConnection(tmpDir);
  ticketRepo = new TicketRepository(db);

  for (let i = 0; i < TICKET_COUNT; i++) {
    await ticketRepo.create({
      id: `t-${i}`,
      entityId: `b-${i}`,
      status: 'queued',
      retryCount: 0,
    });
  }
});

afterEach(async () => {
  await db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Concurrency', () => {
  it('no double-claiming across simultaneous workers', async () => {
    const allClaimed: string[] = [];

    /**
     * Each simulated worker claims tickets in a tight loop until
     * claimNextQueued returns null. The async function yields between
     * iterations so all 20 workers interleave on the event loop.
     */
    async function simulateWorker(workerId: string): Promise<string[]> {
      const claimed: string[] = [];
      while (true) {
        // Yield to let other workers interleave
        await new Promise((r) => setTimeout(r, 0));
        const ticket = ticketRepo.claimNextQueued(workerId);
        if (!ticket) break;
        claimed.push(ticket.id);
      }
      return claimed;
    }

    const workers = Array.from({ length: WORKER_COUNT }, (_, i) =>
      simulateWorker(`w-${i}`),
    );

    const results = await Promise.all(workers);

    for (const claimed of results) {
      allClaimed.push(...claimed);
    }

    // Every ticket claimed exactly once
    expect(allClaimed.length).toBe(TICKET_COUNT);

    // No duplicates
    const uniqueIds = new Set(allClaimed);
    expect(uniqueIds.size).toBe(TICKET_COUNT);

    // Every ticket ID accounted for
    for (let i = 0; i < TICKET_COUNT; i++) {
      expect(uniqueIds.has(`t-${i}`)).toBe(true);
    }

    // All tickets should be in 'processing' state
    for (let i = 0; i < TICKET_COUNT; i++) {
      const ticket = ticketRepo.findById(`t-${i}`);
      expect(ticket?.status).toBe('processing');
    }
  });
});
