import { test as base, expect, type BrowserContext } from '@playwright/test';
import type { LearningPath } from '../../apps/admin/src/lib/learning-paths/contracts';

// PREPARED ONLY: F044-B01-B12 NOT_RUN. No service startup or live API evidence.
// Separate qualified, ownership-safe browser approval required before execution.
const APP = 'http://127.0.0.1:5173',
  API = 'http://127.0.0.1:4000';
const parentId = 'a'.repeat(24),
  otherId = 'c'.repeat(24);
const parent = {
  id: parentId,
  name: 'Synthetic Technology',
  slug: 'synthetic',
  description: null,
  iconAssetId: null,
  status: 'DRAFT',
  order: 0,
  revision: 0,
  createdAt: '2026-11-03T00:00:00.000Z',
  updatedAt: '2026-11-03T00:00:00.000Z',
};
const path: LearningPath = {
  id: 'b'.repeat(24),
  technologyId: parentId,
  title: 'Synthetic Learning Path',
  slug: 'synthetic-path',
  description: 'Read-only description',
  targetLevel: null,
  completionScore: 80,
  status: 'DRAFT',
  order: 0,
  revision: 0,
  createdAt: parent.createdAt,
  updatedAt: parent.updatedAt,
};
const user = {
  id: 'f'.repeat(24),
  firstName: 'Fixture',
  lastName: 'Admin',
  email: 'fixture@example.test',
  role: 'ADMIN',
  status: 'ACTIVE',
  emailVerified: true,
  plan: 'FREE',
  authMethods: ['PASSWORD'],
  profile: null,
  createdAt: parent.createdAt,
};
const envelope = (data: unknown, meta = {}) => ({
  success: true,
  data,
  message: null,
  meta: { requestId: 'f044-synthetic', ...meta },
});
async function mock(context: BrowserContext) {
  const held = new Set<() => void>();
  const state = {
    parentPaging: false,
    parentRequests: [] as number[],
    detailReads: 0,
    logoutStarted: false,
    releaseHeld() {
      for (const release of [...held]) release();
    },
    parentStatus: 'DRAFT',
    pathStatus: 'DRAFT' as LearningPath['status'],
    empty: false,
    later: false,
    detailMismatch: false,
    missingParent: false,
    fault: 0,
    hold: false,
    released: false,
    reads: 0,
    unexpected: [] as string[],
  };
  await context.route('**/*', async (route) => {
    const r = route.request(),
      url = new URL(r.url());
    if (url.origin === APP) {
      await route.continue();
      return;
    }
    if (url.origin !== API || !url.pathname.startsWith('/api/v1/')) {
      state.unexpected.push('UNAPPROVED_NETWORK');
      await route.abort();
      return;
    }
    const headers = {
      'Access-Control-Allow-Origin': APP,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'authorization,content-type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Cache-Control': 'no-store',
    };
    if (r.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const send = (json: unknown, status = 200) =>
      route.fulfill({ status, headers, json });
    const access = { accessToken: 'synthetic-access', expiresInSeconds: 900 };
    if (
      r.method() === 'POST' &&
      [
        '/api/v1/auth/login',
        '/api/v1/auth/refresh',
        '/api/v1/auth/logout',
      ].includes(url.pathname)
    ) {
      if (url.pathname.endsWith('/logout')) state.logoutStarted = true;
      await send(
        envelope(
          url.pathname.endsWith('/logout')
            ? null
            : url.pathname.endsWith('/refresh')
              ? access
              : {
                  ...access,
                  user: {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                    plan: user.plan,
                  },
                },
        ),
      );
      return;
    }
    const h = await r.allHeaders();
    if (
      h.authorization !== 'Bearer synthetic-access' ||
      'cookie' in h ||
      r.method() !== 'GET'
    ) {
      state.unexpected.push('CREDENTIAL_OR_METHOD_REFUSAL');
      await route.abort();
      return;
    }
    if (url.pathname === '/api/v1/users/me') {
      await send(envelope(user));
      return;
    }
    const page = Number(url.searchParams.get('page') ?? 1),
      limit = Number(url.searchParams.get('limit') ?? 20);
    if (url.pathname.startsWith('/api/v1/admin/technologies')) {
      if (url.pathname.endsWith('/' + parentId)) {
        await send(envelope({ ...parent, status: state.parentStatus }));
        return;
      }
      state.parentRequests.push(page);
      let items =
        page === 1
          ? [
              { ...parent, status: state.parentStatus },
              {
                ...parent,
                id: otherId,
                name: 'Other Technology',
                slug: 'typescript',
              },
            ]
          : [];
      if (state.parentPaging)
        items =
          page === 1
            ? [
                { ...parent, status: state.parentStatus },
                ...Array.from({ length: 18 }, (_, i) => ({
                  ...parent,
                  id: (i + 1).toString(16).padStart(24, '0'),
                  slug: 'technology-' + String(i).padStart(2, '0'),
                  name: 'Technology ' + i,
                })),
                {
                  ...parent,
                  id: otherId,
                  name: 'Other Technology',
                  slug: 'typescript',
                },
              ]
            : [
                {
                  ...parent,
                  id: 'd'.repeat(24),
                  name: 'Last Technology',
                  slug: 'zulu',
                },
              ];
      await send(
        envelope(items, {
          page,
          limit,
          total: state.parentPaging ? 21 : 2,
          totalPages: state.parentPaging ? 2 : 1,
        }),
      );
      return;
    }
    if (
      !url.pathname.startsWith('/api/v1/admin/learning-paths') ||
      url.searchParams.get('technologyId') !== parentId
    ) {
      state.unexpected.push('PARENT_BINDING_REFUSAL');
      await route.abort();
      return;
    }
    state.reads++;
    if (url.pathname.endsWith('/' + path.id)) state.detailReads++;
    if (state.hold)
      await new Promise<void>((resolve) => {
        const release = () => {
          clearTimeout(timer);
          held.delete(release);
          resolve();
        };
        const timer = setTimeout(() => {
          state.unexpected.push('HELD_READ_DEADLINE');
          release();
        }, 5000);
        held.add(release);
        if (state.released) release();
      });
    if (state.fault || state.missingParent) {
      const status = state.missingParent ? 404 : state.fault;
      await send(
        {
          success: false,
          error: {
            code: state.missingParent
              ? 'TECHNOLOGY_NOT_FOUND'
              : status === 429
                ? 'RATE_LIMIT_EXCEEDED'
                : 'DEPENDENCY_UNAVAILABLE',
            message: 'SYNTHETIC_PRIVATE',
          },
          meta: { requestId: 'f044-synthetic' },
        },
        status,
      );
      return;
    }
    if (url.pathname.endsWith('/' + path.id)) {
      await send(
        envelope({
          ...path,
          status: state.pathStatus,
          technologyId: state.detailMismatch ? otherId : parentId,
        }),
      );
      return;
    }
    const total = state.empty ? 0 : state.later ? 21 : 1;
    const items =
      state.empty || page > 1
        ? []
        : state.later
          ? Array.from({ length: 20 }, (_, i) => ({
              ...path,
              id: i.toString(16).padStart(24, '0'),
              slug: 'path-' + String(i).padStart(2, '0'),
              order: i,
              status: state.pathStatus,
            }))
          : [{ ...path, status: state.pathStatus }];
    await send(
      envelope(items, {
        page,
        limit,
        total: state.later && page > 1 ? 1 : total,
        totalPages: state.later && page > 1 ? 1 : Math.ceil(total / limit),
      }),
    );
  });
  return state;
}
const test = base.extend<{ fixture: Awaited<ReturnType<typeof mock>> }>({
  fixture: [
    async ({ context }, use) => {
      const fixture = await mock(context);
      try {
        await use(fixture);
      } finally {
        fixture.released = true;
        fixture.releaseHeld();
        await context.unrouteAll({ behavior: 'wait' });
        expect(fixture.unexpected).toEqual([]);
      }
    },
    { auto: true },
  ],
});
async function open(page: import('@playwright/test').Page) {
  await page.goto(APP);
  await page.getByLabel('Email').fill('fixture@example.test');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Technologies', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Learning Paths', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Learning Paths', exact: true }),
  ).toBeVisible();
}
async function select(page: import('@playwright/test').Page) {
  await page
    .getByRole('button', {
      name: /Synthetic Technology DRAFT|Synthetic Technology ARCHIVED/,
    })
    .click();
}
test('F044-B01 default workspace and deliberate navigation', async ({
  page,
}) => {
  await open(page);
  await expect(
    page.getByRole('heading', { name: 'Learning Paths', exact: true }),
  ).toBeFocused();
  await page
    .getByRole('button', { name: 'Technology Management', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Technologies', exact: true }),
  ).toBeVisible();
});
test('F044-B02 bounded Technology chooser', async ({ page, fixture }) => {
  fixture.parentPaging = true;
  await open(page);
  await select(page);
  await expect(
    page.getByRole('navigation', { name: 'Technology chooser pages' }),
  ).toContainText('21 total');
  await page.getByRole('button', { name: 'Next Technologies' }).click();
  await expect(
    page.getByRole('button', { name: 'Last Technology DRAFT' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Synthetic Technology Learning Paths/ }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Previous Technologies' }).click();
  await expect(
    page.getByRole('button', { name: 'Synthetic Technology DRAFT' }),
  ).toBeVisible();
  expect(fixture.parentRequests.slice(-3)).toEqual([1, 2, 1]);
});
test('F044-B03 child pagination and empty later page', async ({
  page,
  fixture,
}) => {
  fixture.later = true;
  await open(page);
  await select(page);
  await page.getByRole('button', { name: 'Next Learning Paths' }).click();
  await expect(page.getByRole('status')).toContainText('No Learning Paths');
  await expect(
    page.getByRole('button', { name: 'Previous Learning Paths' }),
  ).toBeEnabled();
});
test('F044-B04 detail refuses a different parent', async ({
  page,
  fixture,
}) => {
  fixture.detailMismatch = true;
  await open(page);
  await select(page);
  await page.getByRole('button', { name: path.title, exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not be verified');
  await expect(
    page.getByText('Read-only description', { exact: true }),
  ).toHaveCount(0);
});
test('F044-B05 all actual statuses remain read-only', async ({
  page,
  fixture,
}) => {
  await open(page);
  await select(page);
  for (const status of ['PUBLISHED', 'ARCHIVED', 'DRAFT'] as const) {
    fixture.pathStatus = status;
    const previousReads = fixture.detailReads;
    await page.getByRole('button', { name: path.title, exact: true }).click();
    await expect.poll(() => fixture.detailReads).toBe(previousReads + 1);
    await expect(
      page
        .getByRole('region', { name: path.title, exact: true })
        .getByText(status, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: path.title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Configured completion threshold', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: /Save|Publish|Generate|Approve|Delete/,
      }),
    ).toHaveCount(0);
  }
});
test('F044-B06 archived parent notice and inspection', async ({
  page,
  fixture,
}) => {
  fixture.parentStatus = 'ARCHIVED';
  await open(page);
  await select(page);
  await expect(
    page.getByText(/Archived Technology: protected read-only/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: path.title, exact: true }),
  ).toBeVisible();
});
test('F044-B07 missing parent clears children', async ({ page, fixture }) => {
  fixture.missingParent = true;
  await open(page);
  await select(page);
  await expect(page.getByRole('alert')).toContainText(
    'Technology is unavailable',
  );
  await expect(
    page.getByRole('heading', { name: /Synthetic Technology Learning Paths/ }),
  ).toHaveCount(0);
});
test('F044-B08 empty inventory is explicit', async ({ page, fixture }) => {
  fixture.empty = true;
  await open(page);
  await select(page);
  await expect(page.getByRole('status')).toContainText('No Learning Paths');
});
test('F044-B09 rate limit and explicit retry without replay', async ({
  page,
  fixture,
}) => {
  fixture.fault = 429;
  await open(page);
  await select(page);
  await expect(page.getByRole('alert')).toContainText('Too many requests');
  expect(fixture.reads).toBe(1);
  fixture.fault = 0;
  await page.getByRole('button', { name: 'Retry current read' }).click();
  await expect(
    page.getByRole('button', { name: path.title, exact: true }),
  ).toBeVisible();
  expect(fixture.reads).toBe(2);
});
test('F044-B10 logout refuses a late private read', async ({
  page,
  fixture,
}) => {
  fixture.hold = true;
  await open(page);
  await select(page);
  await expect(page.getByRole('status')).toContainText(
    'Loading Learning Paths',
  );
  await expect.poll(() => fixture.reads).toBe(1);
  await page.getByRole('button', { name: 'Sign out of this device' }).click();
  await expect(
    page.getByRole('heading', { name: 'Learning Paths', exact: true }),
  ).toHaveCount(0);
  fixture.released = true;
  fixture.releaseHeld();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect.poll(() => fixture.logoutStarted).toBe(true);
  await expect(
    page.getByRole('button', { name: path.title, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: path.title, exact: true }),
  ).toHaveCount(0);
});
test('F044-B11 native keyboard navigation and focus', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Refresh', exact: true }),
  ).toBeFocused();
  await select(page);
  await page
    .getByRole('region', { name: 'Learning Path inventory table' })
    .focus();
  await expect(
    page.getByRole('region', { name: 'Learning Path inventory table' }),
  ).toBeFocused();
});
test('F044-B12 four-width containment', async ({ page }) => {
  await open(page);
  await select(page);
  const table = page.getByRole('region', {
    name: 'Learning Path inventory table',
  });
  await expect(table).toBeVisible();
  await page.getByRole('button', { name: path.title, exact: true }).click();
  const detail = page.getByRole('region', { name: path.title, exact: true });
  await expect(detail).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(table).toBeVisible();
    await expect(detail).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole('button', { name: 'Refresh', exact: true }),
    ).toBeVisible();
  }
});
