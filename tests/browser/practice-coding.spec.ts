import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from '@playwright/test';
// Separately gated mounted tests. Mocked HTTP contracts, never a live database.
const cid = 'a'.repeat(24),
  uid = '1'.repeat(24);
const routeFor = (id = cid) => `/concepts/${id}/practice`;
const envelope = (data: unknown) => ({
  success: true,
  message: null,
  data,
  meta: { requestId: 'f034-browser' },
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
      '# Predict the output\n\n[Reference](https://reference.invalid) [Unsafe](javascript:alert%281%29)\n\n![Image text](https://image.invalid/a)\n\n<script>window.f034Injected=true</script>',
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
    wrongType: false,
    requestedTypes: [] as string[],
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
      const type = url.searchParams.get('type') ?? 'OUTPUT';
      state.requestedTypes.push(type);
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
            meta: { requestId: 'f034-browser' },
          },
          state.fault,
        );
        return;
      }
      const page = Number(url.searchParams.get('page'));
      const conceptId = url.searchParams.get('conceptId')!;
      const data = Array.from(
        { length: Math.min(10, Math.max(0, state.total - (page - 1) * 10)) },
        (_, i) => ({
          ...item((page - 1) * 10 + i + 1, conceptId),
          type: state.wrongType
            ? type === 'OUTPUT'
              ? 'CODING'
              : 'OUTPUT'
            : type,
        }),
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
          requestId: 'f034-browser',
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

for (const width of [1280, 768, 390]) {
  test(
    'coding selection, keyboard focus and contained rendering at ' +
      width +
      'px',
    async ({ page, context }) => {
      await page.setViewportSize({ width, height: 900 });
      const m = await mock(context);
      await open(page);
      const output = page.getByRole('button', { name: 'Output', exact: true });
      const coding = page.getByRole('button', {
        name: 'Coding',
        exact: true,
      });
      await expect(output).toHaveAttribute('aria-pressed', 'true');
      await expect(
        page.getByRole('button', { name: 'Descriptive', exact: true }),
      ).toHaveAttribute('aria-pressed', 'false');
      await coding.focus();
      await page.keyboard.press('Enter');
      await expect(
        page.getByLabel('Your code draft for Question 1', {
          exact: true,
        }),
      ).toBeVisible();
      await expect(coding).toBeFocused();
      await expect(coding).toHaveAttribute('aria-pressed', 'true');
      expect(
        await coding.evaluate((el) => getComputedStyle(el).outlineStyle),
      ).not.toBe('none');
      expect(
        await coding.evaluate((el) => el.getBoundingClientRect().height),
      ).toBeGreaterThanOrEqual(44);
      const draft = page.getByLabel('Your code draft for Question 1', {
        exact: true,
      });
      await expect(draft).toHaveValue('');
      const authored =
        '\t  const answer = "<script>inert draft</script>";\n\n  ';
      await draft.fill(authored);
      await expect(draft).toHaveValue(authored);
      await expect(draft).toHaveAttribute('maxlength', '10000');
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const code = page.getByRole('region', {
        name: 'Question 1 code',
        exact: true,
      });
      expect(await code.locator('code').textContent()).toBe(
        item(1).starterCode,
      );
      await expect(
        code.locator('textarea, input, [contenteditable="true"]'),
      ).toHaveCount(0);
      await code.focus();
      await page.keyboard.press('ArrowRight');
      const overflow = await code.evaluate(
        (el) => el.scrollWidth > el.clientWidth,
      );
      if (overflow)
        await expect
          .poll(() => code.evaluate((el) => el.scrollLeft))
          .toBeGreaterThan(0);
      else {
        await expect(code).toBeVisible();
        const bounds = await code.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      }
      if (width === 390) expect(overflow).toBe(true);
      await expect(
        page.getByRole('article').locator('script, img'),
      ).toHaveCount(0);
      await expect(page.locator('main a[href^="javascript:"]')).toHaveCount(0);
      expect(await page.evaluate(() => 'f034Injected' in window)).toBe(false);
      const submit = page
        .getByRole('article', { name: 'Question 1', exact: true })
        .getByRole('button', {
          name: 'Submit Answer for Question 1',
          exact: true,
        });
      await expect(submit).toBeVisible();
      await expect(submit).toBeEnabled();
      await expect(
        page.getByRole('button', {
          name: /^(Run|Execute|Unlock|Reveal|Score|Grade)/i,
        }),
      ).toHaveCount(0);
      expect(m.requestedTypes).toEqual(['OUTPUT', 'CODING']);
      expect(m.external).toEqual([]);
      expect(m.unexpected).toEqual([]);
      expect(m.credentials.every((h) => h.bearer && !h.cookie)).toBe(true);
    },
  );
}
test('type round trips preserve drafts and clearing requires confirmation for all four types', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  await open(page);
  const output = page.getByLabel('Your output prediction for Question 1', {
    exact: true,
  });
  await output.fill('output draft');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Question 11', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Coding', exact: true }).click();
  const description = page.getByLabel('Your code draft for Question 1', {
    exact: true,
  });
  await description.fill('coding draft');
  await page.getByRole('button', { name: 'Descriptive', exact: true }).click();
  const descriptive = page.getByLabel(
    'Your descriptive answer for Question 1',
    { exact: true },
  );
  await descriptive.fill('descriptive draft');
  await page.getByRole('button', { name: 'Scenario', exact: true }).click();
  const scenario = page.getByLabel('Your scenario answer for Question 1', {
    exact: true,
  });
  await scenario.fill('scenario draft');
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await expect(output).toHaveValue('output draft');
  await page.getByRole('button', { name: 'Coding', exact: true }).click();
  await expect(description).toHaveValue('coding draft');
  const calls = m.calls;
  await page
    .getByRole('button', { name: 'Clear all drafts', exact: true })
    .click();
  await expect(description).toHaveValue('coding draft');
  await page.getByRole('button', { name: 'Keep drafts', exact: true }).click();
  await expect(description).toHaveValue('coding draft');
  await page
    .getByRole('button', { name: 'Clear all drafts', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm clear all drafts', exact: true })
    .click();
  await expect(description).toHaveValue('');
  await expect(
    page.getByRole('button', { name: 'Clear all drafts', exact: true }),
  ).toBeFocused();
  expect(m.calls).toBe(calls);
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await expect(output).toHaveValue('');
  await page.getByRole('button', { name: 'Descriptive', exact: true }).click();
  await expect(descriptive).toHaveValue('');
  await page.getByRole('button', { name: 'Scenario', exact: true }).click();
  await expect(scenario).toHaveValue('');
  await page.getByRole('button', { name: 'Coding', exact: true }).click();
  const bound = '\t' + ' '.repeat(9998) + '\n';
  await description.fill(bound);
  await description.press('Control+End');
  await page.keyboard.insertText('x');
  await expect(description).toHaveValue(bound);
  await page
    .getByRole('button', { name: 'Clear draft for Question 1', exact: true })
    .click();
  await expect(description).toHaveValue('');
  await description.fill('preserve after stale confirmation');
  await page
    .getByRole('button', { name: 'Clear all drafts', exact: true })
    .click();
  await page.getByRole('button', { name: 'Scenario', exact: true }).click();
  await expect(
    page.getByRole('group', { name: 'Confirm clearing drafts' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Coding', exact: true }).click();
  await expect(description).toHaveValue('preserve after stale confirmation');
  expect(m.unexpected).toEqual([]);
});
test('coding loading, empty, error Retry and wrong-type payload fail safely', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  await open(page);
  m.fault = 503;
  await page.getByRole('button', { name: 'Coding', exact: true }).click();
  const region = page.getByRole('region', {
    name: 'Coding questions',
    exact: true,
  });
  await expect(region.getByRole('alert')).toBeVisible();
  m.fault = 0;
  m.total = 0;
  await region.getByRole('button', { name: 'Retry' }).click();
  await expect(region).toContainText('No published CODING');
  m.total = 11;
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await expect(
    page.getByLabel('Your output prediction for Question 1', { exact: true }),
  ).toBeVisible();
  m.wrongType = true;
  await page.getByRole('button', { name: 'Coding', exact: true }).click();
  await expect(region.getByRole('alert')).toBeVisible();
  await expect(region.locator('textarea')).toHaveCount(0);
  m.wrongType = false;
  m.malformed = true;
  await region.getByRole('button', { name: 'Retry' }).click();
  await expect(region.getByRole('alert')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('NEVER_RENDER_SENTINEL');
});
test('obsolete coding success or error cannot replace OUTPUT or its draft', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  await open(page);
  const draft = page.getByLabel('Your output prediction for Question 1', {
    exact: true,
  });
  await draft.fill('keep output');
  for (const fail of [false, true]) {
    m.hold = true;
    await page.getByRole('button', { name: 'Coding', exact: true }).click();
    await expect.poll(() => m.held.length).toBe(1);
    await expect(
      page.getByRole('region', { name: 'Coding questions', exact: true }),
    ).toHaveAttribute('aria-busy', 'true');
    m.hold = false;
    await page.getByRole('button', { name: 'Output', exact: true }).click();
    await expect(draft).toHaveValue('keep output');
    for (const held of m.held.splice(0))
      await held.route
        .fulfill(
          fail
            ? {
                status: 503,
                headers,
                json: {
                  success: false,
                  error: {
                    code: 'DEPENDENCY_UNAVAILABLE',
                    message: 'Obsolete failure',
                  },
                  meta: { requestId: 'f034-browser' },
                },
              }
            : { headers, json: held.body },
        )
        .catch(() => {}); // Canceled requests may already be gone.
    await expect(draft).toHaveValue('keep output');
    await expect(
      page.getByRole('button', { name: 'Output', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
  }
});

test('account identity replacement and Concept navigation erase all four type stores and confirmation', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  await open(page);
  await page
    .getByLabel('Your output prediction for Question 1', { exact: true })
    .fill('old output');
  await page.getByRole('button', { name: 'Coding', exact: true }).click();
  await page
    .getByLabel('Your code draft for Question 1', { exact: true })
    .fill('old description');
  await page.getByRole('button', { name: 'Descriptive', exact: true }).click();
  await page
    .getByLabel('Your descriptive answer for Question 1', { exact: true })
    .fill('old descriptive');
  await page.getByRole('button', { name: 'Scenario', exact: true }).click();
  await page
    .getByLabel('Your scenario answer for Question 1', { exact: true })
    .fill('old scenario');
  await page
    .getByRole('button', { name: 'Clear all drafts', exact: true })
    .click();
  m.user = { ...m.user, id: '2'.repeat(24) };
  await page.evaluate(() => {
    const channel = new BroadcastChannel('deeplearner-auth');
    channel.postMessage('identity-changed');
    channel.close();
  });
  await expect(page).toHaveURL(/\/login/);
  await open(page);
  await expect(
    page.getByRole('group', { name: 'Confirm clearing drafts' }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel('Your output prediction for Question 1', { exact: true }),
  ).toHaveValue('');
  await page.getByRole('button', { name: 'Coding', exact: true }).click();
  await expect(
    page.getByLabel('Your code draft for Question 1', { exact: true }),
  ).toHaveValue('');
  await page.getByRole('button', { name: 'Descriptive', exact: true }).click();
  await expect(
    page.getByLabel('Your descriptive answer for Question 1', { exact: true }),
  ).toHaveValue('');
  await page.getByRole('button', { name: 'Scenario', exact: true }).click();
  await expect(
    page.getByLabel('Your scenario answer for Question 1', { exact: true }),
  ).toHaveValue('');
  await page.getByRole('button', { name: 'Coding', exact: true }).click();
  await page
    .getByLabel('Your code draft for Question 1', { exact: true })
    .fill('new Concept draft');
  await page.goto(routeFor('b'.repeat(24)));
  await expect(
    page.getByLabel('Your output prediction for Question 1', { exact: true }),
  ).toHaveValue('');
  await page.getByRole('button', { name: 'Coding', exact: true }).click();
  await expect(
    page.getByLabel('Your code draft for Question 1', { exact: true }),
  ).toHaveValue('');
  await page.getByRole('button', { name: 'Descriptive', exact: true }).click();
  await expect(
    page.getByLabel('Your descriptive answer for Question 1', { exact: true }),
  ).toHaveValue('');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(m.unexpected).toEqual([]);
});
