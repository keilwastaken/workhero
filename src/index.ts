import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { apiRouter } from './api/index.js';
import { swaggerDocument } from './api/swagger.js';
import { config } from './config.js';

const app = express();

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(apiRouter);

const server = app.listen(config.port, () => {
  console.log(`API server running at http://localhost:${config.port}`);
  console.log(`Swagger docs at http://localhost:${config.port}/docs`);
});

let shuttingDown = false;

function shutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
