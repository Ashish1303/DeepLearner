import { defineConfig } from '@playwright/test';
import foundation from './playwright.f044.config';

// PREPARED ONLY: mocked-network U selection. Does not qualify browser ownership.
export default defineConfig(foundation, {
  testMatch: 'admin-learning-path-proposals.spec.ts',
});
