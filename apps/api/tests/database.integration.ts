// Explicit, non-writing smoke only. Never included in the default test glob.
try {
  const { env } = await import('../src/config/env.js');
  if (env.APP_ENV === 'PRODUCTION')
    throw new Error('Non-production target required');
  const { createDatabase, mongoose } =
    await import('../src/config/database.js');
  const { logger } = await import('../src/common/logging/logger.js');
  const database = createDatabase(mongoose, env, logger);
  const deadline = setTimeout(() => {
    console.error('Database smoke timed out');
    process.exit(1);
  }, 45_000);
  try {
    await database.connect();
    if (!mongoose.connection.db) throw new Error('Database unavailable');
    await mongoose.connection.db.command({ ping: 1 });
    console.info('Database connect/ping smoke passed');
  } finally {
    try {
      await database.disconnect();
    } finally {
      clearTimeout(deadline);
    }
  }
} catch {
  console.error(
    'Database smoke failed: check non-production configuration, credentials and network access privately',
  );
  process.exitCode = 1;
}
