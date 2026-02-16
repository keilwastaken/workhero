import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DbConnection } from '@workhero/db';
import { BirdRepository, TicketRepository } from '@workhero/repositories';
import { BirdService } from '../../service/birds/service.js';

let db: DbConnection;
let birdRepo: BirdRepository;
let ticketRepo: TicketRepository;
let service: BirdService;
let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'workhero-test-'));
  db = new DbConnection(tmpDir);
  birdRepo = new BirdRepository(db);
  ticketRepo = new TicketRepository(db, { leaseTimeoutMs: 30_000, maxRetries: 3 });
  service = new BirdService(birdRepo, ticketRepo);
});

afterEach(async () => {
  await db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('BirdService', () => {
  it('creates a bird with queued status', async () => {
    const result = await service.createBird({ name: 'sparrow' });

    expect(result.name).toBe('sparrow');
    expect(result.status).toBe('queued');
    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeDefined();
  });

  it('is idempotent: returns existing bird on duplicate name', async () => {
    const first = await service.createBird({ name: 'sparrow' });
    const second = await service.createBird({ name: 'sparrow' });

    expect(first.id).toBe(second.id);
  });

  it('returns null for GET when job not completed', async () => {
    await service.createBird({ name: 'sparrow' });
    const result = service.getBirdByName({ name: 'sparrow' });
    expect(result).toBeNull();
  });

  it('returns result for GET when job completed', async () => {
    const created = await service.createBird({ name: 'sparrow' });

    const ticket = ticketRepo.findByEntityId(created.id)!;
    await ticketRepo.complete(ticket.id, {
      title: 'Sparrow',
      extract: 'A small bird',
      fetchedAt: new Date().toISOString(),
    });

    const result = service.getBirdByName({ name: 'sparrow' });
    expect(result).not.toBeNull();
    expect(result?.status).toBe('completed');
    expect(result?.result?.title).toBe('Sparrow');
  });

  it('returns null for unknown bird name', () => {
    const result = service.getBirdByName({ name: 'nonexistent' });
    expect(result).toBeNull();
  });
});
