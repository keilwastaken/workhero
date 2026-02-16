import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DbConnection } from '@workhero/db';
import { BirdRepository, TicketRepository } from '@workhero/repositories';
import { processBirdJob } from '@workhero/queue';
import { BirdService } from '../service/birds/service.js';

let db: DbConnection;
let birdRepo: BirdRepository;
let ticketRepo: TicketRepository;
let service: BirdService;
let tmpDir: string;

const MOCK_EXTRACT = 'The brown pelican (Pelecanus occidentalis) is a bird of the pelican family, Pelecanidae.';

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'workhero-test-'));
  db = new DbConnection(tmpDir);
  birdRepo = new BirdRepository(db);
  ticketRepo = new TicketRepository(db, { leaseTimeoutMs: 30_000, maxRetries: 3 });
  service = new BirdService(birdRepo, ticketRepo);

  // Mock global fetch to return a canned Wikipedia response
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      query: {
        pages: [{
          title: 'Brown pelican',
          extract: MOCK_EXTRACT,
        }],
      },
    }),
  }));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Integration: full flow', () => {
  it('submit bird, process job, query completed result', async () => {
    // 1. Create bird via service (simulates POST /bird)
    const created = await service.createBird({ name: 'brown pelican' });
    expect(created.status).toBe('queued');
    expect(created.name).toBe('brown pelican');

    // 2. Verify GET returns null before processing
    const beforeProcessing = service.getBirdByName({ name: 'brown pelican' });
    expect(beforeProcessing).toBeNull();

    // 3. Claim ticket (simulates worker picking up job)
    const ticket = ticketRepo.claimNextQueued('test-worker');
    expect(ticket).not.toBeNull();
    expect(ticket!.status).toBe('processing');

    // 4. Process the job (calls mocked Wikipedia API)
    const result = await processBirdJob(ticket!.entityId, birdRepo, 'https://en.wikipedia.org/w/api.php');
    expect(result.title).toBe('Brown pelican');
    expect(result.extract).toBe(MOCK_EXTRACT);

    // 5. Complete the ticket and update bird status (simulates worker finishing)
    await ticketRepo.complete(ticket!.id, result);
    await birdRepo.updateStatus(ticket!.entityId, 'completed');

    // 6. Query via service (simulates GET /bird?name=brown%20pelican)
    const queryResult = service.getBirdByName({ name: 'brown pelican' });
    expect(queryResult).not.toBeNull();
    expect(queryResult!.status).toBe('completed');
    expect(queryResult!.name).toBe('brown pelican');
    expect(queryResult!.result?.title).toBe('Brown pelican');
    expect(queryResult!.result?.extract).toBe(MOCK_EXTRACT);
    expect(queryResult!.result?.fetchedAt).toBeDefined();
  });

  it('worker failure marks ticket and bird as failed', async () => {
    // Stub fetch to reject
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network error'));

    const created = await service.createBird({ name: 'mystery bird' });
    const ticket = ticketRepo.claimNextQueued('test-worker');
    expect(ticket).not.toBeNull();

    // Process should throw
    await expect(processBirdJob(ticket!.entityId, birdRepo, 'https://en.wikipedia.org/w/api.php')).rejects.toThrow();

    // Simulate worker error handling
    await ticketRepo.fail(ticket!.id);
    await birdRepo.updateStatus(ticket!.entityId, 'failed');

    const failedTicket = ticketRepo.findById(ticket!.id);
    expect(failedTicket?.status).toBe('failed');

    const failedBird = birdRepo.findById(created.id);
    expect(failedBird?.status).toBe('failed');
  });
});
