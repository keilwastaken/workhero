import { OpenApiGeneratorV3, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import type { JsonObject } from 'swagger-ui-express';
import {
  CreateBirdCommandSchema,
  CreateBirdResultSchema,
  GetBirdByNameQuerySchema,
  GetBirdResultSchema,
  ErrorSchema,
} from '../service/birds/dto.js';

const registry = new OpenAPIRegistry();

// Register routes

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Ops'],
  summary: 'Health check',
  responses: {
    200: { description: 'Service is healthy' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/bird',
  tags: ['Bird'],
  summary: 'Create a bird research job',
  request: {
    body: {
      content: { 'application/json': { schema: CreateBirdCommandSchema } },
    },
  },
  responses: {
    201: {
      description: 'Job created (or existing job returned if name already submitted)',
      content: { 'application/json': { schema: CreateBirdResultSchema } },
    },
    400: {
      description: 'Missing or invalid name',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/bird',
  tags: ['Bird'],
  summary: 'Get completed bird research result',
  request: {
    query: GetBirdByNameQuerySchema,
  },
  responses: {
    200: {
      description: 'Completed bird result',
      content: { 'application/json': { schema: GetBirdResultSchema } },
    },
    400: {
      description: 'Missing name query parameter',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    404: {
      description: 'Not found or not yet completed',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

// Admin routes

registry.registerPath({
  method: 'get',
  path: '/admin/queue',
  tags: ['Admin'],
  summary: 'Queue stats by status',
  responses: {
    200: { description: 'Queue statistics' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/tickets',
  tags: ['Admin'],
  summary: 'List all tickets with worker info',
  responses: {
    200: { description: 'All tickets' },
  },
});

// Generate the spec

const generator = new OpenApiGeneratorV3(registry.definitions);

export const swaggerDocument = generator.generateDocument({
  openapi: '3.0.3',
  info: {
    title: 'WorkHero Bird Research API',
    version: '1.0.0',
    description:
      'Submit bird research jobs and retrieve Wikipedia summaries via a durable queue.',
  },
}) as unknown as JsonObject;
