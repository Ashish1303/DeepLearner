import { expect, test, type Page } from '@playwright/test';

const pageErrors = new WeakMap<Page, string[]>();
const unexpectedRequests = new WeakMap<Page, string[]>();

// Execution and same-build disabled-route HTTP checks require separate owner approval.
// Fixture identities are synthetic; they do not prove authenticated account transitions.
test.beforeEach(async ({ page, context }) => {
  const errors: string[] = [];
  const requests: string[] = [];
  pageErrors.set(page, errors);
  unexpectedRequests.set(page, requests);
  page.on('pageerror', (error) => errors.push(error.message));
  expect(
    process.env.DEEPLEARNER_BROWSER_FIXTURE,
    'Explicit fixture opt-in required',
  ).toBe('1');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      url.origin === 'http://127.0.0.1:3000' &&
      request.method() === 'GET' &&
      !url.pathname.startsWith('/api/')
    )
      return route.continue();
    // The standalone fixture never restores a session or calls catalog APIs.
    // Record only method/origin/path; never retain credential headers or queries.
    requests.push(`${request.method()} ${url.origin}${url.pathname}`);
    await route.abort();
  });
  const response = await page.goto('/test/visualizations');
  expect(response?.status()).toBe(200);
  expect(response?.request().redirectedFrom()).toBeNull();
  await expect(
    page.getByRole('heading', { name: 'Visualization control fixture' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Visualization player', exact: true })
      .getByRole('img', { name: 'Synthetic branching flow', exact: true }),
  ).toBeVisible();
  await expect(
    controls(page).getByRole('button', { name: 'Play', exact: true }),
  ).toBeEnabled();
  expect(requests, 'Unexpected auth, API or external request').toEqual([]);
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
  expect(
    unexpectedRequests.get(page),
    'Unexpected auth, API or external request',
  ).toEqual([]);
});

const controls = (page: Page) =>
  page.getByRole('group', { name: 'Visualization controls', exact: true });
const status = (page: Page) => page.locator('[data-playback-status]');
const button = (page: Page, name: string) =>
  controls(page).getByRole('button', { name, exact: true });
async function freeze(page: Page) {
  const time = new Date('2030-01-01T00:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
}

for (const width of [1280, 768, 390])
  test(`F028 mounted renderer, keyboard controls and contained overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await expect(status(page)).toHaveText('Overview — overview.');
    await expect(button(page, 'Previous')).toBeDisabled();
    // Actual keyboard navigation, not programmatic focus-visible inference.
    await page.keyboard.press('Tab');
    for (
      let i = 0;
      i < 20 &&
      !(await button(page, 'Previous').evaluate(
        (node) => node === document.activeElement,
      ));
      i++
    )
      await page.keyboard.press('Tab');
    await expect(button(page, 'Previous')).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(button(page, 'Next')).toBeFocused();
    expect(
      await button(page, 'Next').evaluate(
        (node) =>
          node.matches(':focus-visible') &&
          getComputedStyle(node).outlineStyle !== 'none',
      ),
    ).toBe(true);
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText('Step 1 of 3 — paused.');
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await expect(button(page, 'Next')).toBeDisabled();
    await expect(button(page, 'Next')).toBeFocused();
    await expect(page.locator('[data-node-index="1"]')).toHaveAttribute(
      'data-selected',
      'true',
    );
    await expect(
      page.getByText(
        'Observe the self-loop without executing any authored text.',
      ),
    ).toBeVisible();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(button(page, 'Reset')).toBeFocused();
    await expect(status(page)).toHaveText('Overview — overview.');
    await page.keyboard.press('Tab');
    const diagram = page.getByRole('region', { name: /Visualization diagram/ });
    await expect(diagram).toBeFocused();
    const box = await diagram.evaluate((node) => ({
      client: node.clientWidth,
      scroll: node.scrollWidth,
    }));
    // The approved fixture must exercise real horizontal scrolling on mobile.
    if (width === 390) expect(box.scroll).toBeGreaterThan(box.client);
    if (box.scroll > box.client) {
      await page.keyboard.press('ArrowRight');
      await expect
        .poll(() => diagram.evaluate((node) => node.scrollLeft))
        .toBeGreaterThan(0);
    } else {
      const bounds = await diagram.evaluate((node) => {
        const container = node.getBoundingClientRect();
        const svg = node.querySelector('svg')!.getBoundingClientRect();
        return {
          left: container.left + node.clientLeft,
          right: container.left + node.clientLeft + node.clientWidth,
          svgLeft: svg.left,
          svgRight: svg.right,
          svgWidth: svg.width,
          scrollLeft: node.scrollLeft,
        };
      });
      expect(bounds.svgWidth).toBeGreaterThan(0);
      expect(bounds.svgLeft).toBeGreaterThanOrEqual(bounds.left);
      expect(bounds.svgRight).toBeLessThanOrEqual(bounds.right);
      expect(bounds.scrollLeft).toBe(0);
    }
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
    for (const control of await controls(page).getByRole('button').all()) {
      const rect = await control.boundingBox();
      expect(rect!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(
      page.getByRole('img', { name: 'Synthetic branching flow' }),
    ).toBeVisible();
  });

test('F028 real-time playback completes on final step and explicit Replay keeps focus', async ({
  page,
}) => {
  await button(page, 'Play').click();
  await expect(status(page)).toHaveText('Step 1 of 3 — playing.');
  await expect(status(page)).toHaveText('Step 3 of 3 — completed.');
  await expect(button(page, 'Replay')).toBeFocused();
  await button(page, 'Replay').press('Enter');
  await expect(status(page)).toHaveText('Step 1 of 3 — playing.');
  await button(page, 'Pause').click();
  await expect(status(page)).toHaveText('Step 1 of 3 — paused.');
});

test('F028 mounted pause resumes a full interval, manual movement pauses and Reset invalidates timers', async ({
  page,
}) => {
  await freeze(page);
  await button(page, 'Play').click();
  await page.clock.runFor(700);
  await button(page, 'Pause').click();
  await page.clock.runFor(5000);
  await expect(status(page)).toHaveText('Step 1 of 3 — paused.');
  await button(page, 'Play').click();
  await page.clock.runFor(999);
  await expect(status(page)).toHaveText('Step 1 of 3 — playing.');
  await page.clock.runFor(1);
  await expect(status(page)).toHaveText('Step 2 of 3 — playing.');
  await button(page, 'Previous').click();
  await page.clock.runFor(5000);
  await expect(status(page)).toHaveText('Step 1 of 3 — paused.');
  await button(page, 'Play').click();
  await button(page, 'Reset').click();
  await page.clock.runFor(5000);
  await expect(status(page)).toHaveText('Overview — overview.');
});

for (const change of [
  'Change account',
  'Change visualization',
  'Replace snapshot',
])
  test(`F028 ${change} resets same-document selection and cancels old playback`, async ({
    page,
  }) => {
    await freeze(page);
    await button(page, 'Play').click();
    await page.clock.runFor(1000);
    await page.getByRole('button', { name: change, exact: true }).click();
    await expect(status(page)).toHaveText('Overview — overview.');
    await page.clock.runFor(5000);
    await expect(status(page)).toHaveText('Overview — overview.');
  });

test('F028 reduced motion disables timed actions and retains manual navigation', async ({
  page,
}) => {
  await freeze(page);
  await button(page, 'Play').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(status(page)).toHaveText('Step 1 of 3 — paused.');
  await expect(button(page, 'Play')).toBeDisabled();
  await page.clock.runFor(5000);
  await button(page, 'Next').click();
  await expect(status(page)).toHaveText('Step 2 of 3 — paused.');
  await expect(
    page.getByText('Reduced motion is enabled.', { exact: false }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(button(page, 'Play')).toBeEnabled();
  await page.clock.runFor(5000);
  await expect(status(page)).toHaveText('Step 2 of 3 — paused.');
});

test('F028 simulated visibility loss pauses without resetting or automatically resuming', async ({
  page,
}) => {
  await freeze(page);
  await button(page, 'Play').click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(5000);
  await expect(status(page)).toHaveText('Step 1 of 3 — paused.');
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'visibilityState');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(5000);
  await expect(status(page)).toHaveText('Step 1 of 3 — paused.');
});

test('F028 invalid, empty, missing and logout inputs disable playback safely', async ({
  page,
}) => {
  await freeze(page);
  for (const label of [
    'Invalid data',
    'Empty steps',
    'Missing data',
    'Logout identity',
  ]) {
    await page
      .getByRole('button', { name: 'Replace snapshot', exact: true })
      .click();
    await button(page, 'Play').click();
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.clock.runFor(5000);
    await expect(status(page)).toHaveText('Playback unavailable.');
    for (const control of await controls(page).getByRole('button').all())
      await expect(control).toBeDisabled();
    await expect(
      page.getByRole('img', { name: 'Synthetic branching flow' }),
    ).toHaveCount(0);
  }
});

test('F028 unmount and single-step completion clear timers without looping', async ({
  page,
}) => {
  await freeze(page);
  await button(page, 'Play').click();
  await page
    .getByRole('button', { name: 'Unmount player', exact: true })
    .click();
  await page.clock.runFor(5000);
  await expect(controls(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Mount player', exact: true }).click();
  await expect(status(page)).toHaveText('Overview — overview.');
  await page.getByRole('button', { name: 'Single step', exact: true }).click();
  await button(page, 'Play').click();
  await page.clock.runFor(999);
  await expect(status(page)).toHaveText('Step 1 of 1 — playing.');
  await page.clock.runFor(1);
  await expect(status(page)).toHaveText('Step 1 of 1 — completed.');
  await page.clock.runFor(5000);
  await expect(status(page)).toHaveText('Step 1 of 1 — completed.');
});

test('F028 authored text is inert and playback adds no API or source requests', async ({
  page,
}) => {
  await freeze(page);
  const requests: string[] = [];
  page.on('request', (request) =>
    requests.push(new URL(request.url()).pathname),
  );
  await expect(
    page.getByText(
      'const text = "<script>alert(1)</script>" is inert teaching text.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator('main script, main iframe, main img')).toHaveCount(
    0,
  );
  await button(page, 'Play').click();
  await page.clock.runFor(3000);
  await button(page, 'Reset').click();
  await button(page, 'Next').click();
  expect(requests).toEqual([]);
});
