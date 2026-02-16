import { uuidv7 } from 'uuidv7';
import type { Bird, BirdSummary, BirdTicket } from '@workhero/db';
import type {
  CreateBirdCommand,
  CreateBirdResult,
  GetBirdByNameQuery,
  GetBirdResult,
} from './dto.js';
import type { BirdRepository, TicketRepository } from '@workhero/repositories';

export class BirdService {
  constructor(
    private readonly birdRepo: BirdRepository,
    private readonly ticketRepo: TicketRepository,
  ) {}

  // Command (idempotent: returns existing job if name already submitted)
  async createBird(command: CreateBirdCommand, traceId?: string): Promise<CreateBirdResult> {
    const existing = this.birdRepo.findByName(command.name);
    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        status: existing.status,
        createdAt: existing.createdAt,
        ...(traceId && { traceId }),
      };
    }

    const now = new Date().toISOString();
    const birdId = uuidv7();
    const ticketId = uuidv7();

    const bird: Bird = {
      id: birdId,
      name: command.name,
      status: 'queued',
      createdAt: now,
    };

    const ticket: BirdTicket = {
      id: ticketId,
      entityId: birdId,
      status: 'queued',
      retryCount: 0,
      ...(traceId && { traceId }),
    };

    await this.birdRepo.create(bird);
    await this.ticketRepo.create(ticket);

    return {
      id: bird.id,
      name: bird.name,
      status: bird.status,
      createdAt: bird.createdAt,
      ...(traceId && { traceId }),
    };
  }

  // Query
  getBirdByName(query: GetBirdByNameQuery): GetBirdResult | null {
    const bird = this.birdRepo.findByName(query.name);
    if (!bird) return null;

    const ticket = this.ticketRepo.findByEntityId(bird.id);
    if (!ticket || ticket.status !== 'completed') return null;

    const result: GetBirdResult = {
      id: bird.id,
      name: bird.name,
      status: ticket.status,
      createdAt: bird.createdAt,
    };
    if (ticket.result !== undefined) {
      result.result = ticket.result as BirdSummary;
    }
    return result;
  }
}
