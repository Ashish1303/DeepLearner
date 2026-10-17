import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from '@playwright/test';
// Separately gated mounted tests. Mocked HTTP contracts, never a live database.
const cid = 'a'.repeat(24),
  other = 'b'.repeat(24),
  uid = '1'.repeat(24);
const routeFor = (id = cid) => `/concepts/${id}/practice`;
const envelope = (data: unknown) => ({
  success: true,
  message: null,
  data,
  meta: { requestId: 'f031-browser' },
});
const headers = {
  'Access-Control-Allow-Origin': 'http://127.0.0.1:3000',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'authorization,content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Cache-Control': 'no-store',
};
const initialUser = {
  id: uid,
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
function item(index: number, conceptId = cid) {
  return {
    id: index.toString(16).padStart(24, '0'),
    conceptId,
    type: 'OUTPUT',
    difficulty: 'BEGINNER',
    prompt:
      '# Predict the output\n\n[Reference](https://reference.invalid) [Unsafe](javascript:alert%281%29)\n\n![Image text](https://image.invalid/a)\n\n<script>window.f031Injected=true</script>',
    starterCode:
      '  const teaching = "<script>inert</script>";\nconsole.log("' +
      'x'.repeat(240) +
      '");\n',
    language: 'JAVASCRIPT',
  };
}
async function mock(context: BrowserContext) {
  const state = {
    user: { ...initialUser },
    total: 11,
    fault: 0,
    malformed: false,
    hold: false,
    held: [] as { route: Route; body: unknown }[],
    calls: 0,
    external: [] as string[],
    unexpected: [] as string[],
    credentials: [] as { bearer: boolean; cookie: boolean }[],
  };
  await context.route('**/*', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin === 'http://127.0.0.1:3000') {
      await route.continue();
      return;
    }
    if (url.origin !== 'http://127.0.0.1:4000') {
      state.external.push(url.origin);
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
    if (path === '/auth/refresh' || path === '/auth/login') {
      await send(
        envelope({
          accessToken: 'synthetic-test-token',
          expiresInSeconds: 900,
        }),
      );
      return;
    }
    if (path === '/auth/logout') {
      await send(envelope(null));
      return;
    }
    if (path === '/users/me') {
      await send(envelope(state.user));
      return;
    }
    if (path === '/practice-questions' && request.method() === 'GET') {
      state.calls++;
      const h = await request.allHeaders();
      state.credentials.push({
        bearer: h.authorization === 'Bearer synthetic-test-token',
        cookie: 'cookie' in h,
      });
      if (state.fault) {
        await send(
          {
            success: false,
            error: {
              code:
                state.fault === 401
                  ? 'AUTH_ACCESS_TOKEN_EXPIRED'
                  : state.fault === 403
                    ? 'AUTH_ACCOUNT_DISABLED'
                    : 'DEPENDENCY_UNAVAILABLE',
              message: 'Synthetic safe failure',
            },
            meta: { requestId: 'f031-browser' },
          },
          state.fault,
        );
        return;
      }
      const page = Number(url.searchParams.get('page'));
      const conceptId = url.searchParams.get('conceptId')!;
      const data = Array.from(
        { length: Math.min(10, Math.max(0, state.total - (page - 1) * 10)) },
        (_, i) => item((page - 1) * 10 + i + 1, conceptId),
      );
      const body = {
        ...envelope(
          state.malformed
            ? data.map((value) => ({
                ...value,
                answer: 'NEVER_RENDER_SENTINEL',
              }))
            : data,
        ),
        meta: {
          requestId: 'f031-browser',
          page,
          limit: 10,
          total: state.total,
          totalPages: Math.ceil(state.total / 10),
        },
      };
      if (state.hold) {
        state.held.push({ route, body });
        return;
      }
      await send(body);
      return;
    }
    // Existing Concept link navigation uses the unchanged catalog contracts.
    const tech = 'c'.repeat(24),
      pathId = 'd'.repeat(24),
      moduleId = 'e'.repeat(24),
      topicId = 'f'.repeat(24);
    const base = {
      title: 'Synthetic',
      slug: 'synthetic',
      description: null,
      order: 0,
      technologyId: tech,
      learningPathId: pathId,
      moduleId,
    };
    if (path === `/concepts/${cid}`) {
      await send(
        envelope({
          id: cid,
          technologyId: tech,
          learningPathId: pathId,
          moduleId,
          topicId,
          title: 'Concept',
          slug: 'concept',
          difficulty: 'BEGINNER',
          order: 0,
          contentFormat: 'MARKDOWN',
          schemaVersion: 1,
          read: { summary: 'Summary', bodyMarkdown: 'Read' },
          examples: [],
          revise: null,
          source: {
            label: 'Reference',
            url: 'https://reference.invalid',
            sourceType: 'OFFICIAL_OR_TRUSTED',
            isOfficial: false,
          },
        }),
      );
      return;
    }
    if (path === `/topics/${topicId}`) {
      await send(envelope({ ...base, id: topicId }));
      return;
    }
    if (path === `/modules/${moduleId}`) {
      await send(envelope({ ...base, id: moduleId }));
      return;
    }
    if (path === `/learning-paths/${pathId}`) {
      await send(
        envelope({
          ...base,
          id: pathId,
          targetLevel: null,
          completionScore: 70,
        }),
      );
      return;
    }
    if (path === `/technologies/${tech}`) {
      await send(
        envelope({
          id: tech,
          name: 'Technology',
          slug: 'technology',
          description: null,
          iconAssetId: null,
          order: 0,
        }),
      );
      return;
    }
    state.unexpected.push(path);
    await route.abort();
  });
  return state;
}
async function open(page: Page) {
  await page.goto(routeFor());
  await expect(
    page.getByRole('heading', { name: 'Question 1', exact: true }),
  ).toBeVisible();
}
async function navigate(
  page: Page,
  url: string,
  click: () => Promise<unknown>,
) {
  const response = page.waitForResponse(
    (response) => {
      const target = new URL(response.url());
      return (
        target.pathname === url &&
        target.searchParams.has('_rsc') &&
        response.request().method() === 'GET'
      );
    },
    { timeout: 10000 },
  );
  await click();
  expect((await response).ok()).toBeTruthy();
}
test('Concept link opens protected output practice without changing mode tabs', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  await page.goto('/concepts/' + cid);
  await expect(
    page.getByRole('tab', { name: 'Read', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await navigate(page, routeFor(), () =>
    page.getByRole('link', { name: 'Practice output questions' }).click(),
  );
  await expect(
    page.getByRole('heading', { name: 'Question 1', exact: true }),
  ).toBeVisible();
  expect(m.calls).toBe(1);
});
for (const width of [1280, 768, 390])
  test(`output practice keyboard, focus and contained code at ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const m = await mock(context);
    await open(page);
    const heading = page.getByRole('heading', {
      name: 'Output practice',
      exact: true,
    });
    await expect(heading).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: /Reference/ }).first(),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    const code = page.getByRole('region', {
      name: 'Question 1 code',
      exact: true,
    });
    await expect(code).toBeFocused();
    expect(
      await code.evaluate((el) => getComputedStyle(el).outlineStyle),
    ).not.toBe('none');
    expect(await code.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
      true,
    );
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(() => code.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
    await page.keyboard.press('Tab');
    const draft = page.getByLabel('Your output prediction for Question 1', {
      exact: true,
    });
    await expect(draft).toBeFocused();
    await draft.fill('  prediction\n');
    await expect(draft).toHaveValue('  prediction\n');
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    expect(m.external).toEqual([]);
    expect(m.unexpected).toEqual([]);
    expect(m.credentials.every((value) => value.bearer && !value.cookie)).toBe(
      true,
    );
  });
test('pagination retains drafts and local clearing sends no writes or extra API reads', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  await open(page);
  const draft = page.getByLabel('Your output prediction for Question 1', {
    exact: true,
  });
  await draft.fill('draft');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Question 11', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(draft).toHaveValue('draft');
  await page
    .getByRole('button', { name: 'Clear draft for Question 1', exact: true })
    .click();
  await expect(draft).toHaveValue('');
  expect(m.calls).toBe(3);
  expect(m.unexpected).toEqual([]);
});
test('prompt Markdown and starter code remain inert with no answer leakage or external fetches', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  await open(page);
  await expect(page.getByRole('article').locator('script, img')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: /Reference/ }).first(),
  ).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.locator('main a[href^="javascript:"]')).toHaveCount(0);
  expect(
    await page.evaluate(() => Reflect.get(window, 'f031Injected')),
  ).toBeUndefined();
  await expect(
    page.getByRole('region', { name: 'Question 1 code', exact: true }),
  ).toContainText('<script>inert</script>');
  expect(m.external).toEqual([]);
  await expect(
    page.getByRole('button', { name: /submit|unlock|score/i }),
  ).toHaveCount(0);
});
test('loading, failure and explicit Retry recover without implicit retries', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  m.hold = true;
  await page.goto(routeFor());
  await expect(
    page.getByRole('status').filter({ hasText: 'Loading output questions' }),
  ).toBeVisible();
  await expect.poll(() => m.held.length).toBe(1);
  await m.held[0]!.route.fulfill({
    status: 503,
    headers,
    json: {
      success: false,
      error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Unavailable' },
      meta: { requestId: 'test' },
    },
  });
  await expect(
    page
      .getByRole('region', { name: 'Output questions', exact: true })
      .getByRole('alert'),
  ).toBeVisible();
  expect(m.calls).toBe(1);
  m.hold = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Question 1', exact: true }),
  ).toBeVisible();
  expect(m.calls).toBe(2);
});
test('empty published result and malformed secret-bearing DTO fail truthfully', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  m.total = 0;
  await page.goto(routeFor());
  await expect(
    page.getByText('No published OUTPUT questions are available yet.'),
  ).toBeVisible();
  m.total = 1;
  m.malformed = true;
  await page.reload();
  await expect(
    page
      .getByRole('region', { name: 'Output questions', exact: true })
      .getByRole('alert'),
  ).toBeVisible();
  await expect(page.getByText('NEVER_RENDER_SENTINEL')).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
});
for (const status of [401, 403])
  test(`practice ${status} removes protected content`, async ({
    page,
    context,
  }) => {
    const m = await mock(context);
    m.fault = status;
    await page.goto(routeFor());
    if (status === 401) await expect(page).toHaveURL(/\/login/);
    else
      await expect(
        page.getByRole('heading', { name: 'Unable to open your workspace' }),
      ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Question 1', exact: true }),
    ).toHaveCount(0);
    expect(m.calls).toBe(1);
  });
test('ADMIN cannot mount practice or make a protected question read', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  m.user.role = 'ADMIN';
  await page.goto(routeFor());
  await expect(
    page.getByRole('heading', { name: 'Student area' }),
  ).toBeVisible();
  expect(m.calls).toBe(0);
});
test('Concept change cancels old work and never carries a draft into another Concept', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  await open(page);
  await page
    .getByLabel('Your output prediction for Question 1', { exact: true })
    .fill('old Concept');
  m.hold = true;
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect.poll(() => m.held.length).toBe(1);
  m.hold = false;
  await page.goto(routeFor(other));
  await expect(
    page.getByLabel('Your output prediction for Question 1', { exact: true }),
  ).toHaveValue('');
  await m.held[0]!.route.fulfill({
    status: 200,
    headers,
    json: m.held[0]!.body,
  }).catch(() => {});
  await expect(
    page.getByRole('heading', { name: 'Question 11', exact: true }),
  ).toHaveCount(0);
});
test('account change removes drafts and suppresses a delayed response', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  await open(page);
  await page
    .getByLabel('Your output prediction for Question 1', { exact: true })
    .fill('old account');
  m.hold = true;
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect.poll(() => m.held.length).toBe(1);
  m.user = { ...m.user, id: '2'.repeat(24), firstName: 'Replacement' };
  m.hold = false;
  await page.evaluate(() => {
    const channel = new BroadcastChannel('deeplearner-auth');
    channel.postMessage('identity-changed');
    channel.close();
  });
  await expect(page).toHaveURL(/\/login/);
  await m.held[0]!.route.fulfill({
    status: 200,
    headers,
    json: m.held[0]!.body,
  }).catch(() => {});
  await page.goto(routeFor());
  await expect(
    page.getByLabel('Your output prediction for Question 1', { exact: true }),
  ).toHaveValue('');
  await expect(
    page.getByRole('heading', { name: 'Question 11', exact: true }),
  ).toHaveCount(0);
});
test('logout clears drafts and reload does not persist them', async ({
  page,
  context,
}) => {
  await mock(context);
  await open(page);
  await page
    .getByLabel('Your output prediction for Question 1', { exact: true })
    .fill('temporary draft');
  await page.reload();
  await expect(
    page.getByLabel('Your output prediction for Question 1', { exact: true }),
  ).toHaveValue('');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByRole('heading', { name: 'Question 1', exact: true }),
  ).toHaveCount(0);
});
