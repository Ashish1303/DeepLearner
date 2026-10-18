import { defineConfig } from '@playwright/test';
import foundation from './playwright.config';

// Execution requires the separate F024 browser gate; this does not change the smoke suite.
export default defineConfig(foundation, {
  testMatch: [
    'concept-revise.spec.ts',
    'visualization-controls.spec.ts',
    'visualization-lesson.spec.ts',
    'practice-output.spec.ts',
    'practice-descriptive.spec.ts',
    'practice-scenario.spec.ts',
    'practice-coding.spec.ts',
    'practice-answer-unlock.spec.ts',
  ],
  globalTimeout: 600_000,
  timeout: 45_000,
  maxFailures: 1,
  use: {
    ...foundation.use,
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'npm run build --workspace=@deeplearner/web && npm run start --workspace=@deeplearner/web -- --hostname 127.0.0.1',
    url: 'http://127.0.0.1:3000/login',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:4000/api/v1',
      DEEPLEARNER_BROWSER_FIXTURE:
        process.env.DEEPLEARNER_BROWSER_FIXTURE === '1' ? '1' : '',
    },
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
