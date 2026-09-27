import { createServer } from 'node:http';
import { app } from './app.js';
import { createLifecycle } from './bootstrap.js';
import { logger } from './common/logging/logger.js';
import { createDatabase, mongoose } from './config/database.js';
import { env } from './config/env.js';

const server = createServer(app);
const database = createDatabase(mongoose, env, logger);
const lifecycle = createLifecycle({
  database,
  log: logger,
  listen: () =>
    new Promise<void>((resolve, reject) => {
      function onError() {
        reject(new Error('HTTP startup failed'));
      }
      server.once('error', onError);
      server.listen(env.PORT, () => {
        server.off('error', onError);
        logger.info(
          { port: env.PORT, environment: env.APP_ENV },
          'API listening',
        );
        resolve();
      });
    }),
  closeHTTP: () =>
    new Promise<void>((resolve, reject) => {
      if (!server.listening) {
        resolve();
        return;
      }
      server.close((error) =>
        error ? reject(new Error('HTTP shutdown failed')) : resolve(),
      );
    }),
  exit: (code) => {
    process.exitCode = code;
  },
  forceExit: (code) => {
    process.exit(code);
  },
});

server.on('error', () => {
  logger.fatal('API server error');
  void lifecycle.stop(true);
});
process.on('SIGINT', () => {
  void lifecycle.stop();
});
process.on('SIGTERM', () => {
  void lifecycle.stop();
});
await lifecycle.start();
