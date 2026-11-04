import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { createAdminController } from '../src/lib/auth/admin-controller';
import type { AdminClient } from '../src/lib/auth/admin-client';
import type {
  AdminControl,
  AdminCoordination,
} from '../src/lib/auth/browser-coordination';
import {
  createProposalClient,
  ProposalError,
} from '../src/lib/learning-path-proposals/proposal-client';
import { createProposalController } from '../src/lib/learning-path-proposals/proposal-controller';
import {
  emptyDraft,
  type ProposalContent,
} from '../src/lib/learning-path-proposals/contracts';
import type { Technology } from '../src/lib/technologies/contracts';

const accountId = 'a'.repeat(24),
  technologyId = 'b'.repeat(24),
  family = 'c'.repeat(24),
  revisionId = 'd'.repeat(24);
const content: ProposalContent = {
  title: 'Synthetic curriculum',
  objectives: ['A goal'],
  audience: 'Developers',
  depth: 'BEGINNER',
  runtime: null,
  technologyVersion: null,
  prerequisites: [],
};
const dto = {
  ...content,
  id: revisionId,
  proposalId: family,
  technologyId,
  revision: 1,
  schemaVersion: 1,
  source: { id: family, revision: 1 },
  createdAt: '2026-11-04T00:00:00.000Z',
};
const parent: Technology = {
  id: technologyId,
  name: 'Synthetic Technology',
  slug: 'synthetic',
  description: null,
  iconAssetId: null,
  status: 'DRAFT',
  order: 0,
  revision: 0,
  createdAt: dto.createdAt,
  updatedAt: dto.createdAt,
};
const user = {
  id: accountId,
  firstName: 'Synthetic',
  lastName: 'Admin',
  email: 'admin@example.test',
  role: 'ADMIN' as const,
  status: 'ACTIVE' as const,
  emailVerified: true,
  plan: 'FREE' as const,
  authMethods: ['PASSWORD' as const],
  profile: null,
  createdAt: dto.createdAt,
};
const wrap = (data: unknown) => ({
  success: true,
  data,
  message: null,
  meta: { requestId: 'synthetic-u' },
});
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
const refusal = (status: number, code: string) =>
  response(
    {
      success: false,
      error: { code, message: 'PRIVATE_EXCEPTION' },
      meta: { requestId: 'synthetic' },
    },
    status,
  );
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function fixture(t: TestContext) {
  let now = 0,
    current = user,
    route: (url: string, init?: RequestInit) => Promise<Response> = async () =>
      response(wrap(dto));
  const calls: { method: string; path: string; body: unknown }[] = [];
  let receive: ((value: AdminControl) => void) | undefined;
  const coordination: AdminCoordination = {
    supported: () => true,
    async run(work, signal) {
      signal?.throwIfAborted();
      return work();
    },
    publish() {},
    listen(fn) {
      receive = fn;
      return () => {
        receive = undefined;
      };
    },
  };
  const api: AdminClient = {
    async login() {
      return {
        accessToken: 'synthetic-access',
        expiresInSeconds: 900,
        user: {
          id: current.id,
          firstName: current.firstName,
          lastName: current.lastName,
          email: current.email,
          role: current.role,
          status: current.status,
          plan: current.plan,
        },
      };
    },
    async refresh() {
      return { accessToken: 'synthetic-access', expiresInSeconds: 900 };
    },
    async me() {
      return current;
    },
    async logout() {
      return null;
    },
  };
  const transport = createProposalClient(
    'http://127.0.0.1:4000/api/v1',
    async (url, init) => {
      calls.push({
        method: init?.method ?? 'GET',
        path: new URL(String(url)).pathname,
        body: init?.body ? JSON.parse(init.body as string) : null,
      });
      return route(String(url), init);
    },
    () => now,
  );
  const auth = createAdminController(
    api,
    coordination,
    () => now,
    undefined,
    undefined,
    transport,
  );
  auth.connect();
  const controller = createProposalController(auth, accountId);
  controller.connect();
  t.after(() => {
    controller.dispose();
    auth.dispose();
  });
  return {
    auth,
    controller,
    calls,
    parent,
    route(fn: typeof route) {
      route = fn;
    },
    advance(ms: number) {
      now += ms;
    },
    emit(value: AdminControl) {
      receive?.(value);
    },
    switchAccount() {
      current = { ...user, id: 'f'.repeat(24) };
    },
    async ready() {
      await auth.restore();
      controller.setParent(parent);
      controller.open();
    },
    edit() {
      controller.edit(content);
    },
  };
}
test('fresh login and restoration admit only settled authority; mounting is passive', async (t) => {
  const f = fixture(t);
  assert.equal(f.calls.length, 0);
  await f.ready();
  assert.equal(f.calls.length, 0);
  assert.equal(f.controller.getSnapshot().status, 'editing');
  await assert.rejects(
    f.auth.requestProposal('f'.repeat(24), {
      kind: 'capture',
      technologyId,
      input: content,
    }),
    ProposalError,
  );
  assert.equal(f.calls.length, 0);
  f.edit();
  await f.controller.save();
  assert.equal(f.controller.getSnapshot().status, 'saved');
  assert.equal(f.calls.length, 1);
  const state = JSON.stringify(f.controller.getSnapshot());
  assert(!state.includes('synthetic-access'));
  assert(!state.includes('operationId'));
});
test('form validation does not allocate or dispatch for missing/invalid fields', async (t) => {
  const f = fixture(t);
  await f.ready();
  await f.controller.save();
  assert.equal(f.calls.length, 0);
  assert(f.controller.getSnapshot().errors.title);
  f.controller.edit({ ...content, title: ' untrimmed ' });
  await f.controller.save();
  assert.equal(f.calls.length, 0);
  assert(f.controller.getSnapshot().errors.title);
  f.controller.edit({ ...content, unknown: 'forbidden' });
  assert.equal(f.controller.getSnapshot().draft.title, ' untrimmed ');
});
test('single-submit latches before await and root independently blocks duplicate capture', async (t) => {
  const f = fixture(t),
    held = deferred<Response>();
  await f.ready();
  f.route(async () => held.promise);
  f.edit();
  const first = f.controller.save();
  await f.controller.save();
  await assert.rejects(
    f.auth.requestProposal(accountId, {
      kind: 'capture',
      technologyId,
      input: content,
    }),
    ProposalError,
  );
  await flush();
  assert.equal(f.calls.length, 1);
  assert.equal(f.controller.isBusy(), true);
  assert.equal(f.controller.leave(), false);
  held.resolve(response(wrap(dto)));
  await first;
  assert.equal(f.controller.getSnapshot().status, 'saved');
  assert.equal(f.calls.length, 1);
});
for (const [status, code] of [
  [400, 'VALIDATION_ERROR'],
  [404, 'TECHNOLOGY_NOT_FOUND'],
  [413, 'PAYLOAD_TOO_LARGE'],
  [415, 'UNSUPPORTED_MEDIA_TYPE'],
  [429, 'RATE_LIMIT_EXCEEDED'],
] as const)
  test(
    'verified ' + status + ' refusal stays editable without automatic POST',
    async (t) => {
      const f = fixture(t);
      await f.ready();
      f.route(async () => refusal(status, code));
      f.edit();
      await f.controller.save();
      assert.equal(f.calls.length, 1);
      assert.equal(f.auth.getProposalIntent(accountId).phase, 'none');
      assert.equal(f.controller.getSnapshot().status, 'refused');
      assert(f.controller.canEdit());
      assert(f.controller.getSnapshot().dirty);
      assert(!f.controller.getSnapshot().message.includes('PRIVATE'));
    },
  );
for (const fault of [
  'network',
  '503',
  'invalid',
  'wrong-content',
  '409',
] as const)
  test(
    fault + ' preserves the original key and forbids new capture',
    async (t) => {
      const f = fixture(t);
      await f.ready();
      f.route(async () => {
        if (fault === 'network') throw Error('PRIVATE_NETWORK');
        if (fault === '503') return refusal(503, 'PROPOSAL_OUTCOME_UNKNOWN');
        if (fault === '409') return refusal(409, 'PROPOSAL_CONFLICT');
        if (fault === 'wrong-content')
          return response(wrap({ ...dto, title: 'Other' }));
        return response({ success: true });
      });
      f.edit();
      await f.controller.save();
      assert.equal(f.controller.getSnapshot().status, 'uncertain');
      assert.equal(f.controller.canEdit(), false);
      const first = f.calls[0]?.body as { operationId: string };
      f.route(async () => response(wrap({ state: 'UNRESOLVED' })));
      await f.controller.recover();
      assert.equal(f.controller.getSnapshot().status, 'unresolved');
      assert.equal(f.auth.getProposalIntent(accountId).phase, 'unresolved');
      assert(f.calls[1]?.path.endsWith('/' + first.operationId));
      await f.controller.save();
      await assert.rejects(
        f.auth.requestProposal(accountId, {
          kind: 'capture',
          technologyId,
          input: content,
        }),
        ProposalError,
      );
      assert.deepEqual(
        f.calls.map((c) => c.method),
        ['POST', 'GET'],
      );
    },
  );
test('explicit COMMITTED exact content resolves the guard; unrelated detail does not', async (t) => {
  const f = fixture(t);
  await f.ready();
  f.route(async () => refusal(503, 'PROPOSAL_OUTCOME_UNKNOWN'));
  f.edit();
  await f.controller.save();
  f.route(async () => response(wrap(dto)));
  await f.auth.requestProposal(accountId, {
    kind: 'detail',
    technologyId,
    id: revisionId,
  });
  assert.equal(f.auth.getProposalIntent(accountId).phase, 'uncertain');
  f.route(async () => response(wrap({ state: 'COMMITTED', proposal: dto })));
  await f.controller.recover();
  assert.equal(f.controller.getSnapshot().status, 'resolved');
  assert.equal(f.auth.getProposalIntent(accountId).phase, 'none');
  assert.deepEqual(
    f.calls.map((c) => c.method),
    ['POST', 'GET', 'GET'],
  );
});
test('COMMITTED mismatched content or parent never releases original intent', async (t) => {
  for (const change of [
    { title: 'Other' },
    { technologyId: family },
    { source: { id: family, revision: 2 } },
    { definitionDigest: 'secret' },
  ]) {
    const f = fixture(t);
    await f.ready();
    f.route(async () => refusal(503, 'PROPOSAL_OUTCOME_UNKNOWN'));
    f.edit();
    await f.controller.save();
    f.route(async () =>
      response(wrap({ state: 'COMMITTED', proposal: { ...dto, ...change } })),
    );
    await f.controller.recover();
    assert.equal(f.auth.getProposalIntent(accountId).phase, 'unresolved');
    assert.equal(f.controller.getSnapshot().status, 'unresolved');
    assert.equal(f.controller.getSnapshot().result, null);
  }
});
test('workspace unmount preserves only same-authority frozen intent, ordinary drafts are lost', async (t) => {
  const f = fixture(t);
  await f.ready();
  f.edit();
  assert(f.controller.getSnapshot().dirty);
  f.controller.leave();
  assert.deepEqual(f.controller.getSnapshot().draft, emptyDraft());
  f.controller.open();
  f.edit();
  f.route(async () => refusal(503, 'PROPOSAL_OUTCOME_UNKNOWN'));
  await f.controller.save();
  f.controller.dispose();
  const returned = createProposalController(f.auth, accountId);
  returned.connect();
  returned.setParent({ ...parent, id: family });
  assert(!JSON.stringify(returned.getSnapshot()).includes(content.title));
  assert.equal(returned.canEdit(), false);
  returned.setParent(parent);
  assert.equal(returned.getSnapshot().draft.title, content.title);
  assert.equal(returned.getSnapshot().status, 'uncertain');
  returned.dispose();
  assert.equal(f.calls.length, 1);
});
test('logout after possible dispatch drops all content, retains content-free loss guard across next login', async (t) => {
  const f = fixture(t),
    held = deferred<Response>();
  await f.ready();
  f.route(async () => held.promise);
  f.edit();
  const work = f.controller.save();
  await flush();
  await f.auth.logout();
  held.resolve(response(wrap(dto)));
  await work;
  assert.equal(f.controller.getSnapshot().result, null);
  assert(!JSON.stringify(f.controller.getSnapshot()).includes(content.title));
  assert.deepEqual(f.auth.getProposalIntent(accountId), {
    phase: 'context-lost',
  });
  f.switchAccount();
  await f.auth.restore();
  assert.deepEqual(f.auth.getProposalIntent('f'.repeat(24)), {
    phase: 'context-lost',
  });
  await assert.rejects(
    f.auth.requestProposal('f'.repeat(24), {
      kind: 'capture',
      technologyId,
      input: content,
    }),
    ProposalError,
  );
  assert.equal(f.calls.length, 1);
});
test('authority invalidation on corrupt 401/403 suppresses all private state', async (t) => {
  for (const status of [401, 403]) {
    const f = fixture(t);
    await f.ready();
    f.route(async () => new Response('PRIVATE', { status }));
    f.edit();
    await f.controller.save();
    assert.equal(f.auth.getSnapshot().user, null);
    assert.equal(f.controller.getSnapshot().result, null);
    assert(!JSON.stringify(f.controller.getSnapshot()).includes(content.title));
    assert.equal(f.auth.getProposalIntent(accountId).phase, 'context-lost');
  }
});
test('late response after Technology selection or read cancellation cannot overwrite current view', async (t) => {
  const f = fixture(t),
    held = deferred<Response>();
  await f.ready();
  f.edit();
  await f.controller.save();
  f.route(async () => held.promise);
  const work = f.controller.detail();
  await flush();
  f.controller.setParent({ ...parent, id: family, name: 'Other' });
  held.resolve(response(wrap(dto)));
  await work;
  assert.equal(f.controller.getSnapshot().result, null);
  assert.equal(f.controller.getSnapshot().parent?.id, family);
});
test('deadline after dispatch is uncertain even when timer callback is delayed', async (t) => {
  const f = fixture(t);
  await f.ready();
  f.route(async () => {
    f.advance(15000);
    return response(wrap(dto));
  });
  f.edit();
  await f.controller.save();
  assert.equal(f.controller.getSnapshot().status, 'uncertain');
  assert.equal(f.auth.getProposalIntent(accountId).phase, 'uncertain');
  assert.equal(f.calls.length, 1);
});
test('absent secure UUID support fails closed before dispatch; no fallback identity', async (t) => {
  const f = fixture(t);
  await f.ready();
  t.mock.method(globalThis.crypto, 'randomUUID', () => {
    throw Error('unsupported');
  });
  f.edit();
  await f.controller.save();
  assert.equal(f.calls.length, 0);
  assert.equal(f.auth.getProposalIntent(accountId).phase, 'none');
  assert.equal(f.controller.getSnapshot().status, 'refused');
});
test('parent eligibility and invalid descriptors cannot send capture', async (t) => {
  const f = fixture(t);
  await f.ready();
  f.controller.setParent({ ...parent, status: 'ARCHIVED' });
  f.controller.open();
  f.edit();
  await f.controller.save();
  assert.equal(f.calls.length, 0);
  assert.equal(f.controller.canEdit(), false);
  await assert.rejects(
    f.auth.requestProposal(accountId, {
      kind: 'capture',
      technologyId,
      input: { ...content, actorId: accountId },
    } as never),
    ProposalError,
  );
  assert.equal(f.calls.length, 0);
});
test('known private detail is a GET; safe read error never dispatches replacement Save', async (t) => {
  const f = fixture(t);
  await f.ready();
  f.edit();
  await f.controller.save();
  f.route(async () => refusal(404, 'PROPOSAL_NOT_FOUND'));
  await f.controller.detail();
  assert.equal(f.controller.getSnapshot().status, 'read-error');
  assert.equal(f.calls.filter((c) => c.method === 'POST').length, 1);
  f.route(async () => response(wrap(dto)));
  await f.controller.detail();
  assert.equal(f.controller.getSnapshot().status, 'saved');
  assert.equal(f.calls.filter((c) => c.method === 'POST').length, 1);
});
test('refreshed missing, changed or archived parent preserves dirty inputs until explicit discard', async (t) => {
  for (const next of [
    null,
    { ...parent, id: family },
    { ...parent, status: 'ARCHIVED' as const },
  ]) {
    const f = fixture(t);
    await f.ready();
    f.edit();
    f.controller.setParent(next);
    assert.equal(f.controller.getSnapshot().draft.title, content.title);
    assert(f.controller.getSnapshot().dirty);
    assert.equal(f.controller.canEdit(), false);
    assert(f.controller.getSnapshot().message.includes('discard'));
    assert.equal(f.calls.length, 0);
    f.controller.leave();
    assert.deepEqual(f.controller.getSnapshot().draft, emptyDraft());
    assert.equal(f.controller.getSnapshot().parent?.id, next?.id);
  }
});
