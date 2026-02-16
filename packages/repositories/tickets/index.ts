import type { Database } from 'lmdb';
import type { Ticket } from '@workhero/db';
import type { DbConnection } from '@workhero/db';

export interface TicketRepositoryOptions {
  leaseTimeoutMs: number;
  maxRetries: number;
}

export class TicketRepository {
  private tickets: Database<Ticket, string>;
  private entityIndex: Database<string, string>;
  private queue: Database<boolean, string>;
  private options: TicketRepositoryOptions;

  constructor(
    private readonly db: DbConnection,
    options: TicketRepositoryOptions,
  ) {
    this.tickets = db.table<Ticket>('tickets');
    this.entityIndex = db.table<string>('tickets-entity-index');
    this.queue = db.table<boolean>('tickets-queue');
    this.options = options;
  }

  async create(ticket: Ticket): Promise<Ticket> {
    await this.db.root.transaction(() => {
      this.tickets.put(ticket.id, ticket);
      this.entityIndex.put(ticket.entityId, ticket.id);
      this.queue.put(ticket.id, true);
    });

    return ticket;
  }

  findAll(): Ticket[] {
    const results: Ticket[] = [];
    for (const { value } of this.tickets.getRange({})) {
      results.push(value);
    }
    return results;
  }

  findById(id: string): Ticket | undefined {
    return this.tickets.get(id);
  }

  findByEntityId(entityId: string): Ticket | undefined {
    const ticketId = this.entityIndex.get(entityId);
    if (!ticketId) return undefined;
    return this.tickets.get(ticketId);
  }

  claimNextQueued(workerId: string): Ticket | null {
    let claimed: Ticket | null = null;

    this.db.root.transactionSync(() => {
      for (const { key } of this.queue.getRange({})) {
        const ticket = this.tickets.get(key);
        if (ticket && ticket.status === 'queued') {
          const updated: Ticket = {
            ...ticket,
            status: 'processing',
            workerId,
            claimedAt: new Date().toISOString(),
          };
          this.tickets.putSync(key, updated);
          this.queue.removeSync(key);
          claimed = updated;
          return;
        }
        this.queue.removeSync(key);
      }
    });

    return claimed;
  }

  reclaimStaleTickets(): number {
    const now = Date.now();
    const { leaseTimeoutMs, maxRetries } = this.options;
    let reclaimed = 0;

    this.db.root.transactionSync(() => {
      for (const { key, value: ticket } of this.tickets.getRange({})) {
        if (ticket.status !== 'processing' || !ticket.claimedAt) continue;

        const claimedTime = new Date(ticket.claimedAt).getTime();
        if (now - claimedTime < leaseTimeoutMs) continue;

        if (ticket.retryCount >= maxRetries) {
          const failed: Ticket = {
            ...ticket,
            status: 'failed',
            completedAt: new Date().toISOString(),
          };
          this.tickets.putSync(key, failed);
        } else {
          const { workerId: _, claimedAt: __, ...rest } = ticket;
          const requeued: Ticket = {
            ...rest,
            status: 'queued',
            retryCount: ticket.retryCount + 1,
          };
          this.tickets.putSync(key, requeued);
          this.queue.putSync(ticket.id, true);
          reclaimed++;
        }
      }
    });

    return reclaimed;
  }

  async complete(id: string, result: unknown): Promise<Ticket | undefined> {
    const existing = this.tickets.get(id);
    if (!existing) return undefined;

    const updated: Ticket = {
      ...existing,
      status: 'completed' as const,
      result,
      completedAt: new Date().toISOString(),
    };
    await this.tickets.put(id, updated);
    return updated;
  }

  async fail(id: string): Promise<Ticket | undefined> {
    const existing = this.tickets.get(id);
    if (!existing) return undefined;

    const updated: Ticket = {
      ...existing,
      status: 'failed',
      completedAt: new Date().toISOString(),
    };
    await this.tickets.put(id, updated);
    return updated;
  }
}
