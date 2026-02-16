import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DbConnection } from '@workhero/db';
import { BirdRepository } from '@workhero/repositories';

let db: DbConnection;
let birdRepo: BirdRepository;
let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'workhero-test-'));
  db = new DbConnection(tmpDir);
  birdRepo = new BirdRepository(db);
});

afterEach(async () => {
  await db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('BirdRepository', () => {
  it('creates and finds a bird by id', async () => {
    const bird = { id: 'b1', name: 'robin', status: 'queued' as const, createdAt: new Date().toISOString() };
    await birdRepo.create(bird);

    const found = birdRepo.findById('b1');
    expect(found).toEqual(bird);
  });

  it('finds a bird by name', async () => {
    const bird = { id: 'b2', name: 'eagle', status: 'queued' as const, createdAt: new Date().toISOString() };
    await birdRepo.create(bird);

    const found = birdRepo.findByName('eagle');
    expect(found?.id).toBe('b2');
  });

  it('returns undefined for unknown bird by id', () => {
    expect(birdRepo.findById('nonexistent')).toBeUndefined();
  });

  it('returns undefined for unknown bird by name', () => {
    expect(birdRepo.findByName('nonexistent')).toBeUndefined();
  });

  it('updates bird status', async () => {
    const bird = { id: 'b3', name: 'hawk', status: 'queued' as const, createdAt: new Date().toISOString() };
    await birdRepo.create(bird);

    const updated = await birdRepo.updateStatus('b3', 'completed');
    expect(updated?.status).toBe('completed');
    expect(birdRepo.findById('b3')?.status).toBe('completed');
  });

  it('updateStatus returns undefined for nonexistent id', async () => {
    const result = await birdRepo.updateStatus('nonexistent', 'completed');
    expect(result).toBeUndefined();
  });
});
