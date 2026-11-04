import { expect, test as foundation } from '@playwright/test';
import {
  executionDestination,
  assertCaseIdentity,
} from '../../scripts/browser-backlog/inventory.mjs';
import { readLease } from '../../scripts/browser-backlog/lease.mjs';

export {
  WEB_ORIGIN,
  ADMIN_ORIGIN,
  API_ORIGIN,
  markBrowserClose,
} from '../../scripts/browser-backlog/lease.mjs';
export type { BrowserContext, Page, Route, Request } from '@playwright/test';
export { expect };

export const test = foundation.extend<{ ownedLease: void }>({
  browser: [
    async ({ playwright }, use, workerInfo) => {
      executionDestination(process.env, workerInfo.project.name);
      // Native parent owns the browser. CDP close only disconnects this client:
      // no Playwright-launched browser, taskkill /T, or PID-tree fallback.
      const lease = readLease();
      const browser = await playwright.chromium.connectOverCDP(lease.endpoint);
      try {
        await use(browser);
      } finally {
        await browser.close();
      }
    },
    { scope: 'worker' },
  ],
  ownedLease: [
    async ({ browser }, use, testInfo) => {
      assertCaseIdentity({
        project: testInfo.project.name,
        file: testInfo.file.replaceAll('\\', '/').split('/').at(-1),
        titles: testInfo.titlePath.slice(1),
      });
      readLease();
      expect(browser.isConnected()).toBe(true);
      await use();
    },
    { auto: true },
  ],
});
