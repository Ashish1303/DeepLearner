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
  meta: { requestId: 'f035-browser' },
});
const headers = {
  'Access-Control-Allow-Origin': 'http://127.0.0.1:3000',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'authorization,content-type,idempotency-key',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Cache-Control': 'no-store',
};
const receipt = (number: number) => ({
  id: number.toString(16).padStart(24, '0'),
  attemptNumber: number,
  result: 'SUBMITTED',
  submittedAt: '2026-10-18T00:00:00.000Z',
});
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
      '# Predict the output\n\n[Reference](https://reference.invalid) [Unsafe](javascript:alert%281%29)\n\n![Image text](https://image.invalid/a)\n\n<script>window.f035Injected=true</script>',
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
    saved: new Map<string, { body: string; result: unknown }>(),
    savedCount: 0,
    loseAfterSave: false,
    total: 11,
    unlockCalls: [] as {
      questionId: string;
      conceptId: string;
      studentAnswer: string;
      bearer: boolean;
      cookie: boolean;
      key: string;
    }[],
    unlockFault: 0,
    unlockHold: false,
    unlockHeld: [] as { route: Route; body: unknown }[],
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
    if (
      /^\/practice-questions\/[a-f0-9]{24}\/unlock$/.test(path) &&
      request.method() === 'POST'
    ) {
      const body = request.postDataJSON() as {
        conceptId: string;
        studentAnswer: string;
        questionRevision: string;
      };
      const h = await request.allHeaders(),
        questionId = path.split('/')[2]!;
      state.unlockCalls.push({
        questionId,
        ...body,
        bearer: h.authorization === 'Bearer synthetic-test-token',
        cookie: 'cookie' in h,
        key: h['idempotency-key'] ?? '',
      });
      const identity = state.user.id + ':' + h['idempotency-key'];
      const previous = state.saved.get(identity);
      if (previous && previous.body !== JSON.stringify(body)) {
        await send(
          {
            success: false,
            error: {
              code: 'PRACTICE_IDEMPOTENCY_CONFLICT',
              message: 'PRIVATE',
            },
            meta: { requestId: 'test' },
          },
          409,
        );
        return;
      }
      if (state.unlockFault) {
        await send(
          {
            success: false,
            error: {
              code:
                state.unlockFault === 403
                  ? 'AUTH_FORBIDDEN'
                  : state.unlockFault === 401
                    ? 'AUTH_ACCESS_TOKEN_EXPIRED'
                    : 'DEPENDENCY_UNAVAILABLE',
              message: 'DO_NOT_RENDER_ERROR_SENTINEL',
            },
            meta: { requestId: 'f035-browser' },
          },
          state.unlockFault,
        );
        return;
      }
      const data = envelope({
        id: questionId,
        conceptId: body.conceptId,
        type: state.requestedTypes.at(-1) ?? 'OUTPUT',
        answer:
          'Official ANSWER_SENTINEL\n\n<script>window.f035Executed=true</script>\n\n[Bad](javascript:alert%281%29)',
        explanation:
          'Explanation EXPLANATION_SENTINEL\n\n![bad](https://image.invalid)',
      });
      const result = previous?.result ?? {
        ...data,
        meta: {
          requestId: 'f035-browser',
          attempt: receipt(++state.savedCount),
        },
      };
      if (!previous)
        state.saved.set(identity, { body: JSON.stringify(body), result });
      if (state.loseAfterSave) {
        state.loseAfterSave = false;
        await route.abort();
        return;
      }
      if (state.unlockHold) {
        state.unlockHeld.push({ route, body: result });
        return;
      }
      await send(result);
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
            meta: { requestId: 'f035-browser' },
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
          requestId: 'f035-browser',
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

const question = (page: Page, number = 1) =>
  page.getByRole('article', { name: 'Question ' + number, exact: true });
const submit = (page: Page, number = 1) =>
  question(page, number).getByRole('button', {
    name: new RegExp(
      '^(Submit Answer|Submit another attempt|Retry answer submission) for Question ' +
        number +
        '$',
    ),
  });
const revealed = (page: Page, number = 1) =>
  page.getByRole('region', {
    name: 'Revealed answer for Question ' + number,
    exact: true,
  });
const disclaimer =
  'Answer revealed. This attempt has been saved but has not been graded.';

test('F035 desktop all four types require submission before transient five-field reveal', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  await open(page);
  for (const label of ['Output', 'Descriptive', 'Scenario', 'Coding']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    const draft = question(page).getByRole('textbox');
    await expect(draft).toHaveValue('');
    await expect(submit(page)).toBeDisabled();
    await expect(page.locator('body')).not.toContainText('ANSWER_SENTINEL');
    await draft.fill('\t answer ' + label + '\n ');
    await submit(page).click();
    await expect(revealed(page)).toContainText(disclaimer);
    await expect(revealed(page)).toContainText('ANSWER_SENTINEL');
    await expect(revealed(page)).toContainText('EXPLANATION_SENTINEL');
    await expect(submit(page)).toBeFocused();
    await expect(revealed(page).locator('script,img')).toHaveCount(0);
  }
  expect(m.unlockCalls).toHaveLength(4);
  expect(m.unlockCalls.every((x) => x.bearer && !x.cookie)).toBe(true);
  expect(m.external).toEqual([]);
  expect(m.unexpected).toEqual([]);
});
test('F035 tablet/mobile native keyboard submission and contained inert answers', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    await question(page)
      .getByRole('textbox')
      .fill('  ' + 'x'.repeat(600) + '\n');
    await submit(page).focus();
    expect(
      await submit(page).evaluate((el) => getComputedStyle(el).outlineStyle),
    ).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(revealed(page)).toContainText(disclaimer);
    await expect(submit(page)).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await expect(
      revealed(page).getByRole('region', {
        name: 'Your submitted answer for Question 1',
      }),
    ).toContainText('x'.repeat(600));
  }
  expect(m.external).toEqual([]);
});
test('F035 blank drafts never submit and rejected requests do not reveal sensitive errors', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  await open(page);
  await question(page).getByRole('textbox').fill(' \t\n');
  await expect(submit(page)).toBeDisabled();
  expect(m.unlockCalls).toHaveLength(0);
  const draft = question(page).getByRole('textbox');
  await expect(draft).toHaveAttribute('maxlength', '10000');
  await draft.fill('valid');
  for (const fault of [403, 503]) {
    m.unlockFault = fault;
    await submit(page).click();
    await expect(question(page).getByRole('alert')).toBeVisible();
    await expect(revealed(page)).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(
      'DO_NOT_RENDER_ERROR_SENTINEL',
    );
  }
  m.unlockFault = 401;
  await submit(page).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(revealed(page)).toHaveCount(0);
  expect(m.unlockCalls).toHaveLength(3);
  expect(m.unexpected).toEqual([]);
});
test('F035 account Concept type and question navigation clear reveals and isolate drafts', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  await open(page);
  await question(page).getByRole('textbox').fill('first');
  await submit(page).click();
  await expect(revealed(page)).toBeVisible();
  await question(page, 2).getByRole('textbox').fill('second');
  await submit(page, 2).click();
  await expect(revealed(page, 2)).toBeVisible();
  await expect(revealed(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Coding', exact: true }).click();
  await expect(revealed(page, 2)).toHaveCount(0);
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await expect(question(page).getByRole('textbox')).toHaveValue('first');
  await expect(revealed(page)).toHaveCount(0);
  await page.goto(routeFor('b'.repeat(24)));
  await expect(question(page).getByRole('textbox')).toHaveValue('');
  await expect(revealed(page)).toHaveCount(0);
  m.user = { ...m.user, id: '2'.repeat(24) };
  await page.evaluate(() => {
    const channel = new BroadcastChannel('deeplearner-auth');
    channel.postMessage('identity-changed');
    channel.close();
  });
  await expect(page).toHaveURL(/\/login/);
  await open(page);
  await expect(question(page).getByRole('textbox')).toHaveValue('');
  await expect(revealed(page)).toHaveCount(0);
});
test('F035 edited and superseded submissions ignore held success and preserve current draft', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  await open(page);
  m.unlockHold = true;
  await question(page).getByRole('textbox').fill('old');
  await submit(page).click();
  await expect.poll(() => m.unlockHeld.length).toBe(1);
  await expect(question(page).getByRole('status')).toContainText('Revealing');
  await expect(submit(page)).toBeDisabled();
  await question(page).getByRole('textbox').fill('new');
  m.unlockHold = false;
  for (const held of m.unlockHeld.splice(0))
    await held.route.fulfill({ headers, json: held.body }).catch(() => {});
  await expect(revealed(page)).toHaveCount(0);
  await expect(question(page).getByRole('textbox')).toHaveValue('new');
  await submit(page).click();
  await expect(revealed(page)).toBeVisible();
  m.unlockHold = true;
  await submit(page).click();
  await expect.poll(() => m.unlockHeld.length).toBe(1);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Question 11', exact: true }),
  ).toBeVisible();
  for (const held of m.unlockHeld.splice(0))
    await held.route
      .fulfill({
        status: 503,
        headers,
        json: {
          success: false,
          error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'OLD' },
          meta: { requestId: 'test' },
        },
      })
      .catch(() => {});
  await expect(page.locator('body')).not.toContainText('ANSWER_SENTINEL');
  await expect(page.locator('body')).not.toContainText('OLD');
});
test('F035 confirmed clearing removes reveal while cancel and stale confirmation preserve drafts', async ({
  page,
  context,
}) => {
  await mock(context);
  await open(page);
  await question(page).getByRole('textbox').fill('keep');
  await submit(page).click();
  await expect(revealed(page)).toBeVisible();
  await page
    .getByRole('button', { name: 'Clear all drafts', exact: true })
    .click();
  await page.getByRole('button', { name: 'Keep drafts', exact: true }).click();
  await expect(revealed(page)).toBeVisible();
  await page
    .getByRole('button', { name: 'Clear all drafts', exact: true })
    .click();
  await question(page).getByRole('textbox').fill('edited');
  await expect(
    page.getByRole('button', { name: 'Confirm clear all drafts', exact: true }),
  ).toHaveCount(0);
  await submit(page).click();
  await expect(revealed(page)).toBeVisible();
  await page
    .getByRole('button', { name: 'Clear all drafts', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm clear all drafts', exact: true })
    .click();
  await expect(question(page).getByRole('textbox')).toHaveValue('');
  await expect(revealed(page)).toHaveCount(0);
});
test('F035 explicit retry safe Markdown and unchanged GET secrecy never add grading or execution', async ({
  page,
  context,
}) => {
  const m = await mock(context);
  await open(page);
  m.unlockFault = 503;
  await question(page).getByRole('textbox').fill('<script>inert</script>');
  await submit(page).click();
  await expect(question(page).getByRole('alert')).toBeVisible();
  m.unlockFault = 0;
  await question(page)
    .getByRole('button', {
      name: 'Retry answer submission for Question 1',
      exact: true,
    })
    .click();
  await expect(revealed(page)).toBeVisible();
  await expect(
    revealed(page).locator('script,img,a[href^="javascript:"]'),
  ).toHaveCount(0);
  expect(await page.evaluate(() => 'f035Executed' in window)).toBe(false);
  await expect(
    page.getByRole('button', {
      name: /^(Run|Execute|Grade|Score|Unlock|Reveal)/i,
    }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Question 11', exact: true }),
  ).toBeVisible();
  await expect(page.locator('body')).not.toContainText('ANSWER_SENTINEL');
  expect(m.unlockCalls).toHaveLength(2);
  expect(m.external).toEqual([]);
  expect(m.unexpected).toEqual([]);
});
