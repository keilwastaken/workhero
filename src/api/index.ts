import { Router, json } from 'express';
import type { Router as RouterType, Request, Response } from 'express';
import { birdRouter } from './routers/bird.js';
import { adminRouter } from './routers/admin.js';
import { traceMiddleware } from './trace.js';

const apiRouter: RouterType = Router();

apiRouter.use(json());
apiRouter.use(traceMiddleware);

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

apiRouter.use('/bird', birdRouter);
apiRouter.use('/admin', adminRouter);

export { apiRouter };
