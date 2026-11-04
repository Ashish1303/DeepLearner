import { test as base, expect, type Page } from '@playwright/test';

// PREPARED / NOT_RUN. Synthetic network only, not real API/database evidence.
// Existing separately qualified ownership-safe host/cleanup approval is mandatory.
const APP = 'http://127.0.0.1:5173',
  API = 'http://127.0.0.1:4000';
const parentId = 'a'.repeat(24),
  archiveId = 'b'.repeat(24),
  family = 'c'.repeat(24),
  id = 'd'.repeat(24);
const date = '2026-11-04T00:00:00.000Z';
const parent = {
  id: parentId,
  name: 'Synthetic Technology',
  slug: 'synthetic',
  description: null,
  iconAssetId: null,
  status: 'DRAFT',
  order: 0,
  revision: 0,
  createdAt: date,
  updatedAt: date,
};
const archived = {
  ...parent,
  id: archiveId,
  name: 'Archived Technology',
  slug: 'archived',
  status: 'ARCHIVED',
};
const user = {
  id: 'f'.repeat(24),
  firstName: 'Synthetic',
  lastName: 'Admin',
  email: 'fixture@example.test',
  role: 'ADMIN',
  status: 'ACTIVE',
  emailVerified: true,
  plan: 'FREE',
  authMethods: ['PASSWORD'],
  profile: null,
  createdAt: date,
};
const envelope = (data: unknown, meta = {}) => ({
  success: true,
  data,
  message: null,
  meta: { requestId: 'synthetic-u', ...meta },
});
type Harness = {
  parentStatus: 'DRAFT' | 'PUBLISHED';
  missingParent: boolean;
  actorId: string;
  corruptAuth: boolean;
  captureStatus: number;
  captureCode: string;
  invalid: boolean;
  lost: boolean;
  hold: boolean;
  release: () => void;
  outcome: 'COMMITTED' | 'UNRESOLVED';
  postCount: number;
  getCount: number;
  body: Record<string, unknown> | null;
  unexpected: string[];
};
const test = base.extend<{ h: Harness }>({
  h: async ({ context }, use) => {
    const held = new Set<() => void>();
    const h: Harness = {
      parentStatus: 'DRAFT',
      missingParent: false,
      actorId: user.id,
      corruptAuth: false,
      captureStatus: 200,
      captureCode: 'VALIDATION_ERROR',
      invalid: false,
      lost: false,
      hold: false,
      release() {
        for (const f of [...held]) f();
      },
      outcome: 'COMMITTED',
      postCount: 0,
      getCount: 0,
      body: null,
      unexpected: [],
    };
    await context.route('**/*', async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (url.origin === APP) {
        await route.continue();
        return;
      }
      if (url.origin !== API || !url.pathname.startsWith('/api/v1/')) {
        h.unexpected.push('UNAPPROVED_NETWORK');
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
      const send = (data: unknown, status = 200) =>
        route.fulfill({ status, headers, json: data });
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers });
        return;
      }
      if (
        request.method() === 'POST' &&
        ['/api/v1/auth/refresh', '/api/v1/auth/logout'].includes(url.pathname)
      ) {
        await send(
          envelope(
            url.pathname.endsWith('/logout')
              ? null
              : { accessToken: 'synthetic-access', expiresInSeconds: 900 },
          ),
        );
        return;
      }
      const incoming = await request.allHeaders();
      if (
        incoming.authorization !== 'Bearer synthetic-access' ||
        'cookie' in incoming
      ) {
        h.unexpected.push('AUTHORIZATION_REFUSAL');
        await route.abort();
        return;
      }
      if (url.pathname === '/api/v1/users/me' && request.method() === 'GET') {
        await send(envelope({ ...user, id: h.actorId }));
        return;
      }
      if (
        url.pathname === '/api/v1/admin/technologies' &&
        request.method() === 'GET'
      ) {
        await send(
          envelope([{ ...parent, status: h.parentStatus }, archived], {
            page: 1,
            limit: 20,
            total: 2,
            totalPages: 1,
          }),
        );
        return;
      }
      if (
        url.pathname.startsWith('/api/v1/admin/technologies/') &&
        request.method() === 'GET'
      ) {
        await send(
          envelope(
            url.pathname.endsWith(archiveId)
              ? archived
              : { ...parent, status: h.parentStatus },
          ),
        );
        return;
      }
      if (
        url.pathname === '/api/v1/admin/learning-paths' &&
        request.method() === 'GET'
      ) {
        if (h.missingParent) {
          await send(
            {
              success: false,
              error: { code: 'TECHNOLOGY_NOT_FOUND', message: 'Unavailable' },
              meta: { requestId: 'synthetic-u' },
            },
            404,
          );
          return;
        }
        await send(
          envelope([], { page: 1, limit: 20, total: 0, totalPages: 0 }),
        );
        return;
      }
      if (url.pathname.startsWith('/api/v1/admin/learning-path-proposals')) {
        if (
          request.method() === 'POST' &&
          url.pathname === '/api/v1/admin/learning-path-proposals'
        ) {
          h.postCount++;
          h.body = request.postDataJSON() as Record<string, unknown>;
          if (h.hold)
            await new Promise<void>((resolve) => {
              const done = () => {
                held.delete(done);
                resolve();
              };
              held.add(done);
            });
          if (h.lost) {
            await route.abort();
            return;
          }
          if (h.corruptAuth) {
            await route.fulfill({
              status: h.captureStatus,
              headers,
              contentType: 'application/json',
              body: 'not-json',
            });
            return;
          }
          if (h.captureStatus !== 200) {
            await send(
              {
                success: false,
                error: { code: h.captureCode, message: 'Synthetic refusal' },
                meta: { requestId: 'synthetic-u' },
              },
              h.captureStatus,
            );
            return;
          }
          await send(
            h.invalid
              ? envelope({ ...result(h), internal: 'rejected' })
              : envelope(result(h)),
          );
          return;
        }
        if (
          request.method() === 'GET' &&
          url.searchParams.get('technologyId') === parentId
        ) {
          h.getCount++;
          await send(
            envelope(
              url.pathname.includes('/operations/')
                ? h.outcome === 'COMMITTED'
                  ? { state: 'COMMITTED', proposal: result(h) }
                  : { state: 'UNRESOLVED' }
                : result(h),
            ),
          );
          return;
        }
      }
      h.unexpected.push('UNAPPROVED_REQUEST');
      await route.abort();
    });
    try {
      await use(h);
    } finally {
      h.release();
      await context.unrouteAll({ behavior: 'ignoreErrors' });
      expect(h.unexpected).toEqual([]);
    }
  },
});
function result(h: Harness) {
  const { operationId: _, technologyId: __, ...content } = h.body ?? {};
  void _;
  void __;
  return {
    ...content,
    id,
    proposalId: family,
    technologyId: parentId,
    revision: 1,
    schemaVersion: 1,
    source: { id: family, revision: 1 },
    createdAt: date,
  };
}
async function start(page: Page) {
  page.removeAllListeners('dialog');
  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Restore existing session', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Technologies', exact: true }),
  ).toBeVisible();
}
async function workspace(page: Page) {
  await page
    .getByRole('button', { name: 'Learning Paths', exact: true })
    .click();
  await page
    .getByRole('button', { name: /Synthetic Technology.*(?:DRAFT|PUBLISHED)/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Synthetic Technology Learning Paths' }),
  ).toBeVisible();
}
async function open(page: Page) {
  await page
    .getByRole('button', { name: 'Create private proposal', exact: true })
    .click();
  await expect(
    page.getByLabel('Title (required, 1–120)', { exact: true }),
  ).toBeVisible();
}
async function fill(page: Page) {
  await page
    .getByLabel('Title (required, 1–120)', { exact: true })
    .fill('Synthetic curriculum');
  await page
    .getByLabel('Audience (required, 1–500)', { exact: true })
    .fill('Developers');
  await page
    .getByLabel('Depth (required)', { exact: true })
    .selectOption('BEGINNER');
  await page
    .getByLabel('Objective 1 (required when present)', { exact: true })
    .fill('One objective');
}
const save = (page: Page) =>
  page
    .getByRole('button', { name: 'Save private proposal', exact: true })
    .click();

test('U01 default workspace and explicit proposal form only', async ({
  page,
  h,
}) => {
  await start(page);
  expect(h.postCount).toBe(0);
  await workspace(page);
  expect(h.postCount).toBe(0);
  await open(page);
  expect(h.postCount).toBe(0);
});
test('U02 DRAFT/PUBLISHED eligibility and archived/missing parent creation refusal', async ({
  page,
  h,
}) => {
  await start(page);
  await workspace(page);
  await expect(
    page.getByRole('button', { name: 'Create private proposal', exact: true }),
  ).toBeEnabled();
  h.parentStatus = 'PUBLISHED';
  await start(page);
  await workspace(page);
  await expect(
    page.getByRole('button', { name: 'Create private proposal', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: /Archived Technology.*ARCHIVED/ })
    .click();
  await expect(
    page.getByRole('button', { name: 'Create private proposal', exact: true }),
  ).toBeDisabled();
  h.missingParent = true;
  await page
    .getByRole('button', { name: /Synthetic Technology.*PUBLISHED/ })
    .click();
  await expect(
    page.getByRole('button', { name: 'Create private proposal', exact: true }),
  ).toBeDisabled();
  expect(h.postCount).toBe(0);
});

test('U03 exact fields/nulls, ordered row limits, duplicates and Unicode bounds', async ({
  page,
  h,
}) => {
  await start(page);
  await workspace(page);
  await open(page);
  await fill(page);
  const title = page.getByLabel('Title (required, 1–120)', { exact: true });
  await expect(title).toHaveAttribute('maxlength', '120');
  await title.fill(' untrimmed ');
  await save(page);
  expect(h.postCount).toBe(0);
  await expect(title).toBeFocused();
  await title.fill('😀'.repeat(60));
  await page
    .getByRole('button', { name: 'Add objective', exact: true })
    .click();
  await page
    .getByLabel('Objective 2 (required when present)', { exact: true })
    .fill('One objective');
  await save(page);
  expect(h.postCount).toBe(0);
  await page
    .getByLabel('Objective 2 (required when present)', { exact: true })
    .fill('Another objective');
  for (let row = 3; row <= 20; row++) {
    await page
      .getByRole('button', { name: 'Add objective', exact: true })
      .click();
    await page
      .getByLabel(`Objective ${row} (required when present)`, { exact: true })
      .fill(`Goal ${row}`);
  }
  await expect(
    page.getByRole('button', { name: 'Add objective', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Remove objective 2', exact: true })
    .click();
  await expect(
    page.getByLabel('Objective 2 (required when present)', { exact: true }),
  ).toHaveValue('Goal 3');
  for (let row = 1; row <= 20; row++) {
    await page
      .getByRole('button', { name: 'Add prerequisite', exact: true })
      .click();
    await page
      .getByLabel(`Prerequisite ${row} (required when present)`, {
        exact: true,
      })
      .fill(`Prerequisite ${row}`);
  }
  await expect(
    page.getByRole('button', { name: 'Add prerequisite', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Specify runtime', { exact: true }).check();
  await page
    .getByLabel('Runtime name (required, 1–80)', { exact: true })
    .fill('Node.js');
  await page.getByLabel('No runtime version', { exact: true }).uncheck();
  await page
    .getByLabel('Runtime version (required, 1–80)', { exact: true })
    .fill('24');
  await page.getByLabel('No runtime version', { exact: true }).check();
  await page.getByLabel('No Technology version', { exact: true }).uncheck();
  await page
    .getByLabel('Technology version (required, 1–80)', { exact: true })
    .fill('2026');
  await page.getByLabel('No Technology version', { exact: true }).check();
  await save(page);
  await expect(
    page.getByRole('heading', {
      name: 'Private proposal — not approved or published',
      exact: true,
    }),
  ).toBeVisible();
  expect(h.body?.runtime).toEqual({ name: 'Node.js', version: null });
  expect(h.body?.technologyVersion).toBeNull();
  expect((h.body?.objectives as string[]).length).toBe(19);
  expect((h.body?.prerequisites as unknown[]).length).toBe(20);
});

test('U04 duplicate click/Enter cannot dispatch second POST or change pending key', async ({
  page,
  h,
}) => {
  await start(page);
  await workspace(page);
  await open(page);
  await fill(page);
  h.hold = true;
  await save(page);
  await expect.poll(() => h.postCount).toBe(1);
  const key = h.body?.operationId;
  await page
    .getByRole('button', { name: 'Save private proposal', exact: true })
    .evaluate((button) => {
      if (!(button instanceof HTMLButtonElement))
        throw new Error('Expected native Save button');
      button.click();
      button.click();
    });
  await page.keyboard.press('Enter');
  expect(h.postCount).toBe(1);
  expect(h.body?.operationId).toBe(key);
  await expect(
    page.getByRole('button', { name: 'Technology Management', exact: true }),
  ).toBeDisabled();
  h.release();
  await expect(
    page.getByRole('heading', {
      name: 'Private proposal — not approved or published',
      exact: true,
    }),
  ).toBeVisible();
  expect(h.postCount).toBe(1);
});

test('U05 known result GET refresh uses parent and revision binding', async ({
  page,
  h,
}) => {
  await start(page);
  await workspace(page);
  await open(page);
  await fill(page);
  await save(page);
  await page
    .getByRole('button', { name: 'Refresh private result', exact: true })
    .click();
  await expect(
    page.getByText('Private result refreshed.', { exact: true }),
  ).toBeVisible();
  expect(h.getCount).toBe(1);
  expect(h.postCount).toBe(1);
});
test('U06 sanitized400/413/415 never resubmit automatically', async ({
  page,
  h,
}) => {
  await start(page);
  await workspace(page);
  await open(page);
  await fill(page);
  for (const [status, code] of [
    [400, 'VALIDATION_ERROR'],
    [413, 'PAYLOAD_TOO_LARGE'],
    [415, 'UNSUPPORTED_MEDIA_TYPE'],
  ] as const) {
    h.captureStatus = status;
    h.captureCode = code;
    const count = h.postCount;
    await save(page);
    await expect(
      page.getByRole('button', { name: 'Save private proposal', exact: true }),
    ).toBeEnabled();
    expect(h.postCount).toBe(count + 1);
  }
});
test('U07 corrupt401 and403 remove authority without replay', async ({
  page,
  h,
}) => {
  for (const status of [401, 403]) {
    h.corruptAuth = false;
    await start(page);
    await workspace(page);
    await open(page);
    await fill(page);
    h.captureStatus = status;
    h.corruptAuth = true;
    const previous = h.postCount;
    await save(page);
    await expect(
      page.getByLabel('Title (required, 1–120)', { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', {
        name: 'Restore existing session',
        exact: true,
      }),
    ).toBeVisible();
    expect(h.postCount).toBe(previous + 1);
  }
});

test('U08 operation conflict retains GET recovery and no replacement key', async ({
  page,
  h,
}) => {
  await start(page);
  await workspace(page);
  await open(page);
  await fill(page);
  h.captureStatus = 409;
  h.captureCode = 'PROPOSAL_CONFLICT';
  await save(page);
  await expect(
    page.getByRole('button', { name: 'Check save outcome', exact: true }),
  ).toBeVisible();
  expect(h.postCount).toBe(1);
  await expect(
    page.getByRole('button', { name: 'Save private proposal', exact: true }),
  ).toHaveCount(0);
});
test('U09 rate refusal has no retry loop', async ({ page, h }) => {
  await start(page);
  await workspace(page);
  await open(page);
  await fill(page);
  h.captureStatus = 429;
  h.captureCode = 'RATE_LIMIT_EXCEEDED';
  await save(page);
  await expect(page.getByRole('alert')).toContainText('Too many requests');
  expect(h.postCount).toBe(1);
});
test('U10 lost503 and invalid capture remain uncertain without automatic POST', async ({
  page,
  h,
}) => {
  for (const fault of ['lost', '503', 'invalid']) {
    h.lost = false;
    h.invalid = false;
    h.captureStatus = 200;
    await start(page);
    await workspace(page);
    await open(page);
    await fill(page);
    h.lost = fault === 'lost';
    h.invalid = fault === 'invalid';
    if (fault === '503') {
      h.captureStatus = 503;
      h.captureCode = 'PROPOSAL_OUTCOME_UNKNOWN';
    }
    const previous = h.postCount;
    await save(page);
    await expect(
      page.getByRole('button', { name: 'Check save outcome', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Save private proposal', exact: true }),
    ).toHaveCount(0);
    expect(h.postCount).toBe(previous + 1);
  }
});

test('U11 explicit COMMITTED recovery resolves exact frozen content without replay', async ({
  page,
  h,
}) => {
  await start(page);
  await workspace(page);
  await open(page);
  await fill(page);
  h.captureStatus = 503;
  h.captureCode = 'PROPOSAL_OUTCOME_UNKNOWN';
  await save(page);
  await page
    .getByRole('button', { name: 'Check save outcome', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Private proposal — not approved or published',
      exact: true,
    }),
  ).toBeVisible();
  expect(h.postCount).toBe(1);
  expect(h.getCount).toBe(1);
});
test('U12 UNRESOLVED retains guard after unrelated workspace reads', async ({
  page,
  h,
}) => {
  await start(page);
  await workspace(page);
  await open(page);
  await fill(page);
  h.lost = true;
  h.outcome = 'UNRESOLVED';
  await save(page);
  await page
    .getByRole('button', { name: 'Check save outcome', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('UNRESOLVED');
  await page
    .getByRole('button', { name: 'Technology Management', exact: true })
    .click();
  await workspace(page);
  await expect(
    page.getByRole('button', { name: 'Check save outcome', exact: true }),
  ).toBeVisible();
  expect(h.postCount).toBe(1);
});
test('U13 dirty navigation choice and reload lose memory without automatic recovery', async ({
  page,
  h,
}) => {
  await start(page);
  await workspace(page);
  await open(page);
  await fill(page);
  await page
    .getByRole('button', { name: 'Technology Management', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Discard unsaved brief?', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(
    page.getByLabel('Title (required, 1–120)', { exact: true }),
  ).toHaveValue('Synthetic curriculum');
  await page
    .getByRole('button', { name: 'Technology Management', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Discard draft', exact: true })
    .click();
  await workspace(page);
  await open(page);
  await expect(
    page.getByLabel('Title (required, 1–120)', { exact: true }),
  ).toHaveValue('');
  await fill(page);
  h.lost = true;
  await save(page);
  await expect(
    page.getByRole('button', { name: 'Check save outcome', exact: true }),
  ).toBeVisible();
  const reads = h.getCount,
    writes = h.postCount;
  await page.reload();
  await page
    .getByRole('button', { name: 'Restore existing session', exact: true })
    .click();
  await workspace(page);
  await open(page);
  await expect(
    page.getByLabel('Title (required, 1–120)', { exact: true }),
  ).toHaveValue('');
  await expect(
    page.getByText(/Reload or closing this page loses them/),
  ).toBeVisible();
  expect(h.getCount).toBe(reads);
  expect(h.postCount).toBe(writes);
});

test('U14 selection/workspace return and account change suppress late private data', async ({
  page,
  h,
}) => {
  await start(page);
  await workspace(page);
  await open(page);
  await fill(page);
  h.lost = true;
  await save(page);
  await page
    .getByRole('button', { name: /Archived Technology.*ARCHIVED/ })
    .click();
  await expect(
    page.getByRole('button', { name: 'Check save outcome', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: /Synthetic Technology.*DRAFT/ })
    .click();
  await expect(
    page.getByRole('button', { name: 'Check save outcome', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Technology Management', exact: true })
    .click();
  await workspace(page);
  await expect(
    page.getByRole('button', { name: 'Check save outcome', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Sign out of this device', exact: true })
    .click();
  h.actorId = 'e'.repeat(24);
  await page
    .getByRole('button', { name: 'Restore existing session', exact: true })
    .click();
  await workspace(page);
  await expect(
    page.getByRole('alert').filter({ hasText: /Recovery context was lost/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Create private proposal', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText('Synthetic curriculum', { exact: true }),
  ).toHaveCount(0);
  expect(h.postCount).toBe(1);
  // A fresh document represents a new root; explicitly start a distinct synthetic test intent.
  h.lost = false;
  await start(page);
  await workspace(page);
  await open(page);
  await fill(page);
  h.hold = true;
  await save(page);
  await expect.poll(() => h.postCount).toBe(2);
  await page
    .getByRole('button', { name: 'Sign out of this device', exact: true })
    .click();
  h.release();
  await expect(
    page.getByRole('button', { name: 'Restore existing session', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Synthetic curriculum', { exact: true }),
  ).toHaveCount(0);
});

test('U15 keyboard validation focus, announcements and compact saved feedback', async ({
  page,
}) => {
  await start(page);
  await workspace(page);
  await open(page);
  await save(page);
  await expect(
    page.getByLabel('Title (required, 1–120)', { exact: true }),
  ).toBeFocused();
  await fill(page);
  await save(page);
  await expect(
    page.getByRole('status').filter({ hasText: 'Private proposal saved' }),
  ).toBeVisible();
});
test('U16 loaded1440/768/390/320 layouts exclude mutation/editorial controls', async ({
  page,
}) => {
  await start(page);
  await workspace(page);
  await open(page);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole('button', { name: 'Save private proposal', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole('button', { name: /^(Approve|Publish|Delete|Generate)/ }),
    ).toHaveCount(0);
  }
});
