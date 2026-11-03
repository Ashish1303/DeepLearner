import { defineConfig } from '@playwright/test';
import foundation from './playwright.config';

// PREPARED ONLY. Selection/discovery grants no browser or primary-host permission.
// Synthetic network mocks, not live frontend/API/MongoDB integration.
export default defineConfig(foundation, {
  testMatch: 'admin-learning-paths.spec.ts',
  workers: 1,
  retries: 0,
  maxFailures: 1,
  globalTimeout: 600_000,
  use: {
    ...foundation.use,
    baseURL: 'http://127.0.0.1:5173',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  // No webServer: an explicitly approved owned development app is a prerequisite.
});
