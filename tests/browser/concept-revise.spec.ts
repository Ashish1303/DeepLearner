import process from 'node:process';
import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Request,
  type Route,
} from '@playwright/test';

// Browser execution is separately gated. These are mocked contract tests, not live API/DB proof.
const tech = 'a'.repeat(24),
  pathId = 'b'.repeat(24),
  moduleId = 'c'.repeat(24),
  topicId = 'd'.repeat(24);
const cid = (index: number) => index.toString(16).padStart(24, '0');
const topicUrl = '/topics/' + topicId;
const api = 'http://127.0.0.1:4000/api/v1';
const summary = (index: number, account = '') => ({
  id: cid(index),
  technologyId: tech,
  learningPathId: pathId,
  moduleId,
  topicId,
  title: `${account}Concept ${index}`,
  slug: `concept-${index}`,
  summary: `${account}Summary ${index}`,
  difficulty: 'BEGINNER',
  order: index,
});
const detail = (index: number, account = '') => {
  const { summary: text, ...rest } = summary(index, account);
  return {
    ...rest,
    revise: {
      summary: account + 'Revision <script>plain</script> **not Markdown**',
      keyPoints: ['Second authored point', 'First authored point <img>'],
      memoryTrick: account + 'Remember [plain](https://reference.invalid)',
      importantCodeMarkdown:
        '## Quick reference\n\n#### Detail\n\n~~~js\nconst text = "' +
        'x'.repeat(240) +
        '";\n~~~\n\n[Documentation](https://reference.invalid/docs)\n\n[Unsafe](javascript:alert%281%29)\n\n![Revision image](https://image.invalid/remote.png)\n\n<script>window.f024Injected = true</script>',
    },
    examples: [
      {
        title: account + 'Analogy',
        bodyMarkdown:
          '## A labelled box\n\nA variable name is like a label on a box.\n\n~~~js\nconst message = "' +
          'x'.repeat(240) +
          '";\n~~~\n\n[Documentation](https://reference.invalid/docs)\n\n[Unsafe](javascript:alert%281%29)\n\n![Example image](https://image.invalid/remote.png)\n\n<script>window.f024Injected = true</script>',
      },
      {
        title: account + 'Practical use',
        bodyMarkdown: '# Greeting\n\nUse a variable to name a greeting.',
      },
    ],
    contentFormat: 'MARKDOWN',
    schemaVersion: 1,
    read: {
      summary: text,
      bodyMarkdown:
        '# Definition\n\nA **safe** explanation.\n\n- Item one\n- Item two\n\n```js\nconst sample = "<script>";\n```\n\n[Documentation](https://reference.invalid/docs)\n\n[Unsafe](javascript:alert%281%29)\n\n![Image description](https://image.invalid/remote.png)\n\n<script>window.f024Injected = true</script>',
    },
    source: {
      label: 'Synthetic reference',
      url: 'https://reference.invalid/docs',
      sourceType: 'OFFICIAL_OR_TRUSTED',
      isOfficial: true,
    },
  };
};
const envelope = (data: unknown) => ({
  success: true,
  message: null,
  data,
  meta: { requestId: 'f024-browser' },
});
const list = (data: unknown[], page: number, total: number) => ({
  ...envelope(data),
  meta: {
    requestId: 'f024-browser',
    page,
    limit: 20,
    total,
    totalPages: Math.ceil(total / 20),
  },
});
const initialUser = {
  id: '1'.repeat(24),
  firstName: 'Synthetic',
  lastName: 'Student',
  email: 'student@example.invalid',
  emailVerified: true,
  role: 'STUDENT',
  plan: 'FREE',
  status: 'ACTIVE',
  authMethods: ['PASSWORD'],
  profile: {
    experienceLevel: 'BEGINNER',
    learningGoals: ['LEARN_FROM_SCRATCH'],
    preferredDifficulty: 'BEGINNER',
    dailyStudyGoalMinutes: 20,
    interestedTechnologyIds: [],
  },
  createdAt: '2026-01-01T00:00:00.000Z',
};
const headers = {
  'Access-Control-Allow-Origin': 'http://127.0.0.1:3000',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'authorization,content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Cache-Control': 'no-store',
};
type Fault = number | 'malformed' | 'network' | 'hold' | null;
type TransitionHold = {
  url: string;
  method: 'GET';
  resource: 'list' | 'detail';
  userId: string;
  account: string;
  records: { request: Request; route: Route; body: unknown }[];
};
async function mock(context: BrowserContext) {
  const state = {
    user: {
      ...initialUser,
      profile: initialUser.profile as typeof initialUser.profile | null,
    },
    invalidSession: false,
    reviseKind: 'normal' as
      'normal' | 'empty' | 'legacy' | 'partial' | 'malformed',
    fault: null as Fault,
    total: 21,
    logoutFails: false,
    conceptAccount: '',
    browseHierarchy: false,
    counters: { refresh: 0, logout: 0, catalog: 0 },
    catalogCredentials: [] as { authorization: boolean; cookie: boolean }[],
    externalRequests: [] as string[],
    unexpected: [] as string[],
    held: [] as { route: Route; body: unknown }[],
    failed: [] as string[],
    transitionHold: null as TransitionHold | null,
    requestStates: new Map<
      Request,
      'pending' | 'cancelled' | 'failed' | 'completed'
    >(),
  };
  const failure = (code: string) => ({
    success: false,
    error: { code, message: 'Synthetic failure' },
    meta: { requestId: 'f024-browser' },
  });
  await context.route('**/*', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const requestOwner = {
      userId: state.user.id,
      account: state.conceptAccount,
    };
    const transitionHold = state.transitionHold;
    if (url.origin === 'http://127.0.0.1:3000') {
      await route.continue();
      return;
    }
    if (url.origin !== 'http://127.0.0.1:4000') {
      state.externalRequests.push(url.origin);
      await route.abort();
      return;
    }
    const send = (body: unknown, status = 200) =>
      route.fulfill({ status, headers, json: body });
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const path = url.pathname.slice('/api/v1'.length);
    if (path === '/auth/refresh') {
      state.counters.refresh++;
      await send(
        state.invalidSession
          ? failure('AUTH_REFRESH_TOKEN_INVALID')
          : envelope({
              accessToken: 'synthetic-test-token',
              expiresInSeconds: 900,
            }),
        state.invalidSession ? 401 : 200,
      );
      return;
    }
    if (path === '/auth/login') {
      await send(
        envelope({
          accessToken: 'synthetic-test-token',
          expiresInSeconds: 900,
        }),
      );
      return;
    }
    if (path === '/auth/logout') {
      state.counters.logout++;
      await send(
        state.logoutFails ? failure('DEPENDENCY_UNAVAILABLE') : envelope(null),
        state.logoutFails ? 503 : 200,
      );
      return;
    }
    if (path === '/users/me') {
      await send(envelope(state.user));
      return;
    }
    const fullHeaders = await request.allHeaders();
    state.catalogCredentials.push({
      authorization: 'authorization' in fullHeaders,
      cookie: 'cookie' in fullHeaders,
    });
    state.counters.catalog++;
    const moduleRecord = {
      id: moduleId,
      technologyId: tech,
      learningPathId: pathId,
      title: 'Synthetic module',
      slug: 'module',
      description: null,
      order: 0,
    };
    const topic = {
      ...moduleRecord,
      id: topicId,
      moduleId,
      title: 'Synthetic topic',
      slug: 'topic',
    };
    if (path === '/topics/' + topicId) {
      await send(envelope(topic));
      return;
    }
    if (path === '/modules/' + moduleId) {
      await send(envelope(moduleRecord));
      return;
    }
    const pathRecord = {
      id: pathId,
      technologyId: tech,
      title: 'Synthetic path',
      slug: 'path',
      description: null,
      order: 0,
      targetLevel: null,
      completionScore: 70,
    };
    if (path === '/learning-paths/' + pathId) {
      await send(envelope(pathRecord));
      return;
    }
    if (state.browseHierarchy) {
      const ancestors = new Map<string, unknown>([
        ['/learning-paths', pathRecord],
        ['/modules', moduleRecord],
        ['/topics', topic],
      ]);
      if (ancestors.has(path)) {
        await send(list([ancestors.get(path)], 1, 1));
        return;
      }
    }
    if (path === '/technologies') {
      const rows = state.browseHierarchy
        ? [
            {
              id: tech,
              name: 'Synthetic technology',
              slug: 'synthetic-technology',
              description: null,
              iconAssetId: null,
              order: 0,
            },
          ]
        : [];
      await send(list(rows, 1, rows.length));
      return;
    }
    if (path === '/concepts' || path.startsWith('/concepts/')) {
      let body: unknown;
      if (path === '/concepts') {
        const page = Number(url.searchParams.get('page'));
        expect(url.searchParams.get('topicId')).toBe(topicId);
        expect(url.searchParams.get('limit')).toBe('20');
        const rows = Array.from(
          { length: Math.max(0, Math.min(20, state.total - (page - 1) * 20)) },
          (_, i) => summary((page - 1) * 20 + i + 1, requestOwner.account),
        );
        body = list(rows, page, state.total);
      } else {
        const result: Record<string, unknown> = detail(
          parseInt(path.split('/').at(-1)!, 16),
          requestOwner.account,
        );
        if (state.reviseKind === 'empty') result.revise = null;
        if (state.reviseKind === 'legacy') delete result.revise;
        if (state.reviseKind === 'partial')
          result.revise = { summary: 'Summary only' };
        if (state.reviseKind === 'malformed')
          result.revise = { summary: 'Revision', keyPoints: null };
        body = envelope(result);
      }
      if (
        transitionHold &&
        request.url() === transitionHold.url &&
        request.method() === transitionHold.method &&
        (path === '/concepts' ? 'list' : 'detail') ===
          transitionHold.resource &&
        requestOwner.userId === transitionHold.userId &&
        requestOwner.account === transitionHold.account
      ) {
        transitionHold.records.push({ request, route, body });
        return;
      }
      if (state.fault === 'hold') {
        state.held.push({ route, body });
        return;
      }
      if (state.fault === 'network') {
        await route.abort('failed');
        return;
      }
      if (state.fault === 'malformed') {
        await send({ success: true, data: {} });
        return;
      }
      if (typeof state.fault === 'number') {
        await send(failure('SYNTHETIC_ERROR'), state.fault);
        return;
      }
      await send(body);
      return;
    }
    state.unexpected.push(path);
    await send(failure('UNEXPECTED_MOCK_REQUEST'), 500);
  });
  context.on('request', (request) => {
    if (request.url().startsWith(api + '/concepts'))
      state.requestStates.set(request, 'pending');
  });
  context.on('requestfinished', (request) => {
    if (state.requestStates.has(request))
      state.requestStates.set(request, 'completed');
  });
  context.on('requestfailed', (request) => {
    if (request.url().startsWith(api + '/concepts')) {
      state.failed.push(request.url());
      state.requestStates.set(
        request,
        request.failure()?.errorText === 'net::ERR_ABORTED'
          ? 'cancelled'
          : 'failed',
      );
    }
  });
  await context.addCookies([
    {
      name: 'synthetic_api_cookie',
      value: 'synthetic',
      url: 'http://127.0.0.1:4000',
      httpOnly: true,
    },
  ]);
  return state;
}
async function release(
  state: Pick<Awaited<ReturnType<typeof mock>>, 'held'>,
  failure = false,
) {
  for (const held of state.held.splice(0)) {
    // A cancelled transport may reject fulfillment. That proves cancellation, not delivery to a generation check.
    try {
      await held.route.fulfill({
        status: failure ? 503 : 200,
        headers,
        json: failure
          ? {
              success: false,
              error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Synthetic' },
              meta: { requestId: 'test' },
            }
          : held.body,
      });
    } catch (error) {
      if (!held.route.request().failure()) throw error;
    }
  }
}
function armTransitionHold(
  state: Awaited<ReturnType<typeof mock>>,
  url: string,
  resource: TransitionHold['resource'],
) {
  expect(state.transitionHold).toBeNull();
  const hold: TransitionHold = {
    url,
    method: 'GET',
    resource,
    userId: state.user.id,
    account: state.conceptAccount,
    records: [],
  };
  state.transitionHold = hold;
  return hold;
}
async function activeTransitionRequest(
  page: Page,
  state: Awaited<ReturnType<typeof mock>>,
  hold: TransitionHold,
) {
  // Let mounted effects flush; classify observed requests without assuming why
  // predecessors exist (Strict Mode is enabled, but is not itself evidence).
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const active = () =>
    hold.records.filter(
      (record) => state.requestStates.get(record.request) === 'pending',
    );
  await expect.poll(() => active().length).toBe(1);
  const target = active()[0]!;
  for (const record of hold.records) {
    expect(record.request.url()).toBe(hold.url);
    expect(record.request.method()).toBe(hold.method);
    expect(record.request.resourceType()).toBe('fetch');
    if (record !== target) {
      expect(state.requestStates.get(record.request)).toBe('cancelled');
      expect(record.request.failure()?.errorText).toBe('net::ERR_ABORTED');
    }
  }
  expect(target.request.failure()).toBeNull();
  return target.request;
}
async function cancelTransitionRequest(
  page: Page,
  state: Awaited<ReturnType<typeof mock>>,
  hold: TransitionHold,
  target: Request,
  transition: () => Promise<unknown>,
) {
  expect(
    hold.records
      .filter((record) => state.requestStates.get(record.request) === 'pending')
      .map((record) => record.request),
  ).toEqual([target]);
  // This waiter cannot be satisfied by an earlier failure of the same URL.
  const [cancelled] = await Promise.all([
    page.waitForEvent('requestfailed', {
      predicate: (request) => request === target,
    }),
    transition(),
  ]);
  expect(cancelled).toBe(target);
  expect(target.failure()?.errorText).toBe('net::ERR_ABORTED');
  expect(await target.response()).toBeNull();
  await expect
    .poll(() =>
      hold.records.every(
        (record) => state.requestStates.get(record.request) === 'cancelled',
      ),
    )
    .toBe(true);
}
async function releaseTransition(
  page: Page,
  state: Awaited<ReturnType<typeof mock>>,
  hold: TransitionHold,
  failure: boolean,
) {
  for (const record of hold.records)
    expect(state.requestStates.get(record.request)).toBe('cancelled');
  await release({ held: [...hold.records] }, failure);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  // A release attempt after transport cancellation does not prove that its
  // response reached the controller's generation check.
  for (const record of hold.records)
    expect(state.requestStates.get(record.request)).toBe('cancelled');
}
async function assertSafe(state: Awaited<ReturnType<typeof mock>>) {
  expect(state.unexpected).toEqual([]);
  expect(state.externalRequests).toEqual([]);
  expect(state.catalogCredentials.length).toBeGreaterThan(0);
  expect(
    state.catalogCredentials.every(
      (entry) => !entry.authorization && !entry.cookie,
    ),
  ).toBe(true);
}
async function switchIdentity(page: Page) {
  await page.evaluate(() => {
    const channel = new BroadcastChannel('deeplearner-auth');
    channel.postMessage('identity-changed');
    channel.close();
  });
}
const observedPids = new Set<number>();
test.beforeAll(async ({ browser }) => {
  const cdp = await browser.newBrowserCDPSession();
  const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
  for (const entry of processInfo) observedPids.add(entry.id);
  await cdp.detach();
});
test.afterEach(async ({ browser }) => {
  const cdp = await browser.newBrowserCDPSession();
  try {
    const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
    for (const entry of processInfo) observedPids.add(entry.id);
  } finally {
    await cdp.detach();
  }
});
test.afterAll(async ({ browser }) => {
  try {
    const closed = await Promise.allSettled(
      browser.contexts().map((context) => context.close()),
    );
    expect(closed.every((result) => result.status === 'fulfilled')).toBe(true);
  } finally {
    await browser.close();
  }
  expect(browser.isConnected()).toBe(false);
  await expect
    .poll(
      () =>
        [...observedPids].filter((pid) => {
          try {
            process.kill(pid, 0);
            return true;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
            throw error;
          }
        }).length,
      { timeout: 10000 },
    )
    .toBe(0);
  // Playwright owns webServer teardown after the suite; verify its port/process release at the execution gate.
});

test('Read default, Revise navigation, no extra fetch and resource/reload reset', async ({
  page,
  context,
}) => {
  const state = await mock(context);
  await page.goto(topicUrl);
  const navigation = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return (
        url.origin === 'http://127.0.0.1:3000' &&
        url.pathname === '/concepts/' + cid(1) &&
        url.searchParams.has('_rsc') &&
        response.request().method() === 'GET'
      );
    },
    { timeout: 10_000 },
  );
  const [response] = await Promise.all([
    navigation,
    page.getByRole('link', { name: 'Concept 1', exact: true }).click(),
  ]);
  expect(response.status()).toBe(200);
  const read = page.getByRole('tab', { name: 'Read', exact: true });
  await expect(read).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  const before = { ...state.counters };
  for (let i = 0; i < 3; i++)
    for (const name of ['Example', 'Revise', 'Read']) {
      await page.getByRole('tab', { name, exact: true }).click();
      await expect(
        page.getByRole('tabpanel', { name, exact: true }),
      ).toBeVisible();
    }
  expect(state.counters).toEqual(before);
  await page.getByRole('tab', { name: 'Revise', exact: true }).click();
  await page
    .getByRole('link', { name: 'Back to Synthetic topic', exact: true })
    .click();
  await page.getByRole('link', { name: 'Concept 2', exact: true }).click();
  await expect(read).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Revise', exact: true }).click();
  await page.reload();
  await expect(read).toHaveAttribute('aria-selected', 'true');
  await assertSafe(state);
});

for (const width of [1280, 768, 390])
  test(
    'three-tab keyboard, safe Revise content and contained scrolling at ' +
      width,
    async ({ page, context }) => {
      const state = await mock(context);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/concepts/' + cid(1));
      const read = page.getByRole('tab', { name: 'Read', exact: true });
      await expect(read).toBeVisible();
      await expect(page.getByRole('tab')).toHaveText([
        'Read',
        'Example',
        'Revise',
      ]);
      const before = { ...state.counters };
      // The loaded h1 receives focus. Tab from there reaches the first tab via the real keyboard.
      await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(read).toBeFocused();
      for (const [key, name] of [
        ['ArrowRight', 'Example'],
        ['ArrowRight', 'Revise'],
        ['ArrowRight', 'Read'],
        ['ArrowLeft', 'Revise'],
        ['ArrowLeft', 'Example'],
        ['Home', 'Read'],
        ['End', 'Revise'],
      ] as const) {
        await page.keyboard.press(key);
        const active = page.getByRole('tab', { name, exact: true });
        await expect(active).toBeFocused();
        await expect(active).toHaveAttribute('aria-selected', 'true');
        await expect(active).toHaveAttribute('tabindex', '0');
        expect(
          await active.evaluate(
            (element) =>
              element.matches(':focus-visible') &&
              getComputedStyle(element).outlineStyle !== 'none' &&
              parseFloat(getComputedStyle(element).outlineWidth) > 0,
          ),
        ).toBe(true);
        for (const inactive of ['Read', 'Example', 'Revise'].filter(
          (value) => value !== name,
        )) {
          await expect(
            page.getByRole('tab', { name: inactive, exact: true }),
          ).toHaveAttribute('tabindex', '-1');
          await expect(
            page.getByRole('tab', { name: inactive, exact: true }),
          ).toHaveAttribute('aria-selected', 'false');
        }
        const panel = page.getByRole('tabpanel', { name, exact: true });
        await expect(page.getByRole('tabpanel')).toHaveCount(1);
        await expect(panel).toHaveAttribute(
          'id',
          (await active.getAttribute('aria-controls'))!,
        );
        await expect(panel).toHaveAttribute(
          'aria-labelledby',
          (await active.getAttribute('id'))!,
        );
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        ).toBe(true);
      }
      const panel = page.getByRole('tabpanel', { name: 'Revise', exact: true });
      await page.keyboard.press('Tab');
      await expect(panel).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Home');
      await page.keyboard.press('Space');
      await expect(read).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');
      await expect(panel).toBeVisible();
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(panel.locator('h3')).toHaveText([
        'Key points',
        'Memory trick',
        'Important code',
      ]);
      await expect(panel.locator('h4')).toHaveText(['Quick reference']);
      await expect(panel.locator('h5')).toHaveText(['Detail']);
      await expect(
        panel.getByText('Revision <script>plain</script> **not Markdown**', {
          exact: true,
        }),
      ).toBeVisible();
      await expect(panel.locator('li')).toHaveText([
        'Second authored point',
        'First authored point <img>',
      ]);
      await expect(
        panel.getByText('Remember [plain](https://reference.invalid)', {
          exact: true,
        }),
      ).toBeVisible();
      await expect(panel.locator('img,iframe,script')).toHaveCount(0);
      await expect(panel.getByRole('link', { name: 'Unsafe' })).toHaveCount(0);
      const link = panel.getByRole('link', {
        name: 'Documentation (opens in a new tab)',
      });
      await expect(link).toHaveAttribute(
        'href',
        'https://reference.invalid/docs',
      );
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(link).toHaveAttribute('target', '_blank');
      expect(
        await page.evaluate(
          () => (window as unknown as Record<string, unknown>).f024Injected,
        ),
      ).toBeUndefined();
      await page.keyboard.press('Tab');
      await expect(panel).toBeFocused();
      await page.keyboard.press('Tab');
      const code = panel.getByRole('region', { name: 'Code block' });
      await expect(code).toBeFocused();
      expect(
        await code.evaluate(
          (element) =>
            element.matches(':focus-visible') &&
            getComputedStyle(element).outlineStyle !== 'none',
        ),
      ).toBe(true);
      expect(
        await code.evaluate(
          (element) => element.scrollWidth > element.clientWidth,
        ),
      ).toBe(true);
      await code.evaluate((element) => {
        element.scrollLeft = 100;
      });
      expect(
        await code.evaluate((element) => element.scrollLeft),
      ).toBeGreaterThan(0);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
      expect(state.counters).toEqual(before);
      await assertSafe(state);
    },
  );

test('summary-only revision omits unavailable optional sections', async ({
  page,
  context,
}) => {
  const state = await mock(context);
  state.reviseKind = 'partial';
  await page.goto('/concepts/' + cid(1));
  await page.getByRole('tab', { name: 'Revise', exact: true }).click();
  const panel = page.getByRole('tabpanel', { name: 'Revise', exact: true });
  await expect(panel.getByText('Summary only', { exact: true })).toBeVisible();
  await expect(panel.locator('h3,ul,pre')).toHaveCount(0);
  await expect(
    panel.getByText('No revision content is available for this Concept yet.'),
  ).toHaveCount(0);
  await assertSafe(state);
});
for (const kind of ['empty', 'legacy'] as const)
  test(
    kind + ' revision shows truthful empty state',
    async ({ page, context }) => {
      const state = await mock(context);
      state.reviseKind = kind;
      await page.goto('/concepts/' + cid(1));
      await page.getByRole('tab', { name: 'Revise', exact: true }).click();
      await expect(
        page.getByText(
          'No revision content is available for this Concept yet.',
          {
            exact: true,
          },
        ),
      ).toBeVisible();
      await assertSafe(state);
    },
  );
for (const fault of [401, 404, 503, 'malformed'] as const)
  test(
    'Revise detail ' + fault + ' is observed before explicit Retry',
    async ({ page, context }) => {
      const state = await mock(context);
      await page.goto(topicUrl);
      await expect(
        page.getByRole('link', { name: 'Concept 1', exact: true }),
      ).toBeVisible();
      const before = {
        refresh: state.counters.refresh,
        logout: state.counters.logout,
      };
      if (fault === 'malformed') state.reviseKind = 'malformed';
      else state.fault = fault;
      const target = api + '/concepts/' + cid(1);
      const requests: Request[] = [];
      page.on('request', (request) => {
        if (request.url() === target && request.method() === 'GET')
          requests.push(request);
      });
      const response = page.waitForResponse(
        (r) => r.url() === target && r.request().method() === 'GET',
      );
      await page.getByRole('link', { name: 'Concept 1', exact: true }).click();
      expect((await response).status()).toBe(
        fault === 'malformed' ? 200 : fault,
      );
      const main = page.locator('#student-main');
      await expect(main.getByRole('alert')).toBeVisible();
      await expect(main.getByRole('tab')).toHaveCount(0);
      expect({
        refresh: state.counters.refresh,
        logout: state.counters.logout,
      }).toEqual(before);
      const failedCount = requests.length;
      expect(failedCount).toBeGreaterThan(0);
      state.reviseKind = 'normal';
      state.fault = null;
      const recovered = page.waitForResponse(
        (r) => r.url() === target && r.request().method() === 'GET',
      );
      await main.getByRole('button', { name: 'Retry', exact: true }).click();
      expect((await recovered).status()).toBe(200);
      await expect(
        page.getByRole('tab', { name: 'Read', exact: true }),
      ).toHaveAttribute('aria-selected', 'true');
      await page.getByRole('tab', { name: 'Revise', exact: true }).click();
      await expect(
        page.getByText('Revision <script>plain</script> **not Markdown**', {
          exact: true,
        }),
      ).toBeVisible();
      expect(requests.length).toBe(failedCount + 1);
      expect({
        refresh: state.counters.refresh,
        logout: state.counters.logout,
      }).toEqual(before);
      await assertSafe(state);
    },
  );
for (const role of ['ADMIN', 'INVALID'] as const)
  test(role + ' cannot access Revise content', async ({ page, context }) => {
    const state = await mock(context);
    if (role === 'ADMIN') state.user.role = 'ADMIN';
    else state.invalidSession = true;
    await page.goto('/concepts/' + cid(1));
    if (role === 'ADMIN')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Student area',
      );
    else await expect(page).toHaveURL(/\/login\?next=\/dashboard/);
    expect(state.counters.catalog).toBe(0);
    await expect(page.getByRole('tab')).toHaveCount(0);
  });
for (const lateFailure of [false, true]) {
  test(`same-document cancellation and account transition reject old ${lateFailure ? 'failure' : 'success'}`, async ({
    page,
    context,
  }) => {
    const state = await mock(context);
    state.browseHierarchy = true;
    await page.goto(topicUrl);
    await expect(
      page.getByRole('link', { name: 'Concept 1', exact: true }),
    ).toBeVisible();
    const documentToken = await page.evaluate(() => {
      const marker = crypto.randomUUID();
      (window as unknown as Record<string, unknown>).f024Document = marker;
      return marker;
    });
    const resourceHold = armTransitionHold(
      state,
      `${api}/concepts/${cid(1)}`,
      'detail',
    );
    await page.getByRole('link', { name: 'Concept 1', exact: true }).click();
    const resourceRequest = await activeTransitionRequest(
      page,
      state,
      resourceHold,
    );
    // Leaving the loading resource via its real fallback breadcrumb unmounts its owner.
    await cancelTransitionRequest(
      page,
      state,
      resourceHold,
      resourceRequest,
      () =>
        page
          .getByRole('navigation', { name: 'Breadcrumb' })
          .getByRole('link', { name: 'Explore technologies' })
          .click(),
    );
    await expect(page).toHaveURL(/\/explore-technologies$/);
    state.transitionHold = null;
    await expect(
      page.getByRole('heading', { name: 'Synthetic technology', exact: true }),
    ).toBeVisible();
    await releaseTransition(page, state, resourceHold, lateFailure);
    await expect(
      page.getByRole('heading', { name: 'Synthetic technology', exact: true }),
    ).toBeVisible();
    await expect(page.locator('#student-main').getByRole('alert')).toHaveCount(
      0,
    );
    await expect(page.getByText('Summary 1', { exact: true })).toHaveCount(0);
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>).f024Document,
      ),
    ).toBe(documentToken);
    // The auth control message is the existing account-invalidation path, never a token/profile broadcast.
    // Return through real Next links, preserving the original document throughout.
    for (const href of [
      `/explore-technologies/${tech}/learning-paths`,
      `/learning-paths/${pathId}`,
      `/modules/${moduleId}`,
      topicUrl,
    ])
      await page.locator(`#student-main a[href="${href}"]`).click();
    await expect(
      page.getByRole('link', { name: 'Concept 2', exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Concept 2', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Concept 2',
    );
    const accountHold = armTransitionHold(
      state,
      `${api}/concepts?topicId=${topicId}&page=1&limit=20`,
      'list',
    );
    await page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: 'Synthetic topic', exact: true })
      .click();
    const accountRequest = await activeTransitionRequest(
      page,
      state,
      accountHold,
    );
    state.user.id = '2'.repeat(24);
    state.user.role = 'ADMIN';
    state.transitionHold = null;
    await cancelTransitionRequest(
      page,
      state,
      accountHold,
      accountRequest,
      () => switchIdentity(page),
    );
    await expect(page).toHaveURL(/\/login\?next=\/dashboard/);
    await page
      .getByLabel('Email address', { exact: true })
      .fill('other@example.invalid');
    await page
      .getByLabel('Password', { exact: true })
      .fill('Synthetic-only-password');
    await page
      .getByRole('form', { name: 'Log in' })
      .locator('button[type="submit"]')
      .click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Student area',
    );
    await releaseTransition(page, state, accountHold, lateFailure);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Student area',
    );
    await expect(page.getByText('Summary 2', { exact: true })).toHaveCount(0);
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>).f024Document,
      ),
    ).toBe(documentToken);
    await assertSafe(state);
  });
}
for (const lateFailure of [false, true]) {
  test(`mounted STUDENT to STUDENT transition isolates delayed ${lateFailure ? 'failure' : 'success'}`, async ({
    page,
    context,
  }) => {
    const state = await mock(context);
    state.conceptAccount = 'Student A ';
    state.browseHierarchy = true;
    await page.goto(topicUrl);
    await expect(
      page.getByRole('link', { name: 'Student A Concept 1', exact: true }),
    ).toBeVisible();
    const documentToken = await page.evaluate(() => {
      const marker = crypto.randomUUID();
      (window as unknown as Record<string, unknown>).f024Document = marker;
      return marker;
    });
    // First display A's Revise state, then hold a subsequent detail request.
    await page
      .getByRole('link', { name: 'Student A Concept 1', exact: true })
      .click();
    await page.getByRole('tab', { name: 'Revise', exact: true }).click();
    await expect(
      page.getByText(
        'Student A Revision <script>plain</script> **not Markdown**',
        { exact: true },
      ),
    ).toBeVisible();
    await page
      .getByRole('link', { name: 'Back to Synthetic topic', exact: true })
      .click();
    await expect(
      page.getByRole('link', { name: 'Student A Concept 1', exact: true }),
    ).toBeVisible();
    const accountHold = armTransitionHold(
      state,
      `${api}/concepts/${cid(1)}`,
      'detail',
    );
    await page
      .getByRole('link', { name: 'Student A Concept 1', exact: true })
      .click();
    const oldRequest = await activeTransitionRequest(page, state, accountHold);
    // The held body was captured for A; B gets distinguishable data for the same ID.
    state.user = {
      ...state.user,
      id: '2'.repeat(24),
      firstName: 'Second',
      email: 'second@example.invalid',
    };
    state.conceptAccount = 'Student B ';
    state.transitionHold = null;
    await cancelTransitionRequest(page, state, accountHold, oldRequest, () =>
      switchIdentity(page),
    );
    await expect(page).toHaveURL(/\/login\?next=\/dashboard/);
    await page
      .getByLabel('Email address', { exact: true })
      .fill('second@example.invalid');
    await page
      .getByLabel('Password', { exact: true })
      .fill('Synthetic-only-password');
    await page
      .getByRole('form', { name: 'Log in' })
      .locator('button[type="submit"]')
      .click();
    await expect(page).toHaveURL(/\/dashboard$/);
    // Use actual Next links throughout; a document reload would invalidate this test.
    await page.locator('aside a[href="/explore-technologies"]').click();
    for (const href of [
      `/explore-technologies/${tech}/learning-paths`,
      `/learning-paths/${pathId}`,
      `/modules/${moduleId}`,
      topicUrl,
    ])
      await page.locator(`#student-main a[href="${href}"]`).click();
    await expect(
      page.getByRole('link', { name: 'Student B Concept 1', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Student A Summary 1', { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole('link', { name: 'Student B Concept 1', exact: true })
      .click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Student B Concept 1',
    );
    await expect(
      page.getByText('Student B Summary 1', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('tab', { name: 'Read', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Revise', exact: true }).click();
    await expect(
      page.getByText(
        'Student B Revision <script>plain</script> **not Markdown**',
        { exact: true },
      ),
    ).toBeVisible();
    expect(state.requestStates.get(oldRequest)).toBe('cancelled');
    await releaseTransition(page, state, accountHold, lateFailure);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Student B Concept 1',
    );
    await expect(
      page.getByText('Student B Summary 1', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Student B Revision <script>plain</script> **not Markdown**',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/Student A (Concept|Summary|Revision|Remember)/),
    ).toHaveCount(0);
    await expect(page.locator('#student-main').getByRole('alert')).toHaveCount(
      0,
    );
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>).f024Document,
      ),
    ).toBe(documentToken);
    await assertSafe(state);
  });
}

test('held Revise detail shows loading until the identified response is released', async ({
  page,
  context,
}) => {
  const state = await mock(context);
  await page.goto(topicUrl);
  await expect(
    page.getByRole('link', { name: 'Concept 1', exact: true }),
  ).toBeVisible();
  const hold = armTransitionHold(state, api + '/concepts/' + cid(1), 'detail');
  await page.getByRole('link', { name: 'Concept 1', exact: true }).click();
  const request = await activeTransitionRequest(page, state, hold);
  await expect(
    page
      .locator('#student-main')
      .getByText('Loading concepts...', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
  state.transitionHold = null;
  const response = page.waitForResponse(
    (result) => result.request() === request,
  );
  await release({ held: [...hold.records] });
  expect((await response).status()).toBe(200);
  await expect(
    page.getByRole('tab', { name: 'Read', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Revise', exact: true }).click();
  await expect(
    page.getByText('Revision <script>plain</script> **not Markdown**', {
      exact: true,
    }),
  ).toBeVisible();
  await assertSafe(state);
});
test('incomplete student can browse Revise while dashboard stays onboarding-gated', async ({
  page,
  context,
}) => {
  const state = await mock(context);
  state.user.profile = null;
  await page.goto('/concepts/' + cid(1));
  await page.getByRole('tab', { name: 'Revise', exact: true }).click();
  await expect(
    page.getByText('Revision <script>plain</script> **not Markdown**', {
      exact: true,
    }),
  ).toBeVisible();
  await assertSafe(state);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/onboarding$/);
});
