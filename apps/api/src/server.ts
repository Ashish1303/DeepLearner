import { app } from './app.js';
import { logger } from './common/logging/logger.js';
import { env } from './config/env.js';

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, environment: env.APP_ENV }, 'API listening');
});

server.on('error', () => {
  logger.fatal('API server failed to start');
  process.exitCode = 1;
});

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down API');
  const deadline = setTimeout(() => {
    logger.error('Shutdown timed out');
    process.exit(1);
  }, 10_000);
  deadline.unref();
  server.close((error) => {
    clearTimeout(deadline);
    process.exitCode = error ? 1 : 0;
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
