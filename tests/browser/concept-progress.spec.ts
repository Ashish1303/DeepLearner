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
const routeFor = (id = cid) => `/concepts/${id}`;
const envelope = (data: unknown) => ({
  success: true,
  message: null,
  data,
  meta: { requestId: 'f037-browser' },
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
    activityCount: 0,
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
    if (path === '/progress') {
      state.calls++;
      const h = await request.allHeaders();
      state.credentials.push({
        bearer: h.authorization === 'Bearer synthetic-test-token',
        cookie: 'cookie' in h,
      });
      if (request.method() !== 'GET') {
        state.unexpected.push('PROGRESS_WRITE');
        await route.abort();
        return;
      }
      const conceptId = url.searchParams.get('conceptId')!,
        count = conceptId === cid ? state.activityCount : 0;
      const body = envelope({
        conceptId,
        status: count ? 'IN_PROGRESS' : 'NOT_STARTED',
        attemptCount: count,
        startedAt: count ? '2026-10-19T00:00:00.000Z' : null,
        lastActivityAt: count ? '2026-10-19T01:00:00.000Z' : null,
      });
      if (state.hold) {
        state.held.push({ route, body });
        return;
      }
      if (state.fault) {
        await send(
          {
            success: false,
            error: {
              code: 'DEPENDENCY_UNAVAILABLE',
              message: 'Synthetic safe failure',
            },
            meta: { requestId: 'f037-browser' },
          },
          503,
        );
        return;
      }
      await send(body);
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
    if (path === `/concepts/${cid}` || path === `/concepts/${other}`) {
      await send(
        envelope({
          id: path.split('/').at(-1),
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

const activity = (page: Page) =>
  page.getByRole('region', { name: 'Saved practice activity' });
async function open(page: Page, id = cid) {
  await page.goto(routeFor(id));
  await expect(activity(page)).toBeVisible();
}

test('F037 Concept activity preserves Read and Practice navigation', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  await open(page);
  await expect(
    page.getByRole('link', { name: 'Practice output questions' }),
  ).toHaveAttribute('href', '/concepts/' + cid + '/practice');
  await expect(activity(page)).toContainText('No saved attempts');
  expect(m.unexpected).toEqual([]);
});
test('F037 zero activity has no completion, score, XP or write request', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  await open(page);
  await expect(activity(page)).toContainText('No saved attempts');
  await expect(activity(page).getByRole('progressbar')).toHaveCount(0);
  await expect(
    page.getByRole('button', {
      name: /Mark complete|Start learning|Grade|Score/i,
    }),
  ).toHaveCount(0);
  expect(m.credentials.every((h) => h.bearer && !h.cookie)).toBe(true);
  expect(m.unexpected).toEqual([]);
});
test('F037 saved activity persists across remount without inventing attempts', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  m.activityCount = 3;
  await open(page);
  await expect(activity(page)).toContainText('3 saved practice attempts');
  await page.reload();
  await expect(activity(page)).toContainText('3 saved practice attempts');
  expect(m.activityCount).toBe(3);
});
test('F037 loading and scoped error Retry never fabricate zero', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  m.hold = true;
  await open(page);
  await expect(activity(page)).toContainText('Loading saved practice activity');
  await expect.poll(() => m.held.length).toBe(1);
  m.hold = false;
  await m.held.shift()!.route.fulfill({
    status: 503,
    headers,
    json: {
      success: false,
      error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Synthetic failure' },
      meta: { requestId: 'f037-browser' },
    },
  });
  await expect(activity(page)).toContainText(
    'Activity is temporarily unavailable',
  );
  await expect(activity(page)).not.toContainText('No saved attempts');
  await activity(page).getByRole('button', { name: 'Retry activity' }).click();
  await expect(activity(page)).toContainText('No saved attempts');
});
test('F037 obsolete Concept response cannot replace a different Concept', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  m.activityCount = 9;
  m.hold = true;
  await open(page);
  await expect.poll(() => m.held.length).toBe(1);
  m.hold = false;
  await open(page, other);
  await expect(activity(page)).toContainText('No saved attempts');
  for (const held of m.held.splice(0))
    await held.route.fulfill({ headers, json: held.body }).catch(() => {});
  await expect(activity(page)).not.toContainText('9 saved');
});
test('F037 account replacement removes held activity and rejects former-account data', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  m.activityCount = 8;
  m.hold = true;
  await open(page);
  await expect.poll(() => m.held.length).toBe(1);
  m.user = { ...m.user, id: '2'.repeat(24) };
  m.activityCount = 0;
  m.hold = false;
  await page.evaluate(() => {
    const channel = new BroadcastChannel('deeplearner-auth');
    channel.postMessage('identity-changed');
    channel.close();
  });
  await expect(page).toHaveURL(/\/login/);
  for (const held of m.held.splice(0))
    await held.route.fulfill({ headers, json: held.body }).catch(() => {});
  await open(page);
  await expect(activity(page)).toContainText('No saved attempts');
  await expect(activity(page)).not.toContainText('8 saved');
});
test('F037 native keyboard Retry preserves semantic times and status', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  m.fault = 503;
  await open(page);
  const retry = activity(page).getByRole('button', { name: 'Retry activity' });
  await expect(retry).toBeVisible();
  await retry.focus();
  await expect(retry).toBeFocused();
  m.fault = 0;
  m.activityCount = 1;
  await page.keyboard.press('Enter');
  await expect(activity(page)).toContainText('1 saved practice attempt.');
  await expect(activity(page).locator('time')).toHaveCount(2);
  await expect(activity(page).getByRole('status')).toContainText('In progress');
});
test('F037 desktop tablet mobile activity remains contained', async ({
  page,
  context,
}) => {
  await mock(context);
  for (const width of [1280, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    await expect(activity(page)).toContainText('No saved attempts');
    const box = await activity(page).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
});
