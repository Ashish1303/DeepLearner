import process from 'node:process';
import { expect, test } from '@playwright/test';

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0); // Existence probe only; never terminate a process.
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
}

test('installed Chrome supports isolated browser automation and cleanup', async ({
  browser,
  context,
  page,
}) => {
  // CDP is scoped to this newly launched browser, never a personal Chrome session.
  const cdp = await browser.newBrowserCDPSession();
  const ownedPids = new Set<number>();
  const rememberProcesses = async () => {
    const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
    for (const entry of processInfo) ownedPids.add(entry.id);
  };
  try {
    await rememberProcesses();
    await context.route('**/*', (route) => route.abort());
    await test.step('navigation and harmless in-memory DOM', async () => {
      await page.goto('about:blank');
      await expect(page).toHaveURL('about:blank');
      await page.setContent(`
        <!doctype html><html lang="en"><head><title>Automation smoke</title></head>
        <body><main><h1>Chrome automation smoke</h1>
          <label for="entry">Sample text</label><input id="entry" type="text">
          <a href="#complete">Continue</a>
          <p id="complete">In-memory content only</p>
        </main></body></html>
      `);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Chrome automation smoke',
      );
    });
    await test.step('text input, keyboard navigation and real focus', async () => {
      const input = page.getByRole('textbox', { name: 'Sample text' });
      await input.focus();
      await expect(input).toBeFocused();
      await page.keyboard.type('Harmless sample');
      await expect(input).toHaveValue('Harmless sample');
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'Continue' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL('about:blank#complete');
    });
    await test.step('desktop, tablet and mobile viewport control', async () => {
      for (const viewport of [
        { width: 1280, height: 720 },
        { width: 768, height: 1024 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(viewport);
        expect(
          await page.evaluate(() => ({
            width: window.innerWidth,
            height: window.innerHeight,
          })),
        ).toEqual(viewport);
      }
    });
    await test.step('fresh nonpersistent contexts isolate browser state', async () => {
      expect(await context.cookies()).toEqual([]);
      await context.addCookies([
        {
          name: 'smoke_marker',
          value: 'synthetic',
          url: 'https://automation.invalid',
        },
      ]);
      const isolated = await browser.newContext();
      try {
        expect(isolated.pages()).toHaveLength(0);
        expect(await isolated.cookies()).toEqual([]);
        expect(await context.cookies()).toHaveLength(1);
      } finally {
        await isolated.close();
      }
    });
    await rememberProcesses();
  } finally {
    await test.step('browser and observed test-owned processes exit', async () => {
      await context.close();
      await browser.close();
      expect(browser.isConnected()).toBe(false);
      expect(ownedPids.size).toBeGreaterThan(0);
      await expect
        .poll(() => [...ownedPids].filter(isRunning).length, {
          timeout: 10_000,
        })
        .toBe(0);
    });
  }
});
