import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

declare global {
  namespace Express {
    interface Request {
      traceId?: string;
    }
  }
}

/**
 * Middleware: attach trace ID to each request for end-to-end correlation.
 * Uses X-Trace-ID header if provided, otherwise generates one.
 */
export function traceMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.traceId = (req.headers['x-trace-id'] as string) || randomUUID().slice(0, 8);
  next();
}

export function logTrace(traceId: string, step: string, data?: Record<string, unknown>): void {
  const extra = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`[trace:${traceId}] ${step}${extra}`);
}
