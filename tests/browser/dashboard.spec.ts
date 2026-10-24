import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from '@playwright/test';
import type { DashboardData } from '../../apps/web/src/lib/dashboard/contracts';

// PREPARED ONLY. Separately approved browser execution is required. Synthetic
// HTTP fixtures cannot prove live authentication, publication or F039 authority.
const id = (n: number) => n.toString(16).padStart(24, '0');
const at = '2026-10-24T00:00:00.000Z';
const initialUser = {
  id: id(100),
  firstName: 'Synthetic',
  lastName: 'Student',
  email: 'student@example.invalid',
  emailVerified: true,
  role: 'STUDENT',
  status: 'ACTIVE',
  plan: 'FREE',
  authMethods: ['PASSWORD'],
  createdAt: at,
  profile: {
    experienceLevel: 'BEGINNER',
    learningGoals: ['LEARN_FROM_SCRATCH'],
    preferredDifficulty: 'BEGINNER',
    dailyStudyGoalMinutes: 20,
    interestedTechnologyIds: [],
  },
};
const envelope = (data: unknown) => ({
  success: true,
  data,
  message: null,
  meta: { requestId: 'f041-synthetic' },
});
const headers = {
  'Access-Control-Allow-Origin': 'http://127.0.0.1:3000',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'authorization,content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Cache-Control': 'no-store',
};
const evaluated = (
  classification: 'WEAK' | 'IMPROVING' | 'STRONG',
): DashboardData['items'][number]['mastery'] => ({
  status: 'EVALUATED',
  result: { classification, code: 'NONE' },
  unavailableCode: null,
});
async function mock(context: BrowserContext) {
  const state = {
    user: { ...initialUser },
    anonymous: false,
    total: 6,
    fault: 0,
    network: false,
    malformed: false,
    hold: false,
    longTitle: false,
    calls: [] as (string | null)[],
    held: [] as { route: Route; body: unknown }[],
    unexpected: [] as string[],
    credentials: [] as { bearer: boolean; cookie: boolean }[],
    bands: [evaluated('STRONG')] as DashboardData['items'][number]['mastery'][],
  };
  await context.route('**/*', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin === 'http://127.0.0.1:3000') {
      await route.continue();
      return;
    }
    if (url.origin !== 'http://127.0.0.1:4000') {
      state.unexpected.push('EXTERNAL_ORIGIN');
      await route.abort();
      return;
    }
    const send = (data: unknown, status = 200) =>
      route.fulfill({ status, headers, json: data });
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const path = url.pathname.slice('/api/v1'.length);
    if (path === '/auth/refresh' || path === '/auth/login') {
      await send(
        state.anonymous
          ? {
              success: false,
              error: {
                code: 'AUTH_INVALID_TOKEN',
                message: 'Sign in required.',
              },
            }
          : envelope({
              accessToken: 'synthetic-test-token',
              expiresInSeconds: 900,
            }),
        state.anonymous ? 401 : 200,
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
    if (path === '/dashboard') {
      state.calls.push(url.searchParams.get('cursor'));
      const h = await request.allHeaders();
      state.credentials.push({
        bearer: h.authorization === 'Bearer synthetic-test-token',
        cookie: 'cookie' in h,
      });
      if (
        request.method() !== 'GET' ||
        url.searchParams.get('limit') !== '5' ||
        [...url.searchParams.keys()].some(
          (key) => !['limit', 'cursor'].includes(key),
        )
      ) {
        state.unexpected.push('DASHBOARD_CONTRACT');
        await route.abort();
        return;
      }
      if (state.network) {
        await route.abort('failed');
        return;
      }
      if (state.fault) {
        await send(
          {
            success: false,
            error: {
              code: 'DEPENDENCY_UNAVAILABLE',
              message: 'PRIVATE_SERVER_DETAIL',
            },
          },
          state.fault,
        );
        return;
      }
      const start = parseInt(url.searchParams.get('cursor') ?? '0', 16) + 1;
      const count = Math.max(0, Math.min(5, state.total - start + 1));
      const data: DashboardData = {
        items: Array.from({ length: count }, (_, i) => ({
          concept: {
            id: id(start + i),
            title: state.longTitle
              ? '<script>inert</script>' + 'x'.repeat(90)
              : 'Concept ' + (start + i),
            slug: 'concept-' + (start + i),
            difficulty: 'BEGINNER',
          },
          activity: {
            conceptId: id(start + i),
            status: 'IN_PROGRESS',
            attemptCount: 2,
            startedAt: at,
            lastActivityAt: at,
          },
          mastery: state.bands[i % state.bands.length]!,
        })),
        pagination: {
          limit: 5,
          nextCursor:
            start + count - 1 < state.total ? id(start + count - 1) : null,
        },
      };
      const body = envelope(
        state.malformed
          ? { ...data, privateAnswer: 'PRIVATE_RESPONSE_FIELD' }
          : data,
      );
      if (state.hold) {
        state.held.push({ route, body });
        return;
      }
      await send(body);
      return;
    }
    // Navigation compatibility here covers the existing route/unmount only.
    if (path.startsWith('/concepts/')) {
      await send(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Unavailable.' },
        },
        404,
      );
      return;
    }
    state.unexpected.push('UNEXPECTED_API');
    await route.abort();
  });
  return state;
}
const panel = (page: Page) =>
  page.getByRole('region', { name: 'Saved Concept practice', exact: true });
async function open(page: Page) {
  await page.goto('/dashboard');
  await expect(panel(page)).toBeVisible();
}
async function release(state: Awaited<ReturnType<typeof mock>>) {
  const pending = state.held.splice(0);
  for (const held of pending) {
    // A cancelled browser request may already be gone; no acceptance is inferred.
    try {
      await held.route.fulfill({ headers, json: held.body });
    } catch {
      /* cancelled transport */
    }
  }
}
async function control(page: Page, value: 'signed-out' | 'identity-changed') {
  await page.evaluate((message) => {
    const channel = new BroadcastChannel('deeplearner-auth');
    channel.postMessage(message);
    channel.close();
  }, value);
}
test('F041-B01 authorized Student loads a self-only five-entry page', async ({
  page,
  context,
}) => {
  const s = await mock(context);
  await open(page);
  await expect(panel(page).getByRole('article')).toHaveCount(5);
  expect(s.calls).toEqual([null]);
  expect(s.credentials).toEqual([{ bearer: true, cookie: false }]);
  expect(s.unexpected).toEqual([]);
});
test('F041-B02 anonymous access redirects without a Dashboard read', async ({
  page,
  context,
}) => {
  const s = await mock(context);
  s.anonymous = true;
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  expect(s.calls).toEqual([]);
});
test('F041-B03 Admin and ineligible accounts cannot mount the panel', async ({
  page,
  context,
}) => {
  const s = await mock(context);
  for (const patch of [
    { role: 'ADMIN' },
    { role: 'STUDENT', status: 'SUSPENDED' },
    { status: 'ACTIVE', emailVerified: false },
  ]) {
    s.user = { ...initialUser, ...patch };
    await page.goto('/dashboard');
    await expect(
      page.getByRole('heading', { name: 'Saved Concept practice' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('heading', {
        name: /Student area|Unable to open your workspace/,
      }),
    ).toBeVisible();
  }
  expect(s.calls).toEqual([]);
});
test('F041-B04 genuine empty activity offers Explore without a mastery claim', async ({
  page,
  context,
}) => {
  const s = await mock(context);
  s.total = 0;
  await open(page);
  await expect(panel(page).getByRole('status')).toHaveText(
    'No saved Concept practice is available.',
  );
  await expect(
    panel(page).getByRole('link', { name: 'Explore technologies' }),
  ).toHaveAttribute('href', '/explore-technologies');
  await expect(panel(page).getByRole('article')).toHaveCount(0);
});
test('F041-B05 classification and absence variants stay distinct', async ({
  page,
  context,
}) => {
  const s = await mock(context);
  s.total = 1;
  const variants: [DashboardData['items'][number]['mastery'], string][] = [
    [evaluated('WEAK'), 'Weak'],
    [evaluated('IMPROVING'), 'Improving'],
    [evaluated('STRONG'), 'Strong'],
    ...(
      ['SCORE_MISSING', 'STALE_ASSESSMENT', 'REVOKED_ASSESSMENT'] as const
    ).map((code, i): [DashboardData['items'][number]['mastery'], string] => [
      {
        status: 'EVALUATED',
        result: { classification: 'UNCLASSIFIED', code },
        unavailableCode: null,
      },
      [
        'Unclassified — no qualifying assessment',
        'Unclassified — assessment is out of date',
        'Unclassified — assessment has been withdrawn',
      ][i]!,
    ]),
    [
      {
        status: 'UNAVAILABLE',
        result: null,
        unavailableCode: 'LOCAL_QUALIFICATION_UNAVAILABLE',
      },
      'Classification unavailable',
    ],
  ];
  await open(page);
  for (const [band, label] of variants) {
    s.bands = [band];
    await panel(page).getByRole('button', { name: 'Refresh activity' }).click();
    await expect(panel(page).getByText(label, { exact: true })).toBeVisible();
  }
  await expect(panel(page)).not.toContainText(/\d+%|XP|streak|improved since/i);
});
test('F041-B06 malformed/private response refuses rendering', async ({
  page,
  context,
}) => {
  const s = await mock(context);
  s.malformed = true;
  await open(page);
  await expect(panel(page).getByRole('alert')).toContainText(
    'could not be confirmed',
  );
  await expect(panel(page)).not.toContainText('PRIVATE_RESPONSE_FIELD');
  await expect(panel(page).getByRole('article')).toHaveCount(0);
});
test('F041-B07 network and 503 errors recover only by manual retry', async ({
  page,
  context,
}) => {
  const s = await mock(context);
  s.network = true;
  await open(page);
  await expect(panel(page).getByRole('alert')).toBeVisible();
  expect(s.calls).toHaveLength(1);
  s.network = false;
  s.fault = 503;
  await panel(page).getByRole('button', { name: 'Retry activity' }).click();
  await expect(panel(page).getByRole('alert')).toHaveText(
    'Dashboard activity is temporarily unavailable.',
  );
  s.fault = 0;
  await panel(page).getByRole('button', { name: 'Retry activity' }).click();
  await expect(panel(page).getByRole('article')).toHaveCount(5);
  expect(s.calls).toHaveLength(3);
});
test('F041-B08 rate limit has no invented countdown or automatic retry', async ({
  page,
  context,
}) => {
  const s = await mock(context);
  s.fault = 429;
  await open(page);
  await expect(panel(page).getByRole('alert')).toHaveText(
    'Too many requests. Please wait before retrying.',
  );
  await page.waitForTimeout(250);
  expect(s.calls).toHaveLength(1);
  await expect(panel(page)).not.toContainText(
    /PRIVATE_SERVER_DETAIL|Retry-After|\d+ seconds/,
  );
});
test('F041-B09 non-LOCAL 404 is unavailable rather than empty or Weak', async ({
  page,
  context,
}) => {
  const s = await mock(context);
  s.fault = 404;
  await open(page);
  await expect(panel(page).getByRole('alert')).toContainText(
    'temporarily unavailable',
  );
  await expect(panel(page)).not.toContainText(
    'No saved Concept practice is available.',
  );
  await expect(panel(page).getByText('Weak', { exact: true })).toHaveCount(0);
});
test('F041-B10 Next, first and Refresh replace bounded pages', async ({
  page,
  context,
}) => {
  const s = await mock(context);
  await open(page);
  await expect(panel(page).getByRole('article')).toHaveCount(5);
  await panel(page).getByRole('button', { name: 'Next results' }).click();
  await expect(panel(page).getByRole('article')).toHaveCount(1);
  await expect(
    panel(page).getByRole('link', { name: 'Concept 6', exact: true }),
  ).toBeVisible();
  await panel(page)
    .getByRole('button', { name: 'Back to first results' })
    .click();
  await expect(panel(page).getByRole('article')).toHaveCount(5);
  await panel(page).getByRole('button', { name: 'Next results' }).click();
  await expect(panel(page).getByRole('article')).toHaveCount(1);
  await panel(page).getByRole('button', { name: 'Refresh activity' }).click();
  await expect(panel(page).getByRole('article')).toHaveCount(5);
  expect(s.calls).toEqual([null, id(5), null, id(5), null]);
});
test('F041-B11 repeated activation while loading admits one request', async ({
  page,
  context,
}) => {
  const s = await mock(context);
  await open(page);
  await expect(panel(page).getByRole('article')).toHaveCount(5);
  s.hold = true;
  const next = panel(page).getByRole('button', { name: 'Next results' });
  await next.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => s.held.length).toBe(1);
  expect(s.calls).toHaveLength(2);
  await expect(next).toBeDisabled();
  await release(s);
  await expect(panel(page).getByRole('article')).toHaveCount(1);
});
test('F041-B12 late superseded navigation generation is never displayed', async ({
  page,
  context,
}) => {
  const s = await mock(context);
  await open(page);
  await expect(panel(page).getByRole('article')).toHaveCount(5);
  s.hold = true;
  await panel(page).getByRole('button', { name: 'Next results' }).click();
  await expect.poll(() => s.held.length).toBe(1);
  await page.goto('/explore-technologies');
  s.hold = false;
  await page.goto('/dashboard');
  await expect(panel(page).getByRole('article')).toHaveCount(5);
  await release(s);
  await expect(
    panel(page).getByRole('link', { name: 'Concept 6', exact: true }),
  ).toHaveCount(0);
});
test('F041-B13 cross-tab logout invalidation clears private activity', async ({
  page,
  context,
}) => {
  const s = await mock(context);
  await open(page);
  await expect(panel(page).getByRole('article')).toHaveCount(5);
  await control(page, 'signed-out');
  await expect(page).toHaveURL(/\/login/);
  await expect(panel(page)).toHaveCount(0);
  expect(s.calls).toHaveLength(1);
});
test('F041-B14 account change rejects a former-account held response', async ({
  page,
  context,
}) => {
  const s = await mock(context);
  await open(page);
  await expect(panel(page).getByRole('article')).toHaveCount(5);
  s.hold = true;
  await panel(page).getByRole('button', { name: 'Refresh activity' }).click();
  await expect.poll(() => s.held.length).toBe(1);
  s.user = { ...initialUser, id: id(101) };
  await control(page, 'identity-changed');
  await expect(page).toHaveURL(/\/login/);
  await release(s);
  await expect(panel(page)).toHaveCount(0);
});
test('F041-B15 Concept links use existing routes and navigation cancels the panel', async ({
  page,
  context,
}) => {
  const s = await mock(context);
  await open(page);
  const link = panel(page).getByRole('link', {
    name: 'Concept 1',
    exact: true,
  });
  await expect(link).toHaveAttribute('href', '/concepts/' + id(1));
  await link.click();
  await expect(page).toHaveURL('/concepts/' + id(1));
  await expect(panel(page)).toHaveCount(0);
  await page.goto('/dashboard');
  await expect(panel(page).getByRole('article')).toHaveCount(5);
  expect(s.calls).toHaveLength(2);
});
test('F041-B16 desktop cards fit without horizontal scrolling', async ({
  page,
  context,
}) => {
  await mock(context);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  await expect(panel(page).getByRole('article')).toHaveCount(5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test('F041-B17 tablet cards and controls remain usable', async ({
  page,
  context,
}) => {
  await mock(context);
  await page.setViewportSize({ width: 768, height: 1024 });
  await open(page);
  await expect(panel(page).getByRole('article')).toHaveCount(5);
  await panel(page)
    .getByRole('button', { name: 'Next results' })
    .scrollIntoViewIfNeeded();
  await expect(
    panel(page).getByRole('button', { name: 'Next results' }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test('F041-B18 mobile long escaped titles wrap safely', async ({
  page,
  context,
}) => {
  const s = await mock(context);
  s.longTitle = true;
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page);
  await expect(panel(page).getByRole('article')).toHaveCount(5);
  await expect(panel(page).getByRole('link').first()).toContainText(
    '<script>inert</script>',
  );
  expect(await panel(page).locator('script').count()).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test('F041-B19 keyboard activation returns focus after explicit page success', async ({
  page,
  context,
}) => {
  await mock(context);
  await open(page);
  await expect(panel(page).getByRole('article')).toHaveCount(5);
  const next = panel(page).getByRole('button', { name: 'Next results' });
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(
    panel(page).getByRole('heading', {
      name: 'Saved Concept practice',
      exact: true,
    }),
  ).toBeFocused();
  await expect(panel(page).getByRole('article')).toHaveCount(1);
});
test('F041-B20 loading, results and errors have semantic announcements', async ({
  page,
  context,
}) => {
  const s = await mock(context);
  s.hold = true;
  await open(page);
  await expect(panel(page)).toHaveAttribute('aria-busy', 'true');
  await expect(panel(page).getByRole('status')).toHaveText(
    'Loading saved Concept practice.',
  );
  await expect.poll(() => s.held.length).toBe(1);
  s.hold = false;
  await release(s);
  await expect(panel(page)).toHaveAttribute('aria-busy', 'false');
  await expect(panel(page).getByRole('status')).toContainText(
    '5 Concepts shown.',
  );
  await expect(panel(page).getByText('Strong', { exact: true })).toHaveCount(5);
  await expect(panel(page).locator('time')).toHaveCount(10);
  s.fault = 503;
  await panel(page).getByRole('button', { name: 'Refresh activity' }).click();
  await expect(panel(page).getByRole('alert')).toBeVisible();
});
