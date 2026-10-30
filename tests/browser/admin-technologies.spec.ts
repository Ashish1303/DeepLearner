import {
  expect,
  test as base,
  type BrowserContext,
  type Page,
  type Route,
} from '@playwright/test';
import type { Technology } from '../../apps/admin/src/lib/technologies/contracts';

// PREPARED ONLY: F043-B01–B20 NOT_RUN. Separate qualified-browser approval required.
// Synthetic HTTP responses verify UI contracts only, never live API/MongoDB behavior.
// Existing Admin runtime must already be available; this spec starts no services.
const APP = 'http://localhost:5173',
  API = 'http://localhost:4000';
const record: Technology = {
  id: 'a'.repeat(24),
  name: 'TypeScript',
  slug: 'typescript',
  description: 'A synthetic draft',
  iconAssetId: null,
  status: 'DRAFT',
  order: 0,
  revision: 0,
  createdAt: '2026-10-30T00:00:00.000Z',
  updatedAt: '2026-10-30T00:00:00.000Z',
};
const user = {
  id: 'b'.repeat(24),
  firstName: 'Fixture',
  lastName: 'Admin',
  email: 'fixture@example.test',
  role: 'ADMIN',
  status: 'ACTIVE',
  emailVerified: true,
  plan: 'FREE',
  authMethods: ['PASSWORD'],
  profile: null,
  createdAt: '2026-10-30T00:00:00.000Z',
};
const envelope = (data: unknown, meta = {}) => ({
  success: true,
  data,
  message: null,
  meta: { requestId: 'f043-synthetic', ...meta },
});
const failure = (code: string) => ({
  success: false,
  error: { code, message: 'SYNTHETIC_PRIVATE_NOT_FOR_UI' },
  meta: { requestId: 'f043-synthetic' },
});
const headers = {
  'Access-Control-Allow-Origin': APP,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'authorization,content-type',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Cache-Control': 'no-store',
};
async function mock(context: BrowserContext) {
  const state = {
    rows: [{ ...record }],
    total: 1,
    fault: 0,
    network: false,
    malformed: false,
    hold: false,
    mutations: 0,
    held: [] as { route: Route; body: unknown }[],
    unexpected: [] as string[],
  };
  await context.route('**/*', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin === APP) {
      await route.continue();
      return;
    }
    if (url.origin !== API || !url.pathname.startsWith('/api/v1/')) {
      state.unexpected.push('UNAPPROVED_NETWORK');
      await route.abort();
      return;
    }
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const path = url.pathname.slice('/api/v1'.length),
      method = request.method();
    const send = (body: unknown, status = 200) =>
      route.fulfill({ status, headers, json: body });
    if (
      ['/auth/login', '/auth/refresh', '/auth/logout'].includes(path) &&
      method === 'POST'
    ) {
      const access = { accessToken: 'synthetic-access', expiresInSeconds: 900 };
      const loginUser = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: 'ACTIVE',
        plan: user.plan,
      };
      await send(
        envelope(
          path === '/auth/logout'
            ? null
            : path === '/auth/login'
              ? { ...access, user: loginUser }
              : access,
        ),
      );
      return;
    }
    const h = await request.allHeaders();
    if (h.authorization !== 'Bearer synthetic-access' || 'cookie' in h) {
      state.unexpected.push('CREDENTIAL_CONTRACT');
      await route.abort();
      return;
    }
    if (path === '/users/me' && method === 'GET') {
      await send(envelope(user));
      return;
    }
    if (
      !/^\/admin\/technologies(?:\/[a-f0-9]{24})?$/.test(path) ||
      !['GET', 'POST', 'PATCH'].includes(method) ||
      (path !== '/admin/technologies' && method === 'POST') ||
      (path === '/admin/technologies' && method === 'PATCH')
    ) {
      state.unexpected.push('UNAPPROVED_OPERATION');
      await route.abort();
      return;
    }
    if (method !== 'GET') state.mutations++;
    if (state.network) {
      await route.abort('failed');
      return;
    }
    if (state.fault) {
      const codes: Record<number, string> = {
        401: 'AUTH_ACCESS_TOKEN_EXPIRED',
        403: 'AUTH_FORBIDDEN',
        404: 'TECHNOLOGY_NOT_FOUND',
        409: 'TECHNOLOGY_REVISION_CONFLICT',
        429: 'RATE_LIMIT_EXCEEDED',
        503: 'DEPENDENCY_UNAVAILABLE',
      };
      await send(failure(codes[state.fault] ?? 'INTERNAL_ERROR'), state.fault);
      return;
    }
    let body: unknown;
    if (method === 'GET') {
      const page = Number(url.searchParams.get('page') ?? 1),
        limit = Number(url.searchParams.get('limit') ?? 20);
      body =
        path === '/admin/technologies'
          ? envelope(page === 1 ? state.rows : [], {
              page,
              limit,
              total: state.total,
              totalPages: Math.ceil(state.total / limit),
            })
          : envelope(state.rows.find((row) => path.endsWith(row.id)) ?? record);
    } else {
      const input = request.postDataJSON() as Record<string, unknown>;
      const allowed =
        method === 'POST'
          ? ['name', 'slug', 'description', 'order']
          : ['name', 'description', 'order', 'revision'];
      if (Object.keys(input).some((key) => !allowed.includes(key))) {
        state.unexpected.push('INJECTED_MUTATION_FIELD');
        await route.abort();
        return;
      }
      const value =
        method === 'POST'
          ? { ...record, ...input, id: 'c'.repeat(24), revision: 0 }
          : {
              ...state.rows[0]!,
              ...input,
              revision: Number(input.revision) + 1,
            };
      state.rows = [value as Technology];
      state.total = 1;
      body = envelope(value);
    }
    if (state.malformed)
      body = { ...(body as object), privateField: 'SYNTHETIC_PRIVATE' };
    if (state.hold) {
      state.held.push({ route, body });
      return;
    }
    await send(body, method === 'POST' ? 201 : 200);
  });
  return state;
}
type Mock = Awaited<ReturnType<typeof mock>>;
async function release(state: Mock) {
  state.hold = false;
  for (const held of state.held.splice(0)) {
    try {
      await held.route.fulfill({ status: 200, headers, json: held.body });
    } catch {
      /* Owned aborted requests cannot deliver stale state. */
    }
  }
}
const test = base.extend<{ technology: Mock }>({
  technology: async ({ context }, use) => {
    const state = await mock(context);
    try {
      await use(state);
    } finally {
      await release(state);
      expect(state.unexpected).toEqual([]);
    }
  },
});
test.use({
  baseURL: APP,
  serviceWorkers: 'block',
  trace: 'off',
  screenshot: 'off',
  video: 'off',
});
test.setTimeout(30000);
const inventory = (page: Page) =>
  page.getByRole('heading', { name: 'Technologies', exact: true });
async function open(page: Page) {
  await page.goto(APP);
  await page
    .getByRole('button', { name: 'Restore existing session', exact: true })
    .click();
  await expect(inventory(page)).toBeVisible();
}
async function editor(page: Page) {
  await page
    .getByRole('button', { name: '+ Create draft', exact: true })
    .click();
  await expect(
    page.getByRole('form', { name: 'Create draft Technology' }),
  ).toBeVisible();
}
async function create(page: Page) {
  await editor(page);
  await page.getByLabel('Name', { exact: false }).fill('JavaScript');
  await page.getByLabel('Slug', { exact: false }).fill('javascript');
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
}

test('F043-B01 inventory requires explicit authenticated restoration', async ({
  page,
  technology,
}) => {
  await page.goto(APP);
  await expect(inventory(page)).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Restore existing session', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: record.name, exact: true }),
  ).toBeVisible();
  expect(technology.mutations).toBe(0);
});
test('F043-B02 empty inventory has truthful zero count', async ({
  page,
  technology,
}) => {
  technology.rows = [];
  technology.total = 0;
  await open(page);
  await expect(
    page.getByRole('heading', { name: 'No Technologies on this page' }),
  ).toBeVisible();
});
test('F043-B03 bounded pagination can return to the previous page', async ({
  page,
  technology,
}) => {
  technology.total = 21;
  await open(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: 'Technology pages' }),
  ).toContainText('Page 2');
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(
    page.getByRole('button', { name: record.name, exact: true }),
  ).toBeVisible();
});
test('F043-B04 DRAFT detail exposes revision and immutable slug', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: record.name, exact: true }).click();
  await expect(
    page.getByRole('form', { name: 'Edit draft Technology' }),
  ).toBeVisible();
  await expect(page.getByLabel('Slug', { exact: false })).toHaveAttribute(
    'readonly',
    '',
  );
  await expect(page.getByText('Revision', { exact: true })).toBeVisible();
});
test('F043-B05 create sends one draft operation and shows success', async ({
  page,
  technology,
}) => {
  await open(page);
  await create(page);
  await expect(page.getByRole('status')).toContainText('Draft saved.');
  expect(technology.mutations).toBe(1);
});
test('F043-B06 edit submits current revision and displays increment', async ({
  page,
  technology,
}) => {
  await open(page);
  await page.getByRole('button', { name: record.name, exact: true }).click();
  await page.getByLabel('Name', { exact: false }).fill('Updated draft');
  await page.getByRole('button', { name: 'Save draft changes' }).click();
  await expect(page.getByRole('status')).toContainText('Draft saved.');
  expect(technology.rows[0]?.revision).toBe(1);
});
test('F043-B07 field validation prevents malformed draft submission', async ({
  page,
  technology,
}) => {
  await open(page);
  await editor(page);
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: false })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(technology.mutations).toBe(0);
});
test('F043-B08 PUBLISHED records remain read-only', async ({
  page,
  technology,
}) => {
  technology.rows[0]!.status = 'PUBLISHED';
  await open(page);
  await page.getByRole('button', { name: record.name, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Read-only Technology' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save draft changes' }),
  ).toHaveCount(0);
});
test('F043-B09 ARCHIVED records remain read-only', async ({
  page,
  technology,
}) => {
  technology.rows[0]!.status = 'ARCHIVED';
  await open(page);
  await page.getByRole('button', { name: record.name, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Read-only Technology' }),
  ).toBeVisible();
  await expect(page.getByRole('form')).toHaveCount(0);
});
test('F043-B10 revision conflict requires explicit reload without replay', async ({
  page,
  technology,
}) => {
  await open(page);
  await page.getByRole('button', { name: record.name, exact: true }).click();
  await expect(page.getByRole('form')).toBeVisible();
  technology.fault = 409;
  await page.getByRole('button', { name: 'Save draft changes' }).click();
  await expect(
    page.getByRole('button', { name: 'Reload selected Technology' }),
  ).toBeVisible();
  expect(technology.mutations).toBe(1);
});
test('F043-B11 unknown write result hides editor and never replays', async ({
  page,
  technology,
}) => {
  await open(page);
  await editor(page);
  await page.getByLabel('Name', { exact: false }).fill('New draft');
  await page.getByLabel('Slug', { exact: false }).fill('new-draft');
  technology.network = true;
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('will not be replayed');
  await expect(page.getByRole('form')).toHaveCount(0);
  expect(technology.mutations).toBe(1);
});
test('F043-B12 HTTP 401 invalidates eligible workspace', async ({
  page,
  technology,
}) => {
  await open(page);
  technology.fault = 401;
  await page.getByRole('button', { name: 'Refresh inventory' }).click();
  await expect(inventory(page)).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Admin sign in', exact: true }),
  ).toBeVisible();
});
test('F043-B13 HTTP 403 removes displayed authority', async ({
  page,
  technology,
}) => {
  await open(page);
  technology.fault = 403;
  await page.getByRole('button', { name: 'Refresh inventory' }).click();
  await expect(inventory(page)).toHaveCount(0);
});
test('F043-B14 missing detail is safely unavailable', async ({
  page,
  technology,
}) => {
  await open(page);
  technology.fault = 404;
  await page.getByRole('button', { name: record.name, exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('unavailable');
  await expect(page.getByText('SYNTHETIC_PRIVATE_NOT_FOR_UI')).toHaveCount(0);
});
test('F043-B15 rate limit and dependency failure expose manual recovery only', async ({
  page,
  technology,
}) => {
  await open(page);
  technology.fault = 429;
  await page.getByRole('button', { name: 'Refresh inventory' }).click();
  await expect(page.getByRole('alert')).toContainText('Wait');
  technology.fault = 503;
  await page.getByRole('button', { name: 'Refresh inventory' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'temporarily unavailable',
  );
});
test('F043-B16 private response fields are refused before display', async ({
  page,
  technology,
}) => {
  technology.malformed = true;
  await open(page);
  await expect(page.getByRole('alert')).toContainText('could not be verified');
  await expect(page.getByText('SYNTHETIC_PRIVATE')).toHaveCount(0);
});
test('F043-B17 cancellation and account-change signals discard late reads', async ({
  page,
  technology,
}) => {
  await open(page);
  technology.hold = true;
  await page.getByRole('button', { name: 'Refresh inventory' }).click();
  await expect.poll(() => technology.held.length).toBe(1);
  await page.evaluate(() => {
    const channel = new BroadcastChannel('deeplearner-auth');
    channel.postMessage('identity-changed');
    channel.close();
  });
  await expect(inventory(page)).toHaveCount(0);
  await release(technology);
  await expect(inventory(page)).toHaveCount(0);
});
test('F043-B18 logout clears Technology data and leaves storage empty', async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole('button', { name: 'Sign out of this device', exact: true })
    .click();
  await expect(inventory(page)).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
});
test('F043-B19 keyboard editor focus, labels and close restoration', async ({
  page,
}) => {
  await open(page);
  await editor(page);
  await expect(
    page.getByRole('heading', { name: 'Create a draft', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Close Technology detail' }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Close Technology detail' }).click();
  await expect(inventory(page)).toBeFocused();
});
test('F043-B20 desktop tablet and mobile retain contained layout and escaped text', async ({
  page,
  technology,
}) => {
  technology.rows[0]!.name = '<script>synthetic</script>';
  await open(page);
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(inventory(page)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await expect(
    page.getByRole('button', {
      name: '<script>synthetic</script>',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('main').locator('script')).toHaveCount(0);
});
