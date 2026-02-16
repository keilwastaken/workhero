import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { DbConnection } from '@workhero/db';
import { BirdRepository, TicketRepository } from '@workhero/repositories';
import { BirdController } from '../../service/birds/controller.js';
import { BirdService } from '../../service/birds/service.js';
import { config } from '../../config.js';

const db = new DbConnection(config.lmdbPath);
const birdRepo = new BirdRepository(db);
const ticketRepo = new TicketRepository(db, {
  leaseTimeoutMs: config.leaseTimeoutMs,
  maxRetries: config.maxRetries,
});
const birdService = new BirdService(birdRepo, ticketRepo);
const birdController = new BirdController(birdService);

const birdRouter: RouterType = Router();

birdRouter.post('/', birdController.createBird);
birdRouter.get('/', birdController.getBirdByName);

export { birdRouter };
