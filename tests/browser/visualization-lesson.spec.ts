import { expect, test, type Page } from '@playwright/test';

const title = 'How JavaScript Closures Remember Variables';
const issues = new WeakMap<Page, string[]>();
const controls = (page: Page) =>
  page.getByRole('group', { name: 'Visualization controls', exact: true });
const button = (page: Page, name: string) =>
  controls(page).getByRole('button', { name, exact: true });
const status = (page: Page) => page.locator('[data-playback-status]');
const nodeSets = [
  [0, 1],
  [1, 2],
  [0, 1, 3],
  [1, 2, 3, 4],
  [1, 2, 3, 5],
  [1, 2, 3],
];
const edgeSets = [[0], [1], [2, 3], [3, 4, 5], [3, 4, 6], [1, 3]];
const stepTitles = [
  'Call makeCounter',
  'Initialize the count binding',
  'Create and return increment',
  'First counter() call: return 1',
  'Second counter() call: return 2',
  'The same binding remains accessible',
];

// Execute independently from F024: its afterAll closes the worker-scoped browser.
// Same-build flag-off HTML/RSC checks remain a separately approved HTTP gate.
test.beforeEach(async ({ page, context }) => {
  expect(
    process.env.DEEPLEARNER_BROWSER_FIXTURE,
    'Explicit fixture opt-in required',
  ).toBe('1');
  const errors: string[] = [];
  issues.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
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
    errors.push(`${request.method()} ${url.origin}${url.pathname}`);
    await route.abort();
  });
  const response = await page.goto('/test/visualizations');
  expect(response?.status()).toBe(200);
  expect(response?.request().redirectedFrom()).toBeNull();
  await expect(
    page.getByRole('img', { name: 'Synthetic branching flow', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Load closure lesson', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: title, exact: true }),
  ).toBeVisible();
  await expect(button(page, 'Play')).toBeEnabled();
  await expect(status(page)).toHaveText('Overview — overview.');
});
test.afterEach(async ({ page }) => {
  expect(
    issues.get(page),
    'Unexpected auth/API/external request or page exception',
  ).toEqual([]);
});
async function freeze(page: Page) {
  const time = new Date('2030-01-01T00:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
}
async function highlights(page: Page, index: number) {
  for (const [attribute, expected] of [
    ['data-node-index', nodeSets[index]],
    ['data-edge-index', edgeSets[index]],
  ] as const) {
    await expect
      .poll(async () =>
        page
          .locator(`[${attribute}][data-selected="true"]`)
          .evaluateAll(
            (nodes, attr) =>
              nodes.map((node) => Number(node.getAttribute(attr))),
            attribute,
          ),
      )
      .toEqual(expected);
  }
}

for (const width of [1280, 768, 390])
  test(`F029 six closure stages, readable graph and keyboard scrolling at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    // Native keyboard traversal starts from the clicked lesson selector.
    await page.keyboard.press('Tab');
    const code = page.getByLabel('makeCounter example code', { exact: true });
    await expect(code).toBeFocused();
    expect(
      await code.evaluate(
        (node) =>
          node.matches(':focus-visible') &&
          getComputedStyle(node).outlineStyle !== 'none',
      ),
    ).toBe(true);
    await expect(code).toContainText('const first = counter();  // 1');
    await expect(code).toContainText('const second = counter(); // 2');
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
    for (let index = 0; index < 6; index++) {
      await page.keyboard.press('Enter');
      await expect(status(page)).toHaveText(`Step ${index + 1} of 6 — paused.`);
      await highlights(page, index);
      await expect(
        page.getByText(stepTitles[index], { exact: true }),
      ).toBeVisible();
      await expect(button(page, 'Next')).toBeFocused();
    }
    await expect(button(page, 'Next')).toBeDisabled();
    await expect(
      page.getByText('count: same binding', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/The two results are first = 1 and second = 2/),
    ).toBeVisible();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText('Overview — overview.');
    await page.keyboard.press('Tab');
    const diagram = page.getByRole('region', { name: /Visualization diagram/ });
    await expect(diagram).toBeFocused();
    const sizes = await diagram.evaluate((node) => ({
      client: node.clientWidth,
      scroll: node.scrollWidth,
      height: node.clientHeight,
      scrollHeight: node.scrollHeight,
    }));
    if (width === 390) expect(sizes.scroll).toBeGreaterThan(sizes.client);
    if (sizes.scroll > sizes.client) {
      await page.keyboard.press('ArrowRight');
      await expect
        .poll(() => diagram.evaluate((node) => node.scrollLeft))
        .toBeGreaterThan(0);
    }
    expect(sizes.scrollHeight).toBeGreaterThan(sizes.height);
    await page.keyboard.press('ArrowDown');
    await expect
      .poll(() => diagram.evaluate((node) => node.scrollTop))
      .toBeGreaterThan(0);
    await page.keyboard.press('Control+End');
    await expect
      .poll(() =>
        diagram.evaluate((node) => node.scrollTop + node.clientHeight),
      )
      .toBeGreaterThanOrEqual(sizes.scrollHeight - 1);
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
    for (const control of await controls(page).getByRole('button').all()) {
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

test('F029 fallback timing, pause/resume, final dwell and explicit replay', async ({
  page,
}) => {
  await freeze(page);
  await button(page, 'Play').click();
  await page.clock.runFor(1000);
  await button(page, 'Pause').click();
  await page.clock.runFor(10000);
  await expect(status(page)).toHaveText('Step 1 of 6 — paused.');
  await button(page, 'Play').click();
  await page.clock.runFor(1999);
  await expect(status(page)).toHaveText('Step 1 of 6 — playing.');
  await page.clock.runFor(1);
  await expect(status(page)).toHaveText('Step 2 of 6 — playing.');
  for (let index = 2; index < 6; index++) {
    await page.clock.runFor(2000);
    await expect(status(page)).toHaveText(`Step ${index + 1} of 6 — playing.`);
    await highlights(page, index);
  }
  await page.clock.runFor(1999);
  await expect(status(page)).toHaveText('Step 6 of 6 — playing.');
  await page.clock.runFor(1);
  await expect(status(page)).toHaveText('Step 6 of 6 — completed.');
  await expect(button(page, 'Replay')).toBeFocused();
  await page.clock.runFor(10000);
  await expect(status(page)).toHaveText('Step 6 of 6 — completed.');
  await button(page, 'Replay').press('Enter');
  await expect(status(page)).toHaveText('Step 1 of 6 — playing.');
  await button(page, 'Reset').click();
  await page.clock.runFor(20000);
  await expect(status(page)).toHaveText('Overview — overview.');
});

test('F029 reduced motion retains all manual stages without autoplay', async ({
  page,
}) => {
  await freeze(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(button(page, 'Play')).toBeDisabled();
  for (let index = 0; index < 6; index++) {
    await button(page, 'Next').press('Enter');
    await highlights(page, index);
  }
  await page.clock.runFor(20000);
  await expect(status(page)).toHaveText('Step 6 of 6 — paused.');
  await button(page, 'Previous').press('Enter');
  await expect(status(page)).toHaveText('Step 5 of 6 — paused.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.runFor(20000);
  await expect(status(page)).toHaveText('Step 5 of 6 — paused.');
});

test('F029 identity and synthetic snapshot replacement cancel lesson playback', async ({
  page,
}) => {
  await freeze(page);
  await button(page, 'Play').click();
  await page
    .getByRole('button', { name: 'Change account', exact: true })
    .click();
  await page.clock.runFor(20000);
  await expect(status(page)).toHaveText('Overview — overview.');
  await button(page, 'Play').click();
  await page
    .getByRole('button', { name: 'Replace snapshot', exact: true })
    .click();
  await page.clock.runFor(20000);
  await expect(
    page.getByRole('img', { name: 'Synthetic branching flow', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Closure lesson example')).toHaveCount(0);
  await expect(status(page)).toHaveText('Overview — overview.');
  await page
    .getByRole('button', { name: 'Load closure lesson', exact: true })
    .click();
  await expect(
    page.getByRole('img', { name: title, exact: true }),
  ).toBeVisible();
  await expect(status(page)).toHaveText('Overview — overview.');
});

test('F029 authored code stays inert and playback makes no network requests', async ({
  page,
}) => {
  await freeze(page);
  const requests: string[] = [];
  page.on('request', (request) =>
    requests.push(new URL(request.url()).pathname),
  );
  await expect(page.locator('main script, main iframe, main img')).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(() =>
      ['makeCounter', 'counter', 'first', 'second'].some((key) =>
        Object.prototype.hasOwnProperty.call(window, key),
      ),
    ),
  ).toBe(false);
  await button(page, 'Play').click();
  await page.clock.runFor(12000);
  await expect(status(page)).toHaveText('Step 6 of 6 — completed.');
  expect(requests).toEqual([]);
});
