import { DbConnection } from '@workhero/db';
import { BirdRepository, TicketRepository } from '@workhero/repositories';
import { runWorkerLoop } from '@workhero/queue';
import { config } from './config.js';
import { logTrace } from './api/trace.js';

const db = new DbConnection(config.lmdbPath);
const birdRepo = new BirdRepository(db);
const ticketRepo = new TicketRepository(db, {
  leaseTimeoutMs: config.leaseTimeoutMs,
  maxRetries: config.maxRetries,
});
const deps = { ticketRepo, birdRepo };

const shutdownController = new AbortController();

console.log(`Starting ${config.workerConcurrency} worker(s)...`);

const workerPromises = Array.from({ length: config.workerConcurrency }, (_, i) =>
  runWorkerLoop(`w-${i}`, deps, shutdownController.signal, {
    pollIntervalMs: config.pollIntervalMs,
    wikipediaApiUrl: config.wikipediaApiUrl,
    maxRetries: config.maxRetries,
    traceFn: logTrace,
  }),
);

let shuttingDown = false;

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log('Shutting down workers gracefully...');
  shutdownController.abort();
  await Promise.all(workerPromises);
  await db.close();
  console.log('Workers stopped');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
