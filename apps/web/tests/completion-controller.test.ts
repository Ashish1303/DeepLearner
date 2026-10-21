import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCompletionController } from '../src/lib/progress/completion-controller';
import type { CompletionClient } from '../src/lib/api/completion-client';
import { ApiError } from '../src/lib/api/client';
import type { AuthController } from '../src/lib/auth/auth-controller';
import type {
  CompletionCommand,
  CompletionView,
} from '../src/lib/progress/completion-contracts';
const cid = 'a'.repeat(24),
  uid = '1'.repeat(24),
  key = '4f95c3e1-7202-45f1-8ef9-9a01205cace9';
const sections = ['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE'] as const;
function view(eligible = false): CompletionView {
  return {
    conceptId: cid,
    viewRevision: 'b'.repeat(64),
    requiredSections: [...sections],
    sections: sections.map((section) => ({
      section,
      status: eligible ? 'QUALIFIED' : 'MISSING',
    })),
    practice: {
      questionId: cid,
      type: 'OUTPUT',
      status: eligible ? 'QUALIFIED' : 'MISSING',
      score: eligible ? 100 : null,
      minimumScore: 70,
    },
    eligibility: eligible ? 'ELIGIBLE' : 'INELIGIBLE',
    blockers: eligible ? [] : [{ code: 'EVIDENCE_MISSING' }],
    completion: { status: 'NOT_COMPLETED', completedAt: null },
    visualization: null,
  };
}
function fixture(client: CompletionClient) {
  let authorizations = 0;
  const auth = {
    async runAuthenticatedRead(
      account: string,
      signal: AbortSignal,
      fn: (token: string, signal: AbortSignal) => Promise<unknown>,
    ) {
      assert.equal(account, uid);
      authorizations++;
      signal.throwIfAborted();
      return fn('test-only-token', signal);
    },
  } as Pick<AuthController, 'runAuthenticatedRead'>;
  return {
    controller: createCompletionController(client, auth, uid, cid, () => key),
    authorizations: () => authorizations,
  };
}
test('completion is explicit and never inferred from loading eligibility or activity', async () => {
  let writes = 0;
  const f = fixture({
    load: async () => view(),
    send: async () => {
      writes++;
      return view(true);
    },
  });
  await f.controller.load();
  await f.controller.complete();
  assert.equal(writes, 0);
  assert.equal(
    f.controller.getSnapshot().data?.completion.status,
    'NOT_COMPLETED',
  );
});
test('uncertain completion retries exact frozen key/body, independently authorizing every request', async () => {
  const calls: CompletionCommand[] = [];
  const f = fixture({
    load: async () => view(true),
    send: async (_id, _token, _signal, cmd) => {
      calls.push(structuredClone(cmd));
      if (calls.length === 1) throw new ApiError('NETWORK_ERROR');
      return {
        ...view(true),
        completion: {
          status: 'COMPLETED',
          completedAt: '2026-10-20T10:00:00.000Z',
        },
      };
    },
  });
  await f.controller.load();
  await f.controller.complete();
  assert.equal(f.controller.getSnapshot().status, 'uncertain');
  await f.controller.issue('READ');
  assert.equal(calls.length, 1);
  await f.controller.retry();
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(f.authorizations(), 3);
  assert.equal(f.controller.getSnapshot().data?.completion.status, 'COMPLETED');
});
test('cancellation prevents stale account/Concept responses and discards pending commands', async () => {
  let resolve!: (v: CompletionView) => void;
  const f = fixture({
    load: () =>
      new Promise((r) => {
        resolve = r;
      }),
    send: async () => view(true),
  });
  const pending = f.controller.load();
  f.controller.cancel();
  resolve(view(true));
  await pending;
  assert.equal(f.controller.getSnapshot().data, null);
  assert.equal(f.controller.getSnapshot().challenge, null);
});
test('normal Concepts and denied accounts have no synthetic or zero-score fallback', async () => {
  for (const status of [404, 403, 401]) {
    const f = fixture({
      load: async () => {
        throw new ApiError('REQUEST_FAILED', status);
      },
      send: async () => view(),
    });
    await f.controller.load();
    assert.equal(
      f.controller.getSnapshot().status,
      status === 404 ? 'unavailable' : 'denied',
    );
    assert.equal(f.controller.getSnapshot().data, null);
  }
});
test('acknowledgement receipt causes authoritative refresh and never marks completion', async () => {
  let reads = 0;
  const f = fixture({
    load: async () => {
      reads++;
      return view();
    },
    send: async (_id, _token, _signal, cmd) =>
      cmd.action === 'challenges'
        ? {
            section: 'READ',
            challenge: {
              id: cid,
              conceptId: cid,
              section: 'READ',
              conceptRevision: 'b'.repeat(64),
              sectionRevision: 'c'.repeat(64),
              policyId: 'read',
              policyVersion: 1,
              expiresAt: '2026-10-20T10:00:00.000Z',
            },
          }
        : {
            section: 'READ',
            receipt: {
              id: cid,
              conceptId: cid,
              section: 'READ',
              acknowledgedAt: '2026-10-20T10:00:00.000Z',
              completionQualification: 'NOT_ESTABLISHED',
            },
          },
  });
  await f.controller.load();
  await f.controller.issue('READ');
  await f.controller.respond();
  assert.equal(reads, 2);
  assert.equal(
    f.controller.getSnapshot().data?.completion.status,
    'NOT_COMPLETED',
  );
});
test('wrong-account and private malformed projections are never rendered', async () => {
  const f = fixture({
    load: async () => ({ ...view(), conceptId: 'f'.repeat(24) }),
    send: async () => view(),
  });
  await f.controller.load();
  assert.equal(f.controller.getSnapshot().status, 'error');
  assert.equal(f.controller.getSnapshot().data, null);
});
test('expired/conflicting challenge errors discard the command and require fresh requirements', async () => {
  const f = fixture({
    load: async () => view(),
    send: async () => {
      throw new ApiError('REQUEST_FAILED', 409);
    },
  });
  await f.controller.load();
  await f.controller.issue('READ');
  assert.equal(f.controller.getSnapshot().status, 'error');
  assert.equal(f.controller.getSnapshot().challenge, null);
  await f.controller.retry();
  assert.equal(f.controller.getSnapshot().status, 'ready');
});
test('repeated retry clicks cannot run overlapping writes and unconfirmed completion never becomes saved', async () => {
  let finish!: (value: CompletionView) => void,
    writes = 0;
  const f = fixture({
    load: async () => view(true),
    send: async () => {
      writes++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  await f.controller.load();
  const saving = f.controller.complete();
  await f.controller.retry();
  assert.equal(writes, 1);
  finish(view(true));
  await saving;
  assert.equal(f.controller.getSnapshot().status, 'uncertain');
  assert.equal(
    f.controller.getSnapshot().data?.completion.status,
    'NOT_COMPLETED',
  );
});
