import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from '@playwright/test';
// Separately gated mounted tests. Mocked HTTP contracts, never a live database.
// Twelve PREPARED/NOT_RUN UI-contract cases. HTTP interception is not evidence
// of real authentication, MongoDB transactions, rubric authority or durability.
const cid = 'a'.repeat(24),
  other = 'b'.repeat(24),
  uid = '1'.repeat(24);
const envelope = (data: unknown) => ({
  success: true,
  message: null,
  data,
  meta: { requestId: 'f037-browser' },
});
const headers = {
  'Access-Control-Allow-Origin': 'http://127.0.0.1:3000',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'authorization,content-type,idempotency-key',
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

const required = ['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE'] as const;
function completionView(conceptId = cid, eligible = false) {
  return {
    conceptId,
    viewRevision: 'd'.repeat(64),
    requiredSections: [...required] as string[],
    sections: required.map((section) => ({
      section: section as string,
      status: eligible ? 'QUALIFIED' : 'MISSING',
    })),
    practice: {
      questionId: '9'.repeat(24),
      type: 'OUTPUT',
      status: eligible ? 'QUALIFIED' : 'MISSING',
      score: eligible ? 100 : (null as number | null),
      minimumScore: 70,
    },
    eligibility: eligible ? 'ELIGIBLE' : 'INELIGIBLE',
    blockers: eligible
      ? ([] as { code: string; section?: string }[])
      : [{ code: 'EVIDENCE_MISSING', section: 'READ' }],
    completion: { status: 'NOT_COMPLETED', completedAt: null as string | null },
    visualization: {
      id: '7'.repeat(24),
      graph: {
        type: 'ANIMATED_FLOW',
        schemaVersion: 1,
        title: 'Retained node',
        textAlternative: 'A single retained node.',
        nodes: [{ id: 'retained', label: 'Retained' }],
        edges: [],
        steps: [
          {
            title: 'Observe',
            explanation: 'The node remains.',
            nodeIds: ['retained'],
            edgeIds: [],
          },
        ],
      },
    },
  };
}
const panel = (page: Page) =>
  page.getByRole('region', { name: 'Concept completion', exact: true });
async function setup(context: BrowserContext) {
  const existing = await mock(context);
  const state = {
    view: completionView(),
    fault: 0,
    loseReply: false,
    hold: false,
    held: [] as Route[],
    commands: [] as { key: string; body: unknown; path: string }[],
    calls: 0,
    challengeSection: 'READ',
  };
  await context.route('**/api/v1/progress/completion**', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    state.calls++;
    const send = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        headers,
        contentType: 'application/json',
        body: JSON.stringify(
          status === 200
            ? envelope(data)
            : {
                success: false,
                error: {
                  code:
                    status === 503
                      ? 'DEPENDENCY_UNAVAILABLE'
                      : 'AUTH_FORBIDDEN',
                  message: 'Unavailable',
                },
                meta: { requestId: 'f038-browser' },
              },
        ),
      });
    if (state.hold) {
      state.held.push(route);
      return;
    }
    if (state.fault) {
      await send(null, state.fault);
      return;
    }
    if (request.method() === 'GET') {
      await send({
        ...state.view,
        conceptId: url.searchParams.get('conceptId'),
      });
      return;
    }
    const body = request.postDataJSON(),
      h = await request.allHeaders();
    state.commands.push({
      key: h['idempotency-key'] ?? '',
      body,
      path: url.pathname,
    });
    if (url.pathname.endsWith('/complete')) {
      state.view.completion = {
        status: 'COMPLETED',
        completedAt: '2026-10-20T10:00:00.000Z',
      };
      if (state.loseReply) {
        state.loseReply = false;
        await route.abort();
        return;
      }
      await send(state.view);
      return;
    }
    if (url.pathname.endsWith('/challenges')) {
      const section = body.section;
      state.challengeSection = section;
      await send(
        section === 'VISUALIZE'
          ? {
              section,
              challenge: {
                id: '8'.repeat(24),
                conceptId: cid,
                visualizationId: '7'.repeat(24),
                checkpointId: 'node',
                checkpointVersion: 1,
                policyId: 'visual',
                policyVersion: 1,
                prompt: 'Which node remains?',
                textAlternative:
                  'A single retained node is visible in the textual flow.',
                choices: [
                  { id: 'yes', label: 'Retained' },
                  { id: 'no', label: 'Absent' },
                ],
                expiresAt: '2099-01-01T00:00:00.000Z',
              },
            }
          : {
              section,
              challenge: {
                id: '8'.repeat(24),
                conceptId: cid,
                section,
                conceptRevision: 'd'.repeat(64),
                sectionRevision: 'e'.repeat(64),
                policyId: 'ack',
                policyVersion: 1,
                expiresAt: '2099-01-01T00:00:00.000Z',
              },
            },
      );
      return;
    }
    if (url.pathname.endsWith('/responses')) {
      const section = state.challengeSection,
        correct = body.selectedChoiceId === 'yes';
      if (section !== 'VISUALIZE' || correct)
        state.view.sections.find((s) => s.section === section)!.status =
          'QUALIFIED';
      await send(
        section === 'VISUALIZE'
          ? {
              section,
              receipt: {
                id: '6'.repeat(24),
                conceptId: cid,
                visualizationId: '7'.repeat(24),
                checkpointId: 'node',
                checkpointVersion: 1,
                outcome: correct ? 'CORRECT' : 'INCORRECT',
                respondedAt: '2026-10-20T10:00:00.000Z',
                completionQualification: 'NOT_ESTABLISHED',
              },
            }
          : {
              section,
              receipt: {
                id: '6'.repeat(24),
                conceptId: cid,
                section,
                acknowledgedAt: '2026-10-20T10:00:00.000Z',
                completionQualification: 'NOT_ESTABLISHED',
              },
            },
      );
      return;
    }
    await route.abort();
  });
  return { state, existing };
}
async function open(page: Page) {
  await page.goto('/concepts/' + cid);
  await expect(panel(page)).toBeVisible();
}
test('F038 required requirements, explicit completion, reload and activity stay separate', async ({
  page,
  context,
}) => {
  const m = await setup(context);
  m.state.view = completionView(cid, true);
  await open(page);
  await panel(page)
    .getByRole('button', { name: 'Complete Concept', exact: true })
    .click();
  await expect(panel(page)).toContainText('Concept completed. Saved at');
  await page.reload();
  await expect(panel(page)).toContainText('Concept completed. Saved at');
  await expect(
    page.getByRole('region', { name: 'Saved practice activity' }),
  ).toContainText('No saved attempts');
  expect(m.state.commands).toHaveLength(1);
});
test('F038 views and playback without acknowledged required evidence never qualify', async ({
  page,
  context,
}) => {
  const m = await setup(context);
  await open(page);
  await expect(
    panel(page).getByRole('button', { name: 'Complete Concept', exact: true }),
  ).toBeDisabled();
  await expect(panel(page)).toContainText('Visualize: Missing');
  await expect(panel(page)).toContainText('Practice: Missing');
  expect(m.state.commands).toHaveLength(0);
});
test('F038 original zero score cannot meet seventy or be replaced by a copied retry', async ({
  page,
  context,
}) => {
  const m = await setup(context);
  m.state.view.practice = {
    ...m.state.view.practice,
    status: 'BELOW_THRESHOLD',
    score: 0,
  };
  m.state.view.blockers = [
    { code: 'PRACTICE_SCORE_BELOW_THRESHOLD', section: 'PRACTICE' },
  ];
  await open(page);
  await expect(panel(page)).toContainText('Original qualifying score: 0%');
  await expect(panel(page)).toContainText('Practice threshold: 70%');
  await expect(panel(page)).toContainText(
    'reveal-assisted retries cannot replace',
  );
  await expect(
    panel(page).getByRole('button', { name: 'Complete Concept', exact: true }),
  ).toBeDisabled();
});
test('F038 Example and conditional Revise coverage remain required', async ({
  page,
  context,
}) => {
  const m = await setup(context);
  m.state.view.requiredSections.push('REVISE');
  m.state.view.sections.push({ section: 'REVISE', status: 'UNSUPPORTED' });
  await open(page);
  await expect(panel(page)).toContainText('Example: Missing');
  await expect(panel(page)).toContainText('Revise: Unavailable');
  await expect(panel(page)).not.toContainText('Revise is optional');
});
test('F038 denied accounts do not display or retain completion data', async ({
  page,
  context,
}) => {
  const m = await setup(context);
  m.state.fault = 403;
  await open(page);
  await expect(panel(page)).toContainText('Completion access is unavailable');
  await expect(
    panel(page).getByRole('button', { name: 'Complete Concept', exact: true }),
  ).toHaveCount(0);
  expect(m.state.commands).toHaveLength(0);
});
test('F038 Concept navigation cancels late views', async ({
  page,
  context,
}) => {
  const m = await setup(context);
  m.state.hold = true;
  await open(page);
  await expect(panel(page)).toContainText('Loading');
  m.state.hold = false;
  await page.goto('/concepts/' + other);
  for (const route of m.state.held.splice(0))
    await route
      .fulfill({
        headers,
        contentType: 'application/json',
        body: JSON.stringify(
          envelope({
            ...completionView(cid, true),
            completion: {
              status: 'COMPLETED',
              completedAt: '2026-10-20T10:00:00.000Z',
            },
          }),
        ),
      })
      .catch(() => {});
  await expect(panel(page)).not.toContainText('Concept completed. Saved at');
});
test('F038 interrupted completion retries its original UUID and body', async ({
  page,
  context,
}) => {
  const m = await setup(context);
  m.state.view = completionView(cid, true);
  m.state.loseReply = true;
  await open(page);
  await panel(page)
    .getByRole('button', { name: 'Complete Concept', exact: true })
    .click();
  await panel(page)
    .getByRole('button', { name: 'Retry unchanged request' })
    .click();
  await expect(panel(page)).toContainText('Concept completed. Saved at');
  expect(m.state.commands).toHaveLength(2);
  expect(m.state.commands[0]).toEqual(m.state.commands[1]);
  expect(m.state.commands[0]!.key).toMatch(/^[0-9a-f-]{36}$/);
});
test('F038 checkpoint refusal cannot reveal expected choices or qualify interaction', async ({
  page,
  context,
}) => {
  const m = await setup(context);
  await open(page);
  m.state.fault = 503;
  await panel(page)
    .getByRole('button', { name: 'Request visualization checkpoint' })
    .click();
  await expect(panel(page)).toContainText('outcome is unconfirmed');
  await expect(panel(page).getByRole('radio')).toHaveCount(0);
  await expect(panel(page)).not.toContainText('expectedChoiceId');
  m.state.fault = 0;
  await panel(page)
    .getByRole('button', { name: 'Retry unchanged request' })
    .click();
  await expect(
    panel(page).getByRole('button', { name: 'Submit checkpoint response' }),
  ).toBeDisabled();
  await panel(page).getByRole('radio', { name: 'Absent', exact: true }).check();
  await panel(page)
    .getByRole('button', { name: 'Submit checkpoint response' })
    .click();
  await expect(panel(page)).toContainText('Visualize: Missing');
  await panel(page)
    .getByRole('button', { name: 'Request visualization checkpoint' })
    .click();
  await panel(page)
    .getByRole('radio', { name: 'Retained', exact: true })
    .check();
  await panel(page)
    .getByRole('button', { name: 'Submit checkpoint response' })
    .click();
  await expect(panel(page)).toContainText('Visualize: Qualified');
  await expect(
    panel(page).getByRole('button', { name: 'Complete Concept', exact: true }),
  ).toBeDisabled();
});
test('F038 stale and revoked server views never silently restore completion', async ({
  page,
  context,
}) => {
  const m = await setup(context);
  m.state.view.completion = {
    status: 'STALE',
    completedAt: '2026-10-20T10:00:00.000Z',
  };
  await open(page);
  await expect(panel(page)).toContainText(
    'Previous completion is no longer current',
  );
  m.state.view.completion.status = 'REVOKED';
  await panel(page)
    .getByRole('button', { name: 'Refresh requirements' })
    .click();
  await expect(panel(page)).toContainText(
    'Previous completion is no longer current',
  );
  expect(m.state.commands).toHaveLength(0);
});
test('F038 keyboard and reduced motion do not require playback', async ({
  page,
  context,
}) => {
  await setup(context);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const button = panel(page).getByRole('button', {
    name: 'Prepare Read acknowledgement',
  });
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    panel(page).getByRole('button', { name: 'Acknowledge Read' }),
  ).toBeVisible();
  await expect(panel(page)).toContainText('not comprehension');
  await expect(panel(page)).toContainText(
    'Playback and timing are not required',
  );
});
test('F038 responsive loading, unavailable and error states preserve reflow', async ({
  page,
  context,
}) => {
  const m = await setup(context);
  m.state.fault = 503;
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    await expect(
      panel(page).getByRole('button', { name: 'Retry requirements' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  }
  m.state.fault = 404;
  await panel(page).getByRole('button', { name: 'Retry requirements' }).click();
  await expect(panel(page)).toContainText('approved synthetic Concepts only');
});
test('F038 Practice navigation preserves output default and unsupported grading stays ineligible', async ({
  page,
  context,
}) => {
  const m = await setup(context);
  m.state.view.practice.status = 'UNSUPPORTED';
  m.state.view.blockers = [
    { code: 'REQUIRED_CONTENT_UNSUPPORTED', section: 'PRACTICE' },
  ];
  await open(page);
  await expect(
    panel(page).getByRole('link', { name: 'Open Practice output questions' }),
  ).toHaveAttribute('href', '/concepts/' + cid + '/practice');
  await expect(
    panel(page).getByRole('button', { name: 'Complete Concept', exact: true }),
  ).toBeDisabled();
  await expect(panel(page)).not.toContainText('expectedAnswer');
  await panel(page)
    .getByRole('link', { name: 'Open Practice output questions' })
    .click();
  await expect(page).toHaveURL(new RegExp('/concepts/' + cid + '/practice$'));
});
