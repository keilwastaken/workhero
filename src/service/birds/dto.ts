import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// --- Request schemas ---

export const CreateBirdCommandSchema = z
  .object({
    name: z.string().openapi({ example: 'brown pelican' }).min(1, { message: 'name is required' }),
  })
  .openapi('CreateBirdCommand');

export const GetBirdByNameQuerySchema = z
  .object({
    name: z.string().openapi({ example: 'brown pelican' }).min(1, { message: 'name is required' }),
  })
  .openapi('GetBirdByNameQuery');

// --- Response schemas ---

export const BirdSummarySchema = z
  .object({
    title: z.string().openapi({ example: 'Brown pelican' }),
    extract: z.string().openapi({
      example: 'The brown pelican (Pelecanus occidentalis) is a bird of the pelican family...',
    }),
    fetchedAt: z.string().openapi({ example: '2025-01-01T00:00:05.000Z', format: 'date-time' }),
  })
  .openapi('BirdSummary');

export const CreateBirdResultSchema = z
  .object({
    id: z.string().openapi({ example: '01961a2b-3c4d-7e8f-9012-abcdef123456' }),
    name: z.string().openapi({ example: 'brown pelican' }),
    status: z.enum(['queued', 'processing', 'completed', 'failed']).openapi({ example: 'queued' }),
    createdAt: z.string().openapi({ example: '2025-01-01T00:00:00.000Z', format: 'date-time' }),
    traceId: z.string().optional().openapi({ example: 'a1b2c3d4', description: 'Correlation ID for tracing; grep logs for this' }),
  })
  .openapi('CreateBirdResult');

export const GetBirdResultSchema = z
  .object({
    id: z.string().openapi({ example: '01961a2b-3c4d-7e8f-9012-abcdef123456' }),
    name: z.string().openapi({ example: 'brown pelican' }),
    status: z.string().openapi({ example: 'completed' }),
    createdAt: z.string().openapi({ example: '2025-01-01T00:00:00.000Z', format: 'date-time' }),
    result: BirdSummarySchema.optional(),
  })
  .openapi('GetBirdResult');

export const ErrorSchema = z
  .object({
    error: z.string().openapi({ example: 'not found or not yet completed' }),
  })
  .openapi('Error');

// --- Inferred types (used by service/controller) ---

export type CreateBirdCommand = z.infer<typeof CreateBirdCommandSchema>;
export type GetBirdByNameQuery = z.infer<typeof GetBirdByNameQuerySchema>;
export type CreateBirdResult = z.infer<typeof CreateBirdResultSchema>;
export type GetBirdResult = z.infer<typeof GetBirdResultSchema>;
