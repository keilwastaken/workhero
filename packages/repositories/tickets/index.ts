import type { Database } from 'lmdb';
import type { Ticket } from '@workhero/db';
import type { DbConnection } from '@workhero/db';

export class TicketRepository {
  private tickets: Database<Ticket, string>;
  private entityIndex: Database<string, string>;
  private queue: Database<boolean, string>;

  constructor(private readonly db: DbConnection) {
    this.tickets = db.table<Ticket>('tickets');
    this.entityIndex = db.table<string>('tickets-entity-index');
    this.queue = db.table<boolean>('tickets-queue');
  }

  /**
   * Create a new ticket
   * @param ticket - The ticket to create
   * @returns The created ticket
   */
  async create(ticket: Ticket): Promise<Ticket> {
    await this.db.root.transaction(() => {
      this.tickets.put(ticket.id, ticket);
      this.entityIndex.put(ticket.entityId, ticket.id);
      this.queue.put(ticket.id, true);
    });

    return ticket;
  }

  /**
   * Find all tickets
   * @returns All tickets
   */
  findAll(): Ticket[] {
    const results: Ticket[] = [];
    for (const { value } of this.tickets.getRange({})) {
      results.push(value);
    }
    return results;
  }

  /**
   * Find a ticket by ID
   * @param id - The ID of the ticket to find
   * @returns The ticket if found, otherwise undefined
   */
  findById(id: string): Ticket | undefined {
    return this.tickets.get(id);
  }
  /**
   * Find a ticket by entity ID
   * @param entityId - The entity ID of the ticket to find (ex. bird ID)
   * @returns The ticket if found, otherwise undefined
   */
  findByEntityId(entityId: string): Ticket | undefined {
    const ticketId = this.entityIndex.get(entityId);
    if (!ticketId) return undefined;
    return this.tickets.get(ticketId);
  }

  /**
   * Claim the next queued ticket for a worker
   * @param workerId - The ID of the worker claiming the ticket
   * @returns The claimed ticket if found, otherwise null
   */
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

  /**
   * Complete a ticket with a result
   * @param id - The ID of the ticket to complete
   * @param result - The result of the ticket
   * @returns The completed ticket if found, otherwise undefined
   */
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

  /**
   * Fail a ticket
   * @param id - The ID of the ticket to fail
   * @returns The failed ticket if found, otherwise undefined
   */
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
