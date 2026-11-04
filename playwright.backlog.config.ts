import { defineConfig } from '@playwright/test';
import foundation from './playwright.config';
import { join } from 'node:path';

// Only scripts/Test-BrowserBacklog.ps1 supplies the live owned-browser lease.
// Discovery is inert; no webServer or Playwright-managed process-tree teardown.
export default defineConfig(foundation, {
  testMatch: '**/*.spec.ts',
  outputDir: process.env.QA_BROWSER_OUTPUT
    ? join(process.env.QA_BROWSER_OUTPUT, 'artifacts')
    : '.cache/browser-backlog/discovery-artifacts',
  globalTimeout: 600_000,
  maxFailures: 0,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['./scripts/browser-backlog/reporter.ts']],
  use: {
    ...foundation.use,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'student',
      testIgnore: ['**/admin-*.spec.ts', '**/chrome-smoke.spec.ts'],
      use: { baseURL: 'http://127.0.0.1:3101' },
    },
    {
      name: 'admin',
      testMatch: '**/admin-*.spec.ts',
      use: { baseURL: 'http://127.0.0.1:5181' },
    },
    { name: 'qualification', testMatch: '**/chrome-smoke.spec.ts' },
  ],
});
