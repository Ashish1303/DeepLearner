import {
  API_ORIGIN,
  WEB_ORIGIN,
} from '../../scripts/browser-backlog/lease.mjs';

type Route = {
  request(): {
    method(): string;
    allHeaders(): Promise<Record<string, string>>;
  };
  fulfill(options: {
    status: number;
    headers: Record<string, string>;
    body: string;
  }): Promise<unknown>;
};

// These later-feature panels mount beside Read/Example/Revise. Their exact,
// healthy read fixtures must not enter the PUBLIC catalog credential ledger.
// No mutation, challenge, receipt, earned progress or completion is fabricated.
export async function backgroundProgress(
  route: Route,
  url: URL,
  eligible: boolean,
  completionOnly = false,
) {
  const progress = url.pathname === '/api/v1/progress';
  const completion = url.pathname === '/api/v1/progress/completion';
  const dashboard = !completionOnly && url.pathname === '/api/v1/dashboard';
  if (
    !eligible ||
    url.origin !== API_ORIGIN ||
    (!dashboard && !completion && (!progress || completionOnly)) ||
    route.request().method() !== 'GET' ||
    (dashboard
      ? url.searchParams.size !== 1 || url.searchParams.get('limit') !== '5'
      : url.searchParams.size !== 1 ||
        !/^[a-f0-9]{24}$/.test(url.searchParams.get('conceptId') ?? ''))
  )
    return false;
  const headers = await route.request().allHeaders();
  if (
    headers.authorization !== 'Bearer synthetic-test-token' ||
    'cookie' in headers
  )
    return false;
  const conceptId = url.searchParams.get('conceptId');
  const data = dashboard
    ? { items: [], pagination: { limit: 5, nextCursor: null } }
    : progress
      ? {
          conceptId,
          status: 'NOT_STARTED',
          attemptCount: 0,
          startedAt: null,
          lastActivityAt: null,
        }
      : {
          conceptId,
          viewRevision: 'f'.repeat(64),
          requiredSections: ['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE'],
          sections: [
            { section: 'READ', status: 'MISSING' },
            { section: 'VISUALIZE', status: 'UNSUPPORTED' },
            { section: 'EXAMPLE', status: 'MISSING' },
            { section: 'PRACTICE', status: 'UNSUPPORTED' },
          ],
          practice: {
            questionId: null,
            type: null,
            status: 'UNSUPPORTED',
            score: null,
            minimumScore: 70,
          },
          eligibility: 'INELIGIBLE',
          blockers: [
            { code: 'EVIDENCE_MISSING', section: 'READ' },
            { code: 'REQUIRED_CONTENT_UNSUPPORTED', section: 'VISUALIZE' },
          ],
          completion: { status: 'NOT_COMPLETED', completedAt: null },
          visualization: null,
        };
  await route.fulfill({
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': WEB_ORIGIN,
      'Access-Control-Allow-Credentials': 'true',
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      success: true,
      data,
      message: null,
      meta: { requestId: 'background-read-fixture' },
    }),
  });
  return true;
}

export function backgroundStudent(
  user: { role: string; status: string; emailVerified: boolean },
  validSession: boolean,
) {
  return (
    validSession &&
    user.role === 'STUDENT' &&
    user.status === 'ACTIVE' &&
    user.emailVerified
  );
}
