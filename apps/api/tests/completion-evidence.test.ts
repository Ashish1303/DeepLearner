import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types, type ClientSession } from 'mongoose';
import { Readable, PassThrough } from 'node:stream';
import { createCompletionEvidenceService } from '../src/modules/progress/completion-evidence.service.js';
import type {
  QualificationStore,
  SyntheticCreation,
} from '../src/modules/progress/section-evidence.repository.js';
import { mongoQualification } from '../src/modules/progress/section-evidence.repository.js';
import type { ConceptCompletionRules } from '../src/modules/concepts/concept.model.js';
import {
  completionRulesFromStorage,
  completionRulesToStorage,
} from '../src/modules/concepts/concept.model.js';
import {
  definitionFingerprint,
  checkpointPolicy,
} from '../src/modules/visualizations/visualization-checkpoint-revision.js';
import type { CheckpointDefinition } from '../src/modules/visualizations/visualization-checkpoint-definition.model.js';
import { definitionFingerprint as rubricFingerprint } from '../src/modules/practice/practice-rubric.model.js';
import {
  ackFingerprint,
  issueFingerprint,
} from '../src/modules/progress/section-evidence.service.js';
import { evidencePolicy } from '../src/modules/progress/section-evidence-revision.js';
import { verifyPassword } from '../src/modules/auth/password.service.js';
import {
  fixtureIndexes,
  verifyFixtureIndex,
  parseFixtureCredentials,
  requireFixtureInitialization,
  initializeCompletionStudentFixture,
  readFixtureCredentials,
} from '../scripts/completion-student-fixture.js';
import { User } from '../src/modules/users/user.model.js';
import { Session } from '../src/modules/auth/session.model.js';
const author = 'a'.repeat(24),
  reviewer = 'b'.repeat(24),
  rev = 'd'.repeat(64);
const oid = (id: string) => new Types.ObjectId(id);
const command = {
  topicId: 'c'.repeat(24),
  summary: 'Synthetic',
  bodyMarkdown: 'Read',
  example: 'Example',
  prompt: 'Output?',
  answer: '1',
};
function fixture(
  environment = 'LOCAL',
  credentialSource?: Parameters<typeof createCompletionEvidenceService>[4],
) {
  const events: string[] = [],
    listeners: (() => void)[] = [];
  let rules: ConceptCompletionRules | null = null,
    created: SyntheticCreation | null = null;
  const state = {
    client: {},
    database: {},
    live: true,
    proofFault: false,
    duplicate: false,
    insertFault: false,
    unknown: false,
    denied: new Set<string>(),
    revision: rev,
    commit: false,
    checkpoint: null as CheckpointDefinition | null,
  };
  const session = {
    inTransaction: () => !state.commit,
    async withTransaction(fn: () => Promise<void>) {
      const before = rules;
      state.commit = false;
      try {
        await fn();
        state.commit = true;
        events.push('commit');
        if (state.unknown)
          throw { errorLabels: ['UnknownTransactionCommitResult'] };
      } catch (e) {
        if (!state.commit) rules = before;
        throw e;
      }
    },
    async endSession() {
      events.push('closed');
    },
  } as unknown as ClientSession;
  const definition = () => {
    const d = {
      _id: oid('1'.repeat(24)),
      rubricId: oid('f'.repeat(24)),
      version: 1,
      questionId: oid(created!.questionId),
      conceptId: oid(created!.conceptId),
      type: 'OUTPUT' as const,
      questionRevision: rev,
      contentFingerprint: 'e'.repeat(64),
      answerForm: 'TEXT' as const,
      comparison: 'EXACT_TEXT' as const,
      normalization: 'NONE' as const,
      expectedAnswer: '1',
      authorId: oid(author),
      createdAt: new Date('2026-01-01'),
      schemaVersion: 1 as const,
      definitionFingerprint: '',
    };
    d.definitionFingerprint = rubricFingerprint(d);
    return d;
  };
  const store = {
    async ready() {},
    async session() {
      return session;
    },
    generation: () => ({
      client: state.client,
      database: state.database,
      live: state.live,
    }),
    onLoss(fn: () => void) {
      listeners.push(fn);
      return () => {};
    },
    async target() {
      events.push('target');
    },
    async actor(id: string) {
      if (state.denied.has(id)) throw Error('ineligible');
    },
    async createSynthetic(value: SyntheticCreation) {
      events.push('insert');
      if (state.duplicate) throw { code: 11000, keyPattern: { _id: 1 } };
      if (state.insertFault) throw Error('insert');
      created = value;
    },
    async syntheticProof() {
      events.push('proof');
      assert(state.commit);
      if (state.proofFault) throw Error('proof');
    },
    async conceptRevision() {
      return state.revision;
    },
    async sectionRevision() {
      return rev;
    },
    async actions() {
      return [];
    },
    async policy() {
      return rules;
    },
    async policyWrite(
      _id: string,
      before: ConceptCompletionRules | null,
      after: ConceptCompletionRules,
    ) {
      assert.equal(rules, before);
      rules = after;
    },
    async definition() {
      return definition();
    },
    async authority() {
      const d = definition();
      return {
        _id: oid('2'.repeat(24)),
        rubricId: d.rubricId,
        version: 1,
        definitionId: d._id,
        definitionFingerprint: d.definitionFingerprint,
        authorId: d.authorId,
        reviewerId: oid(reviewer),
        approvedAt: new Date('2026-01-02'),
        approvalAuditId: oid('3'.repeat(24)),
        state: 'APPROVED',
        decisionFence: 1,
        revokedBy: null,
        revokedAt: null,
        revocationAuditId: null,
        schemaVersion: 1,
      };
    },
    async qualified() {
      return {
        data: {
          id: created!.questionId,
          conceptId: created!.conceptId,
          type: 'OUTPUT',
          answer: '1',
          explanation: null,
        },
        questionRevision: rev,
        contentFingerprint: 'e'.repeat(64),
      };
    },
    async auditProof() {},
  } as unknown as QualificationStore;
  const checkpoints = {
    async definition() {
      return state.checkpoint;
    },
    async admin(id: Types.ObjectId) {
      if (state.denied.has(id.toHexString())) throw Error('ineligible');
    },
    async source() {
      return { conceptRevision: state.revision, visualizationRevision: rev };
    },
  };
  const tokens = {
    async verify(token: string) {
      if (token === 'INVALID') throw Error();
      return {
        sub: token,
        role:
          token === author || token === reviewer
            ? ('ADMIN' as const)
            : ('STUDENT' as const),
        sid: author,
        plan: 'FREE' as const,
      };
    },
  };
  const service = createCompletionEvidenceService(
    tokens,
    { APP_ENV: environment },
    store,
    checkpoints,
    credentialSource,
  );
  async function create() {
    const identity = await service.create(author, command);
    const d = {
      _id: oid('c'.repeat(24)),
      conceptId: oid(identity.conceptId),
      visualizationId: oid('e'.repeat(24)),
      schemaVersion: 1 as const,
      conceptRevision: rev,
      visualizationRevision: rev,
      checkpointId: 'checkpoint',
      checkpointVersion: 1,
      policyId: checkpointPolicy.policyId,
      policyVersion: 1 as const,
      verifierVersion: 1 as const,
      responseType: 'SINGLE_CHOICE' as const,
      choices: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      expectedChoiceId: 'a',
      prompt: 'Choose',
      textAlternative: 'Equivalent text',
      authoredBy: oid(author),
      authoredAt: new Date('2026-01-01'),
      authorRequestId: 'create',
      state: 'APPROVED' as const,
      decisionFence: 1,
      approvedBy: oid(reviewer),
      approvedAt: new Date('2026-01-02'),
      revokedBy: null,
      revokedAt: null,
    };
    const fingerprint = definitionFingerprint(d);
    state.checkpoint = {
      ...d,
      definitionFingerprint: fingerprint,
      approvedFingerprint: fingerprint,
    };
    return identity;
  }
  async function approve() {
    const id = await create();
    const p = await service.author(author, {
      conceptId: id.conceptId,
      rubricId: 'f'.repeat(24),
      rubricVersion: 1,
      checkpointDefinitionId: 'c'.repeat(24),
      minimumScore: 70,
    });
    await service.approve(reviewer, {
      conceptId: id.conceptId,
      version: p.version,
    });
    return { id, p, authority: service.authority(id.conceptId) };
  }
  return {
    service,
    state,
    events,
    listeners,
    create,
    approve,
    rules: () => rules,
    store,
    created: () => created,
  };
}

test('trusted internal credential source hashes before insert and returns IDs only; default remains private', async () => {
  let calls = 0;
  const password = 'Temporary test password';
  const f = fixture('LOCAL', async (identity) => {
    calls++;
    assert(Object.isFrozen(identity));
    assert.match(identity.userId, /^[a-f0-9]{24}$/);
    return password;
  });
  const result = await f.create();
  assert.equal(calls, 1);
  assert(await verifyPassword(password, f.created()!.passwordHash));
  assert.deepEqual(Object.keys(result).sort(), [
    'conceptId',
    'questionId',
    'sourceEpoch',
    'userId',
  ]);
  assert(!JSON.stringify(result).includes(password));
  const normal = fixture();
  await normal.create();
  assert.match(normal.created()!.passwordHash, /^\$argon2id\$/);
  assert(!(await verifyPassword(password, normal.created()!.passwordHash)));
});
test('invalid/failed credential source refuses before insertion with no secret in errors', async () => {
  for (const value of ['', 'short', 'x'.repeat(129)]) {
    const f = fixture('LOCAL', async () => value);
    await assert.rejects(
      f.create(),
      (e: unknown) =>
        e instanceof Error && e.message === 'Section activity is unavailable',
    );
    assert(!f.events.includes('insert'));
  }
  const f = fixture('LOCAL', async () => {
    throw Error('synthetic-private-value');
  });
  await assert.rejects(
    f.create(),
    (e: unknown) =>
      e instanceof Error && !e.message.includes('synthetic-private-value'),
  );
  assert(!f.events.includes('insert'));
});
test('public creation cannot supply passwords, auth flags or reconstruct origin', async () => {
  const f = fixture();
  for (const field of [
    'password',
    'passwordHash',
    'credentialSource',
    'bootstrapApproved',
  ]) {
    await assert.rejects(
      f.service.create(author, {
        ...command,
        [field]: 'synthetic-private-value',
      }),
    );
  }
  assert(!f.events.includes('insert'));
});
test('fixture bootstrap refuses serialized authority and credentials are strict, bounded and sanitized', () => {
  for (const value of [
    undefined,
    { approved: true },
    { assertOwned: true },
    { APP_ENV: 'LOCAL' },
  ]) {
    assert.throws(
      () => requireFixtureInitialization(value as never),
      /COMPLETION_FIXTURE_UNAVAILABLE/,
    );
  }
  for (const input of [
    {},
    {
      author: 'short',
      reviewer: 'long enough password',
      student: 'long enough password',
    },
    {
      author: 'x'.repeat(129),
      reviewer: 'x'.repeat(20),
      student: 'x'.repeat(20),
    },
    {
      author: 'x'.repeat(20),
      reviewer: 'x'.repeat(20),
      student: 'x'.repeat(20),
      role: 'ADMIN',
    },
  ]) {
    assert.throws(
      () => parseFixtureCredentials(input),
      (e: unknown) =>
        e instanceof Error && e.message === 'COMPLETION_FIXTURE_UNAVAILABLE',
    );
  }
});
test('absent or failed supervisor authority refuses before configuration, connection or account creation', async () => {
  await assert.rejects(
    initializeCompletionStudentFixture(undefined as never),
    /COMPLETION_FIXTURE_UNAVAILABLE/,
  );
  await assert.rejects(
    initializeCompletionStudentFixture({
      dbPath: 'E:\\disposable-only',
      mongoPid: 123,
      async assertOwned() {
        throw Error('private diagnostic value');
      },
      onLoss() {
        throw Error('must not subscribe');
      },
      async readCredentials() {
        throw Error('must not read');
      },
    }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === 'COMPLETION_FIXTURE_UNAVAILABLE',
  );
});
test('private input is bounded and malformed credentials never enter error payloads', async () => {
  const input = {
    author: 'unit-only author password',
    reviewer: 'unit-only reviewer password',
    student: 'unit-only student password',
  };
  assert.deepEqual(
    await readFixtureCredentials(Readable.from([JSON.stringify(input) + '\n'])),
    input,
  );
  const unicode = { ...input, author: 'unit-only café password' };
  const bytes = Buffer.from(JSON.stringify(unicode) + '\n');
  const split = bytes.indexOf(Buffer.from('é')) + 1;
  assert.deepEqual(
    await readFixtureCredentials(
      Readable.from([bytes.subarray(0, split), bytes.subarray(split)]),
    ),
    unicode,
  );
  for (const text of [
    '{"student":"private diagnostic value"}\n',
    'x'.repeat(8193) + '\n',
  ]) {
    await assert.rejects(
      readFixtureCredentials(Readable.from([text])),
      (error: unknown) =>
        error instanceof Error &&
        error.message === 'COMPLETION_FIXTURE_UNAVAILABLE',
    );
  }
});
test('private credential deadline closes only the owned input and refuses without waiting indefinitely', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const input = new PassThrough();
  try {
    const refused = assert.rejects(
      readFixtureCredentials(input),
      /COMPLETION_FIXTURE_UNAVAILABLE/,
    );
    t.mock.timers.tick(15000);
    await refused;
    assert.equal(input.destroyed, true);
    assert.equal(input.listenerCount('data'), 0);
  } finally {
    t.mock.timers.reset();
    input.destroy();
  }
});
test('twenty-one proposed fixture indexes include exact installed F006 declarations and refuse drift', () => {
  assert.equal(fixtureIndexes.length, 21);
  assert.equal(
    new Set(fixtureIndexes.map((i) => i.collection + '/' + i.name)).size,
    21,
  );
  for (const [collection, model] of [
    ['users', User],
    ['sessions', Session],
  ] as const) {
    for (const [key, opts] of model.schema.indexes()) {
      const name = Object.entries(key).flat().join('_');
      const expected = fixtureIndexes.find(
        (i) => i.collection === collection && i.name === name,
      )!;
      assert(expected);
      assert.deepEqual(expected.key, key);
      assert.equal(expected.unique, opts.unique === true);
      assert.deepEqual(
        expected.partialFilterExpression,
        opts.partialFilterExpression,
      );
      assert.equal(expected.expireAfterSeconds, opts.expireAfterSeconds);
    }
  }
  for (const i of fixtureIndexes) {
    const actual = {
      v: 2,
      name: i.name,
      key: i.key,
      ...(i.unique ? { unique: true } : {}),
      ...(i.partialFilterExpression
        ? { partialFilterExpression: i.partialFilterExpression }
        : {}),
      ...(i.expireAfterSeconds === undefined
        ? {}
        : { expireAfterSeconds: i.expireAfterSeconds }),
    };
    verifyFixtureIndex(actual, i);
    for (const patch of [
      { unique: !i.unique },
      { key: { different: 1 } },
      { collation: { locale: 'en' } },
      { sparse: true },
      { expireAfterSeconds: 123 },
    ])
      assert.throws(() => verifyFixtureIndex({ ...actual, ...patch }, i));
  }
});
test('origin is registered only after successful insert, majority commit and owned creation proof', async () => {
  const f = fixture(),
    id = await f.create();
  assert.deepEqual(f.events.slice(0, 4), [
    'target',
    'insert',
    'commit',
    'proof',
  ]);
  assert.notEqual(id.userId, command.topicId);
  assert.match(id.sourceEpoch, /^[a-f0-9]{64}$/);
  assert.throws(() => f.service.authority(id.conceptId).assert());
});
test('optional bounded Revise content is accepted without accepting identity or provenance claims', async () => {
  const f = fixture();
  const id = await f.service.create(author, {
    ...command,
    revise: { summary: 'Review', keyPoints: ['A bounded point'] },
  });
  assert.match(id.userId, /^[a-f0-9]{24}$/);
  await assert.rejects(
    f.service.create(author, {
      ...command,
      revise: { summary: 'Review', keyPoints: ['x'.repeat(501)] },
    }),
  );
});
test('creation rejects caller-supplied identity, epoch, approval and imported records', async () => {
  const f = fixture();
  for (const field of [
    'userId',
    'conceptId',
    'questionId',
    'sourceEpoch',
    'approved',
    'record',
  ])
    await assert.rejects(
      f.service.create(author, { ...command, [field]: author }),
    );
  assert.equal(f.events.length, 0);
});
test('existing-ID duplicate creation is a refusal, never origin adoption', async () => {
  const f = fixture();
  f.state.duplicate = true;
  await assert.rejects(f.create());
  assert.equal(f.events.filter((e) => e === 'insert').length, 1);
});
test('failed creation and failed durable proof cannot produce an active origin', async () => {
  for (const flag of ['proofFault', 'insertFault', 'unknown'] as const) {
    const f = fixture();
    f.state[flag] = true;
    await assert.rejects(f.create());
  }
});
test('synthetic producer rejects unauthenticated and non-Admin callers', async () => {
  const f = fixture();
  await assert.rejects(f.service.create('INVALID', command));
  await assert.rejects(f.service.create('e'.repeat(24), command));
  assert.equal(f.events.length, 0);
});
test('synthetic creation is unavailable outside LOCAL', async () => {
  for (const env of ['DEVELOPMENT', 'PRODUCTION'])
    await assert.rejects(fixture(env).create());
});
test('independent current Admin approval seals exactly the server-created origin', async () => {
  const f = fixture(),
    { authority, p } = await f.approve();
  authority.assert();
  const current = await authority.current({}, false);
  assert.equal(current.minimumScore, 70);
  assert.equal(current.policyId, p.policyId);
  assert.equal(current.approvedBy, reviewer);
  assert.equal(current.authoredBy, author);
  assert.equal(current.approvedFingerprint, current.fingerprint);
});
test('policy cannot be self-approved or approved by an ineligible reviewer', async () => {
  const f = fixture(),
    id = await f.create();
  const p = await f.service.author(author, {
    conceptId: id.conceptId,
    rubricId: 'f'.repeat(24),
    rubricVersion: 1,
    checkpointDefinitionId: 'c'.repeat(24),
    minimumScore: 70,
  });
  await assert.rejects(
    f.service.approve(author, { conceptId: id.conceptId, version: p.version }),
  );
  f.state.denied.add(reviewer);
  await assert.rejects(
    f.service.approve(reviewer, {
      conceptId: id.conceptId,
      version: p.version,
    }),
  );
});
test('Concept policy refuses unsupported thresholds and inheritance assertions', async () => {
  const f = fixture(),
    id = await f.create();
  const cmd = {
    conceptId: id.conceptId,
    rubricId: 'f'.repeat(24),
    rubricVersion: 1,
    checkpointDefinitionId: 'c'.repeat(24),
    minimumScore: 70,
  };
  for (const score of [0, 69, 71, 100, null, undefined, '70'])
    await assert.rejects(
      f.service.author(author, { ...cmd, minimumScore: score }),
    );
  await assert.rejects(f.service.author(author, { ...cmd, topicPolicy: 70 }));
});
test('terminal policy revocation blocks qualification and reapproval', async () => {
  const f = fixture(),
    { id, p, authority } = await f.approve();
  await f.service.revoke(author, {
    conceptId: id.conceptId,
    version: p.version,
  });
  await assert.rejects(authority.current({}, false));
  await assert.rejects(
    f.service.approve(reviewer, {
      conceptId: id.conceptId,
      version: p.version,
    }),
  );
});
test('current role, publication revision and checkpoint revocation are revalidated', async () => {
  for (const mode of ['role', 'revision', 'checkpoint']) {
    const f = fixture(),
      { authority } = await f.approve();
    if (mode === 'role') f.state.denied.add(reviewer);
    if (mode === 'revision') f.state.revision = '0'.repeat(64);
    if (mode === 'checkpoint') f.state.checkpoint!.state = 'REVOKED';
    await assert.rejects(authority.current({}, false));
  }
});
test('connection replacement and reconnect permanently invalidate origin, even after recovery', async () => {
  for (const mode of ['client', 'database', 'event', 'live']) {
    const f = fixture(),
      { authority } = await f.approve(),
      original = f.state.client;
    if (mode === 'client') f.state.client = {};
    if (mode === 'database') f.state.database = {};
    if (mode === 'event') f.listeners[0]!();
    if (mode === 'live') f.state.live = false;
    assert.throws(authority.assert);
    f.state.client = original;
    f.state.live = true;
    assert.throws(authority.assert);
  }
});
test('serialized identity locators cannot reconstruct authority in another service instance', async () => {
  const f = fixture(),
    { id } = await f.approve(),
    other = fixture();
  assert.throws(() =>
    other.service.authority(JSON.parse(JSON.stringify(id)).conceptId),
  );
});
test('policy/grading fence advances without mutating approved authored versions', async () => {
  const f = fixture(),
    { authority } = await f.approve(),
    before = structuredClone(f.rules()!);
  await authority.current({ session: {} as ClientSession }, true);
  assert.deepEqual(f.rules()!.versions, before.versions);
  assert.equal(f.rules()!.decisionFence, before.decisionFence + 1);
});
test('private origin behavior is nonserializable and disposal permanently revokes authority', async () => {
  const f = fixture(),
    { authority } = await f.approve();
  assert.throws(() => JSON.stringify(authority));
  assert.throws(() => structuredClone(authority));
  f.service.dispose();
  assert.throws(authority.assert);
});
test('native policy CAS rejects authored edits, reviewer rewrites and version deletion before database access', async () => {
  const f = fixture();
  await f.approve();
  const before = f.rules()!;
  for (const change of [
    { versions: [] },
    {
      versions: before.versions.map((p) => ({
        ...p,
        approvedBy: 'e'.repeat(24),
      })),
    },
    { versions: before.versions.map((p) => ({ ...p, minimumScore: 69 })) },
  ]) {
    await assert.rejects(
      mongoQualification.policyWrite(
        before.versions[0]!.conceptId,
        before,
        {
          ...before,
          ...change,
          decisionFence: before.decisionFence + 1,
        } as ConceptCompletionRules,
        { session: { inTransaction: () => true } as ClientSession },
      ),
    );
  }
});
test('policy storage preserves canonical BSON references and rejects string/forged stored references', async () => {
  const f = fixture();
  await f.approve();
  const rules = f.rules()!,
    stored = completionRulesToStorage(rules);
  assert(stored.versions[0]!.conceptId instanceof Types.ObjectId);
  assert(stored.versions[0]!.approvedBy instanceof Types.ObjectId);
  assert.deepEqual(completionRulesFromStorage(stored), rules);
  assert.throws(() => completionRulesFromStorage(rules));
});
test('origin stays bound to the exact sealed approved policy rather than an arbitrary active policy', async () => {
  const f = fixture(),
    { authority } = await f.approve();
  f.rules()!.versions[0]!.fingerprint = '0'.repeat(64);
  await assert.rejects(authority.current({}, false));
});
function readAction(user: string, concept: string, issuedAt: Date) {
  const receiptId = new Types.ObjectId();
  const c = {
    _id: new Types.ObjectId(),
    userId: oid(user),
    conceptId: oid(concept),
    ...evidencePolicy,
    conceptRevision: rev,
    sectionRevision: rev,
    issueKeyHash: 'f'.repeat(64),
    requestFingerprint: '',
    issueRequestId: 'issue',
    issuedAt,
    expiresAt: new Date(issuedAt.getTime() + 300_000),
    state: 'CONSUMED' as const,
    decisionFence: 1,
    consumedAt: issuedAt,
    receiptId,
    revokedBy: null,
    revokedAt: null,
  };
  c.requestFingerprint = issueFingerprint(c);
  const r = {
    _id: receiptId,
    userId: c.userId,
    conceptId: c.conceptId,
    ...evidencePolicy,
    conceptRevision: rev,
    sectionRevision: rev,
    challengeId: c._id,
    origin: 'ACKNOWLEDGEMENT_SERVICE',
    purpose: 'ACTIVITY_ONLY',
    ackKeyHash: 'e'.repeat(64),
    requestFingerprint: ackFingerprint(c),
    ackRequestId: 'ack',
    acknowledgedAt: issuedAt,
  };
  return { challenge: c, receipt: r };
}
test('trusted action reader returns only current owned action references, never completion evidence', async () => {
  const f = fixture(),
    { id } = await f.approve();
  const action = readAction(
    id.userId,
    id.conceptId,
    f.rules()!.versions[0]!.approvedAt!,
  );
  f.store.actions = async (_owner, _concept, section) =>
    section === 'READ' ? [action] : [];
  const result = await f.service.actions(id.userId, id.conceptId);
  assert.equal(result.length, 1);
  assert.deepEqual(Object.keys(result[0]!).sort(), [
    'actionAt',
    'receiptId',
    'section',
  ]);
  assert.equal(JSON.stringify(result).includes('VERIFIED'), false);
  await assert.rejects(f.service.actions('e'.repeat(24), id.conceptId));
});
test('a malformed later action cannot be hidden by an earlier valid candidate', async () => {
  const f = fixture(),
    { id } = await f.approve();
  const action = readAction(
    id.userId,
    id.conceptId,
    f.rules()!.versions[0]!.approvedAt!,
  );
  f.store.actions = async (_owner, _concept, section) =>
    section === 'READ' ? [action, { challenge: null, receipt: {} }] : [];
  await assert.rejects(f.service.actions(id.userId, id.conceptId));
});
