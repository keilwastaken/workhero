import type { Request, Response } from 'express';
import type { BirdService } from './service.js';
import { CreateBirdCommandSchema, GetBirdByNameQuerySchema } from './dto.js';
import { logTrace } from '../../api/trace.js';

export class BirdController {
  constructor(private readonly birdService: BirdService) {}

  createBird = async (req: Request, res: Response): Promise<void> => {
    const traceId = req.traceId;
    const parsed = CreateBirdCommandSchema.safeParse(req.body);
    if (!parsed.success) {
      if (traceId) logTrace(traceId, 'validation_failed', { error: parsed.error.issues[0]?.message });
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' });
      return;
    }

    if (traceId) logTrace(traceId, 'request', { method: 'POST', path: '/bird', name: parsed.data.name });

    const result = await this.birdService.createBird(parsed.data, traceId);

    if (traceId) logTrace(traceId, 'created', { birdId: result.id, name: result.name, status: result.status });

    res.status(201).json(result);
  };

  getBirdByName = (req: Request, res: Response): void => {
    const traceId = req.traceId;
    const parsed = GetBirdByNameQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      if (traceId) logTrace(traceId, 'validation_failed', { error: 'name required' });
      res.status(400).json({ error: 'query parameter "name" is required' });
      return;
    }

    if (traceId) logTrace(traceId, 'request', { method: 'GET', path: '/bird', name: parsed.data.name });

    const result = this.birdService.getBirdByName(parsed.data);
    if (!result) {
      if (traceId) logTrace(traceId, 'not_found', { name: parsed.data.name });
      res.status(404).json({ error: 'not found or not yet completed' });
      return;
    }

    if (traceId) logTrace(traceId, 'result', { birdId: result.id, status: result.status });
    res.status(200).json(result);
  };
}
