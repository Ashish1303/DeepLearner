import { expect, test as foundation } from '@playwright/test';
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
    async ({ playwright }, use) => {
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
    async ({ browser }, use) => {
      readLease();
      expect(browser.isConnected()).toBe(true);
      await use();
    },
    { auto: true },
  ],
});
