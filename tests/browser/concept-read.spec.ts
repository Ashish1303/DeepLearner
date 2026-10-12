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
    contentFormat: 'MARKDOWN',
    schemaVersion: 1,
    read: {
      summary: text,
      bodyMarkdown:
        '# Definition\n\nA **safe** explanation.\n\n- Item one\n- Item two\n\n```js\nconst sample = "<script>";\n```\n\n[Documentation](https://reference.invalid/docs)\n\n[Unsafe](javascript:alert%281%29)\n\n![Image description](https://image.invalid/remote.png)\n\n<script>window.f022Injected = true</script>',
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
  meta: { requestId: 'f022-browser' },
});
const list = (data: unknown[], page: number, total: number) => ({
  ...envelope(data),
  meta: {
    requestId: 'f022-browser',
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
    meta: { requestId: 'f022-browser' },
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
      } else
        body = envelope(
          detail(parseInt(path.split('/').at(-1)!, 16), requestOwner.account),
        );
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
test('Topic navigation, direct Read reload, breadcrumbs and restricted Markdown', async ({
  page,
  context,
}) => {
  const state = await mock(context);
  await page.goto(topicUrl);
  await page.getByRole('link', { name: 'Concept 1', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Concept 1' }),
  ).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Definition' })).toBeVisible();
  await expect(page.locator('#student-main h1')).toHaveCount(1);
  await expect(
    page.getByRole('link', { name: 'Unsafe', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator(
      '#student-main img, #student-main script, #student-main iframe',
    ),
  ).toHaveCount(0);
  expect(await page.evaluate(() => Object.hasOwn(window, 'f022Injected'))).toBe(
    false,
  );
  const source = page.getByRole('link', {
    name: 'Synthetic reference (opens in a new tab)',
  });
  await expect(source).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(source).toHaveAttribute('target', '_blank');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Concept 1');
  await page.getByRole('link', { name: 'Back to Synthetic topic' }).click();
  await expect(
    page.getByRole('heading', { name: 'Concepts', exact: true }),
  ).toBeVisible();
  await assertSafe(state);
});
test('Previous/Next mounted focus, empty later page and explicit recovery', async ({
  page,
  context,
}) => {
  const state = await mock(context);
  await page.goto(topicUrl);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Concept 21', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Concepts', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Concept 1', exact: true }),
  ).toBeVisible();
  state.total = 1;
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByText('The requested page has no results.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Page 2 of 1', { exact: true })).toHaveCount(0);
  const reset = page.getByRole('button', { name: 'Return to page 1' });
  await reset.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('link', { name: 'Concept 1', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Concepts', exact: true }),
  ).toBeFocused();
  await assertSafe(state);
});
for (const fault of [
  400,
  401,
  403,
  404,
  429,
  503,
  'network',
  'malformed',
] as const) {
  test(`catalog ${fault} permits explicit Retry without auth side effects`, async ({
    page,
    context,
  }) => {
    const state = await mock(context);
    await page.goto(topicUrl);
    await expect(
      page.getByRole('link', { name: 'Concept 1', exact: true }),
    ).toBeVisible();
    // Restoration and /users/me have settled before any catalog fault is armed.
    // Monotonic counters catch intermediate activity even if Retry later succeeds.
    const before = {
      refresh: state.counters.refresh,
      logout: state.counters.logout,
    };
    if (fault === 400) {
      const main = page.locator('#student-main');
      const page2Url = `${api}/concepts?topicId=${topicId}&page=2&limit=20`;
      let page2Requests = 0;
      const countRequest = (request: import('@playwright/test').Request) => {
        if (request.method() === 'GET' && request.url() === page2Url)
          page2Requests++;
      };
      const waitForPage2 = () =>
        page.waitForResponse(
          (response) =>
            response.url() === page2Url &&
            response.request().method() === 'GET',
        );
      page.on('request', countRequest);
      try {
        state.fault = 400;
        // Register before Next; observe the response, not the route announcer.
        const [failedResponse] = await Promise.all([
          waitForPage2(),
          main.getByRole('button', { name: 'Next', exact: true }).click(),
        ]);
        expect(failedResponse.status()).toBe(400);
        const error = main.getByRole('alert');
        await expect(error).toBeVisible();
        await expect(error).toHaveText(
          'The catalog request is invalid. Return to Explore technologies.',
        );
        const retry = main.getByRole('button', { name: 'Retry', exact: true });
        await expect(retry).toBeVisible();
        await expect(retry).toBeEnabled();
        await expect(
          main.getByRole('link', { name: 'Concept 21', exact: true }),
        ).toHaveCount(0);
        expect(page2Requests).toBe(1);
        expect({
          refresh: state.counters.refresh,
          logout: state.counters.logout,
        }).toEqual(before);

        // Keep the fault armed until both HTTP 400 and its actual UI are proven.
        state.fault = null;
        const [recoveredResponse] = await Promise.all([
          waitForPage2(),
          retry.click(),
        ]);
        expect(recoveredResponse.status()).toBe(200);
        await expect(
          main.getByRole('link', { name: 'Concept 21', exact: true }),
        ).toBeVisible();
        await expect(
          main.getByText('Page 2 of 2.', { exact: true }),
        ).toBeVisible();
        await expect(error).toHaveCount(0);
        expect(page2Requests).toBe(2);
        expect({
          refresh: state.counters.refresh,
          logout: state.counters.logout,
        }).toEqual(before);
        await assertSafe(state);
      } finally {
        page.off('request', countRequest);
      }
      return;
    }
    const main = page.locator('#student-main');
    const page2Url = `${api}/concepts?topicId=${topicId}&page=2&limit=20`;
    const matchesPage2 = (request: import('@playwright/test').Request) =>
      request.method() === 'GET' && request.url() === page2Url;
    let page2Requests = 0;
    const countRequest = (request: import('@playwright/test').Request) => {
      if (matchesPage2(request)) page2Requests++;
    };
    const waitForPage2 = () =>
      page.waitForResponse((response) => matchesPage2(response.request()));
    const expectedMessages = {
      401: 'The catalog request could not be completed.',
      403: 'This site is not permitted to access the catalog.',
      404: 'This content is unavailable.',
      429: 'Too many requests. Please wait before trying again.',
      503: 'The catalog is temporarily unavailable. Please try again later.',
      network:
        'The request could not be completed. Check your connection and retry.',
      malformed: 'The service returned an unexpected response.',
    };
    page.on('request', countRequest);
    try {
      state.fault = fault;
      if (fault === 'network') {
        // An aborted request has no HTTP response. Observe the exact request and
        // its transport failure; a generic alert cannot prove fault delivery.
        const [request, failed] = await Promise.all([
          page.waitForRequest(matchesPage2),
          page.waitForEvent('requestfailed', { predicate: matchesPage2 }),
          main.getByRole('button', { name: 'Next', exact: true }).click(),
        ]);
        expect(failed).toBe(request);
        expect(failed.failure()?.errorText).toBe('net::ERR_FAILED');
        expect(await failed.response()).toBeNull();
      } else {
        const [response] = await Promise.all([
          waitForPage2(),
          main.getByRole('button', { name: 'Next', exact: true }).click(),
        ]);
        expect(response.status()).toBe(fault === 'malformed' ? 200 : fault);
        if (fault === 'malformed')
          expect(await response.json()).toEqual({ success: true, data: {} });
        else expect((await response.json()).error.code).toBe('SYNTHETIC_ERROR');
      }
      const error = main.getByRole('alert');
      await expect(error).toBeVisible();
      await expect(error).toHaveText(expectedMessages[fault]);
      const retry = main.getByRole('button', { name: 'Retry', exact: true });
      await expect(retry).toBeVisible();
      await expect(retry).toBeEnabled();
      await expect(
        main.getByRole('link', { name: 'Concept 21', exact: true }),
      ).toHaveCount(0);
      expect(page2Requests).toBe(1);
      expect({
        refresh: state.counters.refresh,
        logout: state.counters.logout,
      }).toEqual(before);

      state.fault = null;
      const [response] = await Promise.all([waitForPage2(), retry.click()]);
      expect(response.status()).toBe(200);
      await expect(
        main.getByRole('link', { name: 'Concept 21', exact: true }),
      ).toBeVisible();
      await expect(
        main.getByText('Page 2 of 2.', { exact: true }),
      ).toBeVisible();
      await expect(error).toHaveCount(0);
      expect(page2Requests).toBe(2);
      expect({
        refresh: state.counters.refresh,
        logout: state.counters.logout,
      }).toEqual(before);
      await assertSafe(state);
    } finally {
      page.off('request', countRequest);
    }
  });
}
test('loading, bounded timeout and explicit Retry', async ({
  page,
  context,
}) => {
  const state = await mock(context);
  await page.goto(topicUrl);
  await expect(
    page.getByRole('link', { name: 'Concept 1', exact: true }),
  ).toBeVisible();
  const before = {
    refresh: state.counters.refresh,
    logout: state.counters.logout,
  };
  const main = page.locator('#student-main');
  const page2Url = `${api}/concepts?topicId=${topicId}&page=2&limit=20`;
  const matchesPage2 = (request: import('@playwright/test').Request) =>
    request.method() === 'GET' && request.url() === page2Url;
  let page2Requests = 0;
  const countRequest = (request: import('@playwright/test').Request) => {
    if (matchesPage2(request)) page2Requests++;
  };
  page.on('request', countRequest);
  try {
    state.fault = 'hold';
    // Both observers are registered before Next. Keep the existing 20-second
    // timeout observation bound; never release the held response to cause it.
    const [request, failed] = await Promise.all([
      page.waitForRequest(matchesPage2),
      page.waitForEvent('requestfailed', {
        predicate: matchesPage2,
        timeout: 20000,
      }),
      (async () => {
        await main.getByRole('button', { name: 'Next', exact: true }).click();
        await expect(
          main.getByText('Loading concepts...', { exact: true }),
        ).toBeVisible();
        await expect.poll(() => state.held.length).toBe(1);
        await expect(main.getByRole('alert')).toHaveText(
          'The request could not be completed. Check your connection and retry.',
          { timeout: 20000 },
        );
      })(),
    ]);
    expect(failed).toBe(request);
    expect(state.held[0]!.route.request()).toBe(request);
    expect(failed.failure()?.errorText).toBe('net::ERR_ABORTED');
    expect(await failed.response()).toBeNull();
    const error = main.getByRole('alert');
    await expect(error).toBeVisible();
    const retry = main.getByRole('button', { name: 'Retry', exact: true });
    await expect(retry).toBeVisible();
    await expect(retry).toBeEnabled();
    await expect(
      main.getByRole('link', { name: 'Concept 21', exact: true }),
    ).toHaveCount(0);
    expect(page2Requests).toBe(1);
    expect({
      refresh: state.counters.refresh,
      logout: state.counters.logout,
    }).toEqual(before);

    state.fault = null;
    const [response] = await Promise.all([
      page.waitForResponse((result) => matchesPage2(result.request())),
      retry.click(),
    ]);
    expect(response.status()).toBe(200);
    await expect(
      main.getByRole('link', { name: 'Concept 21', exact: true }),
    ).toBeVisible();
    await expect(main.getByText('Page 2 of 2.', { exact: true })).toBeVisible();
    await release(state);
    await expect(error).toHaveCount(0);
    expect(page2Requests).toBe(2);
    expect({
      refresh: state.counters.refresh,
      logout: state.counters.logout,
    }).toEqual(before);
    await assertSafe(state);
  } finally {
    page.off('request', countRequest);
  }
});
for (const mode of [
  'ADMIN',
  'DISABLED',
  'SUSPENDED',
  'PENDING_VERIFICATION',
  'UNVERIFIED',
  'INVALID',
] as const) {
  test(`${mode} cannot see Concept content`, async ({ page, context }) => {
    const state = await mock(context);
    if (mode === 'ADMIN') state.user.role = mode;
    else if (mode === 'INVALID') state.invalidSession = true;
    else if (mode === 'UNVERIFIED') state.user.emailVerified = false;
    else state.user.status = mode;
    await page.goto('/concepts/' + cid(1));
    if (mode === 'INVALID')
      await expect(page).toHaveURL(/\/login\?next=\/dashboard/);
    else
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        mode === 'ADMIN' ? 'Student area' : 'Unable to open your workspace',
      );
    expect(state.counters.catalog).toBe(0);
    await expect(page.getByText('Summary 1', { exact: true })).toHaveCount(0);
  });
}
test('incomplete student browses Concepts but dashboard still requires onboarding', async ({
  page,
  context,
}) => {
  const state = await mock(context);
  state.user.profile = null;
  await page.goto(topicUrl);
  await expect(
    page.getByRole('link', { name: 'Concept 1', exact: true }),
  ).toBeVisible();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/onboarding$/);
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
      (window as unknown as Record<string, unknown>).f022Document = marker;
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
        () => (window as unknown as Record<string, unknown>).f022Document,
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
        () => (window as unknown as Record<string, unknown>).f022Document,
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
      (window as unknown as Record<string, unknown>).f022Document = marker;
      return marker;
    });
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
    expect(state.requestStates.get(oldRequest)).toBe('cancelled');
    await releaseTransition(page, state, accountHold, lateFailure);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Student B Concept 1',
    );
    await expect(
      page.getByText('Student B Summary 1', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Student A (Concept|Summary)/)).toHaveCount(0);
    await expect(page.locator('#student-main').getByRole('alert')).toHaveCount(
      0,
    );
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>).f022Document,
      ),
    ).toBe(documentToken);
    await assertSafe(state);
  });
}

test('responsive keyboard navigation, code overflow and mobile logout failure', async ({
  page,
  context,
}) => {
  const state = await mock(context);
  await page.goto('/concepts/' + cid(1));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Concept 1');
  for (const width of [1280, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const code = page.getByRole('region', { name: 'Code block' });
    await code.focus();
    await expect(code).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: 'Documentation (opens in a new tab)' }),
    ).toBeFocused();
  }
  state.logoutFails = true;
  await page.getByRole('button', { name: 'Open student navigation' }).click();
  const dialog = page.getByRole('dialog', { name: 'Student navigation' });
  await dialog.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Concept 1');
  await assertSafe(state);
});

test('empty first page and invalid route ID never fabricate content', async ({
  page,
  context,
}) => {
  const state = await mock(context);
  state.total = 0;
  await page.goto(topicUrl);
  await expect(
    page.getByText('No published Concepts are available yet.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Concepts pagination' }),
  ).toHaveCount(0);
  const before = state.counters.catalog;
  await page.goto('/concepts/not-an-id');
  await expect(page.locator('#student-main').getByRole('alert')).toHaveText(
    'The catalog request is invalid. Return to Explore technologies.',
  );
  expect(state.counters.catalog).toBe(before);
  await assertSafe(state);
});
