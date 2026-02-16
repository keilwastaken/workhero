import type { TicketRepository, BirdRepository } from '@workhero/repositories';
import type { Ticket } from '@workhero/db';
import { processBirdJob } from './processor.js';

export interface WorkerDeps {
  ticketRepo: TicketRepository;
  birdRepo: BirdRepository;
}

export interface WorkerOptions {
  pollIntervalMs: number;
  wikipediaApiUrl: string;
  maxRetries: number;
  traceFn?: (traceId: string, step: string, data?: Record<string, unknown>) => void;
}

function trace(
  ticket: Ticket,
  step: string,
  traceFn: WorkerOptions['traceFn'],
  data?: Record<string, unknown>,
): void {
  if (ticket.traceId && traceFn) {
    traceFn(ticket.traceId, step, { workerId: ticket.workerId, entityId: ticket.entityId, ...data });
  }
}

/**
 * Run a single worker loop that continuously polls for queued tickets,
 * claims them atomically, processes the job, and updates the result.
 * Stops when signal is aborted (e.g. SIGTERM), after finishing any in-flight job.
 */
export async function runWorkerLoop(
  workerId: string,
  deps: WorkerDeps,
  signal: AbortSignal,
  options: WorkerOptions,
): Promise<void> {
  const { ticketRepo, birdRepo } = deps;
  const { pollIntervalMs, wikipediaApiUrl, maxRetries, traceFn } = options;

  console.log(`[worker:${workerId}] started`);

  while (!signal.aborted) {
    const ticket = ticketRepo.claimNextQueued(workerId);

    if (!ticket) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      continue;
    }

    console.log(
      `[worker:${workerId}] claimed ticket ${ticket.id} (attempt ${ticket.retryCount + 1})`,
    );
    trace(ticket, 'worker_claimed', traceFn, { ticketId: ticket.id, attempt: ticket.retryCount + 1 });
    trace(ticket, 'worker_processing', traceFn, { ticketId: ticket.id });

    let result: Awaited<ReturnType<typeof processBirdJob>> | null = null;
    let lastError: unknown;
    const attempts = maxRetries;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        result = await processBirdJob(ticket.entityId, birdRepo, wikipediaApiUrl);
        break;
      } catch (err) {
        lastError = err;
        if (attempt < attempts) {
          const delayMs = 1000 * attempt;
          console.log(`[worker:${workerId}] ticket ${ticket.id} attempt ${attempt}/${attempts} failed, retrying in ${delayMs}ms`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    if (result !== null) {
      await ticketRepo.complete(ticket.id, result);
      await birdRepo.updateStatus(ticket.entityId, 'completed');
      console.log(`[worker:${workerId}] completed ticket ${ticket.id}`);
      trace(ticket, 'worker_completed', traceFn, { ticketId: ticket.id });
    } else {
      const errMsg = lastError instanceof Error ? lastError.message : String(lastError ?? 'Unknown error');
      console.error(`[worker:${workerId}] failed ticket ${ticket.id} after ${attempts} attempts:`, lastError);
      trace(ticket, 'worker_failed', traceFn, { ticketId: ticket.id, error: errMsg });
      await ticketRepo.fail(ticket.id);
      await birdRepo.updateStatus(ticket.entityId, 'failed');
    }

    if (signal.aborted) break;
  }

  console.log(`[worker:${workerId}] stopped`);
}
