export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  lmdbPath: process.env.LMDB_PATH ?? './data',
  wikipediaApiUrl: process.env.WIKIPEDIA_API_URL ?? 'https://en.wikipedia.org/w/api.php',
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY ?? '1', 10),
  maxRetries: parseInt(process.env.MAX_RETRIES ?? '3', 10),
  leaseTimeoutMs: parseInt(process.env.LEASE_TIMEOUT_MS ?? '30000', 10),
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '500', 10),
} as const;
