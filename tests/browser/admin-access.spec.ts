import {
  expect,
  test as base,
  type BrowserContext,
  type Page,
  type Route,
} from '@playwright/test';
import type { CurrentUser } from '../../apps/admin/src/lib/auth/contracts';

// PREPARED ONLY — 20 NOT_RUN. Separate browser/environment approval is mandatory.
// Requires the existing Admin runtime on localhost:5173, configured for the API
// origin below. All API responses are synthetic: no live API/MongoDB acceptance.
// Do not launch services or change the primary-host Playwright policy from here.
const APP = 'http://localhost:5173';
const API = 'http://localhost:4000';
const fixtureUser: CurrentUser = {
  id: 'a'.repeat(24),
  firstName: 'Fixture',
  lastName: 'Admin',
  email: 'admin@example.test',
  role: 'ADMIN',
  status: 'ACTIVE',
  emailVerified: true,
  plan: 'FREE',
  authMethods: ['PASSWORD'],
  profile: null,
  createdAt: '2026-10-29T00:00:00.000Z',
};
const envelope = (data: unknown) => ({
  success: true,
  data,
  message: null,
  meta: { requestId: 'f042-synthetic' },
});
const failure = (code: string) => ({
  success: false,
  error: { code, message: 'SYNTHETIC_PRIVATE_DETAIL' },
  meta: { requestId: 'f042-synthetic' },
});
const headers = {
  'Access-Control-Allow-Origin': APP,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'authorization,content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Cache-Control': 'no-store',
};
async function mock(context: BrowserContext) {
  const state = {
    user: { ...fixtureUser },
    fault: 0,
    network: false,
    malformed: false,
    logoutFailure: false,
    holdMe: false,
    calls: [] as string[],
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
      state.unexpected.push('UNEXPECTED_ORIGIN_OR_PATH');
      await route.abort();
      return;
    }
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const path = url.pathname.slice('/api/v1'.length);
    const allowed = [
      '/auth/login',
      '/auth/refresh',
      '/auth/logout',
      '/users/me',
    ];
    if (
      !allowed.includes(path) ||
      url.search ||
      request.method() !== (path === '/users/me' ? 'GET' : 'POST')
    ) {
      state.unexpected.push('UNEXPECTED_API_CONTRACT');
      await route.abort();
      return;
    }
    state.calls.push(path);
    const send = (body: unknown, status = 200) =>
      route.fulfill({ status, headers, json: body });
    if (path === '/auth/logout') {
      await send(
        state.logoutFailure
          ? failure('DEPENDENCY_UNAVAILABLE')
          : envelope(null),
        state.logoutFailure ? 503 : 200,
      );
      return;
    }
    if (state.network) {
      await route.abort('failed');
      return;
    }
    if (path !== '/users/me') {
      const access = { accessToken: 'synthetic-access', expiresInSeconds: 900 };
      await send(
        envelope(
          path === '/auth/login'
            ? {
                ...access,
                user: {
                  id: state.user.id,
                  firstName: state.user.firstName,
                  lastName: state.user.lastName,
                  email: state.user.email,
                  role: state.user.role,
                  plan: state.user.plan,
                  status: 'ACTIVE',
                },
              }
            : access,
        ),
      );
      return;
    }
    const requestHeaders = await request.allHeaders();
    if (
      requestHeaders.authorization !== 'Bearer synthetic-access' ||
      'cookie' in requestHeaders
    ) {
      state.unexpected.push('CURRENT_USER_CREDENTIAL_CONTRACT');
      await route.abort();
      return;
    }
    if (state.fault) {
      const code =
        state.fault === 401
          ? 'AUTH_ACCESS_TOKEN_EXPIRED'
          : state.fault === 403
            ? 'AUTH_FORBIDDEN'
            : state.fault === 404
              ? 'USER_NOT_FOUND'
              : state.fault === 429
                ? 'RATE_LIMIT_EXCEEDED'
                : 'DEPENDENCY_UNAVAILABLE';
      await send(failure(code), state.fault);
      return;
    }
    const body = envelope(
      state.malformed
        ? { ...state.user, passwordHash: 'SYNTHETIC_PRIVATE_FIELD' }
        : state.user,
    );
    if (state.holdMe) {
      state.held.push({ route, body });
      return;
    }
    await send(body);
  });
  return state;
}
type Mock = Awaited<ReturnType<typeof mock>>;
async function release(state: Mock) {
  for (const item of state.held.splice(0)) {
    try {
      await item.route.fulfill({ headers, json: item.body });
    } catch {
      /* A cancelled/closed request cannot deliver obsolete authority. */
    }
  }
}
const test = base.extend<{ admin: Mock }>({
  admin: async ({ context }, use) => {
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
const signIn = (page: Page) =>
  page.getByRole('heading', { name: 'Admin sign in', exact: true });
const welcome = (page: Page) =>
  page.getByRole('heading', { name: /^Welcome,/ });
async function open(page: Page, path = '/') {
  await page.goto(APP + path);
  await expect(signIn(page)).toBeVisible();
}
async function restore(page: Page) {
  await page
    .getByRole('button', { name: 'Restore existing session', exact: true })
    .click();
}
async function login(page: Page) {
  await page
    .getByLabel('Email address', { exact: true })
    .fill(fixtureUser.email);
  // Public synthetic fixture string, never a real account credential.
  await page
    .getByLabel('Password', { exact: true })
    .fill('synthetic-only-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
async function control(page: Page, value: 'identity-changed' | 'signed-out') {
  await page.evaluate((message) => {
    const channel = new BroadcastChannel('deeplearner-auth');
    channel.postMessage(message);
    channel.close();
  }, value);
}

test('F042-B01 mount is passive and restoration is explicit', async ({
  page,
  admin,
}) => {
  await open(page);
  expect(admin.calls).toEqual([]);
  await restore(page);
  await expect(welcome(page)).toBeVisible();
  expect(admin.calls).toEqual(['/auth/refresh', '/users/me']);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
});
test('F042-B02 sign-in requires current Admin eligibility before the welcome scaffold', async ({
  page,
  admin,
}) => {
  admin.holdMe = true;
  await open(page);
  await login(page);
  await expect.poll(() => admin.held.length).toBe(1);
  await expect(welcome(page)).toHaveCount(0);
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(
    page.getByRole('group', { name: 'Admin account credentials' }),
  ).toBeDisabled();
  await release(admin);
  await expect(welcome(page)).toBeVisible();
  expect(admin.calls).toEqual(['/auth/login', '/users/me']);
});
test('F042-B03 Student identity cannot expose Admin content', async ({
  page,
  admin,
}) => {
  admin.user.role = 'STUDENT';
  await open(page);
  await restore(page);
  await expect(page.getByRole('alert')).toContainText('cannot access Admin');
  await expect(welcome(page)).toHaveCount(0);
});
test('F042-B04 disabled current account is denied', async ({ page, admin }) => {
  admin.user.status = 'DISABLED';
  await open(page);
  await restore(page);
  await expect(page.getByRole('alert')).toContainText('cannot access Admin');
  await expect(welcome(page)).toHaveCount(0);
});
test('F042-B05 suspended current account is denied', async ({
  page,
  admin,
}) => {
  admin.user.status = 'SUSPENDED';
  await open(page);
  await restore(page);
  await expect(page.getByRole('alert')).toContainText('cannot access Admin');
  await expect(welcome(page)).toHaveCount(0);
});
test('F042-B06 unverified current account is denied', async ({
  page,
  admin,
}) => {
  admin.user.emailVerified = false;
  await open(page);
  await restore(page);
  await expect(page.getByRole('alert')).toContainText('cannot access Admin');
  await expect(welcome(page)).toHaveCount(0);
});
test('F042-B07 expired access hides authority without automatic refresh', async ({
  page,
  admin,
}) => {
  await open(page);
  await restore(page);
  await expect(welcome(page)).toBeVisible();
  admin.fault = 401;
  await page.getByRole('button', { name: 'Check current access' }).click();
  await expect(page.getByRole('alert')).toContainText('expired');
  await expect(welcome(page)).toHaveCount(0);
  expect(admin.calls.filter((path) => path === '/auth/refresh')).toHaveLength(
    1,
  );
});
test('F042-B08 unavailable dependency and missing account never imply authorization', async ({
  page,
  admin,
}) => {
  await open(page);
  await restore(page);
  await expect(welcome(page)).toBeVisible();
  admin.fault = 503;
  await page.getByRole('button', { name: 'Check current access' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'temporarily unavailable',
  );
  admin.fault = 404;
  await page.getByRole('button', { name: 'Retry session check' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'temporarily unavailable',
  );
  await expect(welcome(page)).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(
    'SYNTHETIC_PRIVATE_DETAIL',
  );
});
test('F042-B09 private or malformed DTO is refused without exposing its contents', async ({
  page,
  admin,
}) => {
  admin.malformed = true;
  await open(page);
  await restore(page);
  await expect(page.getByRole('alert')).toContainText('could not be confirmed');
  await expect(
    page.getByRole('button', { name: 'Restore existing session', exact: true }),
  ).toBeDisabled();
  await expect(welcome(page)).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(
    'SYNTHETIC_PRIVATE_FIELD',
  );
});
test('F042-B10 rate limiting has manual retry and no invented countdown', async ({
  page,
  admin,
}) => {
  admin.fault = 429;
  await open(page);
  await restore(page);
  await expect(page.getByRole('alert')).toContainText('Too many requests');
  await expect(
    page.getByRole('button', { name: 'Retry session check' }),
  ).toBeEnabled();
  expect(admin.calls).toEqual(['/auth/refresh', '/users/me']);
  await expect(page.locator('body')).not.toContainText(
    /SYNTHETIC_PRIVATE_DETAIL|Retry in \d/,
  );
});
test('F042-B11 ambiguous refresh cannot be replayed automatically or via restore', async ({
  page,
  admin,
}) => {
  admin.network = true;
  await open(page);
  await restore(page);
  await expect(page.getByRole('alert')).toContainText('could not be confirmed');
  await expect(
    page.getByRole('button', { name: 'Restore existing session', exact: true }),
  ).toBeDisabled();
  await expect(welcome(page)).toHaveCount(0);
  expect(admin.calls).toEqual(['/auth/refresh']);
});
test('F042-B12 manual recovery obtains newly checked eligibility', async ({
  page,
  admin,
}) => {
  await open(page);
  await restore(page);
  await expect(welcome(page)).toBeVisible();
  admin.fault = 503;
  await page.getByRole('button', { name: 'Check current access' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'temporarily unavailable',
  );
  admin.fault = 0;
  await page.getByRole('button', { name: 'Retry session check' }).click();
  await expect(welcome(page)).toBeVisible();
  expect(admin.calls).toEqual([
    '/auth/refresh',
    '/users/me',
    '/users/me',
    '/auth/refresh',
    '/users/me',
  ]);
});
test('F042-B13 current-device logout removes privileged content and session identity', async ({
  page,
  admin,
}) => {
  await open(page);
  await restore(page);
  await expect(welcome(page)).toBeVisible();
  await page
    .getByRole('button', { name: 'Sign out of this device', exact: true })
    .click();
  await expect(signIn(page)).toBeVisible();
  await expect(welcome(page)).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(fixtureUser.email);
  expect(admin.calls.at(-1)).toBe('/auth/logout');
});
test('F042-B14 failed logout remains uncertain and requires explicit sign-out retry', async ({
  page,
  admin,
}) => {
  await open(page);
  await restore(page);
  await expect(welcome(page)).toBeVisible();
  admin.logoutFailure = true;
  await page
    .getByRole('button', { name: 'Sign out of this device', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('could not be confirmed');
  await expect(welcome(page)).toHaveCount(0);
  admin.logoutFailure = false;
  await page
    .getByRole('button', { name: 'Retry sign-out of this device' })
    .click();
  await expect(page.getByRole('status')).toContainText('signed out');
  expect(admin.calls.filter((path) => path === '/auth/logout')).toHaveLength(2);
});
test('F042-B15 account invalidation discards a former-account response', async ({
  page,
  admin,
}) => {
  admin.holdMe = true;
  await open(page);
  await restore(page);
  await expect.poll(() => admin.held.length).toBe(1);
  await control(page, 'identity-changed');
  await expect(page.getByRole('status')).toContainText('signed out');
  await release(admin);
  await expect(welcome(page)).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(fixtureUser.email);
});
test('F042-B16 same-origin peer-tab sign-out invalidates the current Admin display', async ({
  page,
  context,
  admin,
}) => {
  await open(page);
  await restore(page);
  await expect(welcome(page)).toBeVisible();
  const peer = await context.newPage();
  try {
    await open(peer);
    await control(peer, 'signed-out');
    await expect(signIn(page)).toBeVisible();
    await expect(welcome(page)).toHaveCount(0);
    expect(admin.calls.filter((path) => path === '/auth/refresh')).toHaveLength(
      1,
    );
  } finally {
    await peer.close();
  }
});
test('F042-B17 untrusted return parameters never create navigation or restore authority', async ({
  page,
  admin,
}) => {
  await open(page, '/?returnTo=https%3A%2F%2Fexample.invalid%2Fprivate');
  expect(admin.calls).toEqual([]);
  await restore(page);
  await expect(welcome(page)).toBeVisible();
  await expect(page).toHaveURL(
    APP + '/?returnTo=https%3A%2F%2Fexample.invalid%2Fprivate',
  );
  await expect(page.getByRole('link')).toHaveCount(1);
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toHaveAttribute('href', '#main-content');
  await page.reload();
  await expect(signIn(page)).toBeVisible();
  await expect(welcome(page)).toHaveCount(0);
  expect(admin.calls.filter((path) => path === '/auth/refresh')).toHaveLength(
    1,
  );
});
test('F042-B18 native keyboard submission and access-loss focus are usable', async ({
  page,
  admin,
}) => {
  await open(page);
  await page
    .getByLabel('Email address', { exact: true })
    .fill(fixtureUser.email);
  await page
    .getByLabel('Password', { exact: true })
    .fill('synthetic-only-password');
  await page.getByLabel('Password', { exact: true }).press('Enter');
  await expect(welcome(page)).toBeVisible();
  await expect(welcome(page)).toBeFocused();
  admin.fault = 403;
  await page.getByRole('button', { name: 'Check current access' }).focus();
  await page.keyboard.press('Enter');
  await expect(signIn(page)).toBeFocused();
  await expect(page.getByRole('alert')).toContainText('cannot access Admin');
});
test('F042-B19 desktop tablet and mobile layouts keep labels and actions in bounds', async ({
  page,
  admin,
}) => {
  admin.user.firstName = 'Long'.repeat(20);
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await open(page);
    await expect(
      page.getByLabel('Email address', { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await restore(page);
    await expect(welcome(page)).toBeVisible();
    const logout = page.getByRole('button', {
      name: 'Sign out of this device',
      exact: true,
    });
    await expect(logout).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await logout.click();
    await expect(signIn(page)).toBeVisible();
  }
});
test('F042-B20 labelled fields and loading success error announcements retain semantics', async ({
  page,
  admin,
}) => {
  admin.holdMe = true;
  await open(page);
  await expect(
    page.getByLabel('Email address', { exact: true }),
  ).toHaveAttribute('autocomplete', 'username');
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'autocomplete',
    'current-password',
  );
  await restore(page);
  await expect.poll(() => admin.held.length).toBe(1);
  await expect(
    page.getByRole('region', { name: 'Admin sign in' }),
  ).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  await release(admin);
  await expect(welcome(page)).toBeVisible();
  await expect(page.getByRole('status')).toContainText(
    'eligibility has been checked',
  );
  admin.fault = 503;
  await page.getByRole('button', { name: 'Check current access' }).click();
  await expect(page.getByRole('alert')).toHaveAttribute(
    'aria-live',
    'assertive',
  );
  await expect(page.getByRole('alert')).toHaveAttribute('aria-atomic', 'true');
});
