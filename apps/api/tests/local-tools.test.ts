import type { Model, Types } from 'mongoose';
import { mongoose } from '../src/config/database.js';
import {
  contentManifest,
  contentKinds,
  executeContentProvisioning,
  type ContentStore,
  type ContentSession,
} from '../scripts/local-demo-content.js';

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { User } from '../src/modules/users/user.model.js';
import { verifyPassword } from '../src/modules/auth/password.service.js';
import { hashPassword } from '../src/modules/auth/password.service.js';
import {
  LocalError,
  target,
  requireLocal,
  verifyInstance,
  verifyReplica,
  primaryReady,
  prepareStorage,
  indexesMatch,
  insertDemoAccount,
  models,
  readPrivateInput,
  digestBytes,
} from '../scripts/local-tools.js';
import {
  validateManifest,
  matchesApprovedRecord,
} from '../scripts/local-demo-content.js';

test('local target is exact and never accepts port 27017, SRV, aliases or other databases', () => {
  const config = {
    APP_ENV: 'LOCAL',
    MONGODB_URI: target.uri,
    MONGODB_DB_NAME: target.database,
  };
  requireLocal(config);
  for (const changed of [
    { APP_ENV: 'PRODUCTION' },
    { APP_ENV: 'DEVELOPMENT' },
    { MONGODB_URI: 'mongodb://127.0.0.1:27017/' },
    { MONGODB_URI: 'mongodb+srv://example.invalid/' },
    { MONGODB_URI: target.uri.replace('127.0.0.1', 'localhost') },
    { MONGODB_DB_NAME: 'deeplearner-local' },
  ])
    assert.throws(() => requireLocal({ ...config, ...changed }), {
      code: 'LOCAL_TARGET_REJECTED',
    });
});
test('instance identity checks pid, literal binding, replica name and exact data path', () => {
  const options = {
    parsed: {
      net: { bindIp: '127.0.0.1', port: 27018 },
      storage: { dbPath: 'C:/owned/mongodb' },
      replication: { replSet: target.replicaSet },
    },
  };
  verifyInstance(options, 123, 123, 'C:/owned/mongodb');
  for (const wrong of [
    {
      ...options,
      parsed: { ...options.parsed, net: { bindIp: '0.0.0.0', port: 27018 } },
    },
    {
      ...options,
      parsed: { ...options.parsed, net: { bindIp: '127.0.0.1', port: 27017 } },
    },
    {
      ...options,
      parsed: { ...options.parsed, replication: { replSet: 'f020-test' } },
    },
  ])
    assert.throws(() => verifyInstance(wrong, 123, 123, 'C:/owned/mongodb'), {
      code: 'INSTANCE_IDENTITY_MISMATCH',
    });
  assert.throws(() => verifyInstance(options, 124, 123, 'C:/owned/mongodb'));
  assert.throws(() => verifyInstance(options, 123, 123, 'C:/other/mongodb'));
  assert.throws(() =>
    verifyReplica({
      _id: target.replicaSet,
      members: [{ host: target.host }, { host: 'external.invalid:27018' }],
    }),
  );
});
test('initialization is exactly once and primary/config readiness precede later operations', async () => {
  const events: string[] = [];
  let initialized = false;
  await primaryReady(
    {
      command: async (command) => {
        const name = Object.keys(command)[0]!;
        events.push(name);
        if (name === 'replSetGetConfig') {
          if (!initialized)
            throw Object.assign(new Error('synthetic'), { code: 94 });
          return {
            config: {
              _id: target.replicaSet,
              members: [{ host: target.host }],
            },
          };
        }
        if (name === 'replSetInitiate') {
          initialized = true;
          return {};
        }
        return { isWritablePrimary: true, setName: target.replicaSet };
      },
    },
    true,
  );
  events.push('collection-read');
  assert.deepEqual(events, [
    'replSetGetConfig',
    'replSetInitiate',
    'hello',
    'replSetGetConfig',
    'collection-read',
  ]);
});
test('unexpected initialized replica, initialization errors and primary timeout fail without writes/retries', async () => {
  await assert.rejects(primaryReady({ command: async () => ({}) }, true), {
    code: 'UNEXPECTED_INITIALIZED_REPLICA',
  });
  let calls = 0;
  await assert.rejects(
    primaryReady(
      {
        command: async () => {
          calls++;
          throw new Error('synthetic');
        },
      },
      true,
    ),
  );
  assert.equal(calls, 1);
  let clock = 0;
  await assert.rejects(
    primaryReady(
      {
        command: async (command) => {
          assert.deepEqual(command, { hello: 1 });
          return { setName: target.replicaSet, isWritablePrimary: false };
        },
      },
      false,
      async (ms) => {
        clock += ms;
      },
      () => clock,
    ),
    { code: 'PRIMARY_TIMEOUT' },
  );
});
test('all model index prerequisites include exact unique/TTL/partial options', () => {
  for (const model of models) {
    const declared = model.schema.indexes();
    const actual = [
      { key: { _id: 1 } },
      ...declared.map(([key, options]) => ({ key, ...options })),
    ];
    assert(indexesMatch(actual, declared));
    assert(!indexesMatch(actual.slice(1), declared));
    assert(!indexesMatch(actual.slice(0, 1), declared));
  }
  const declared = [[{ email: 1 }, { unique: true }]] as const;
  assert(!indexesMatch([{ key: { _id: 1 } }, { key: { email: 1 } }], declared));
  assert(
    !indexesMatch(
      [{ key: { _id: 1 } }, { key: { email: 1 }, unique: true, sparse: true }],
      declared,
    ),
  );
});
test('actual preparation sequence checks primary then emptiness before connecting or creating indexes', async () => {
  for (const mode of [
    'initialize',
    'normal',
    'nonempty',
    'primary-failure',
    'index-failure',
  ] as const) {
    const events: string[] = [];
    const operation = prepareStorage(mode !== 'normal', {
      primary: async () => {
        events.push('primary');
        if (mode === 'primary-failure') throw new Error('synthetic');
      },
      collections: async () => {
        events.push('collections');
        return mode === 'nonempty' ? [{}] : [];
      },
      connect: async () => {
        events.push('connect');
      },
      initialize: async () => {
        events.push('initialize');
      },
      indexes: async () => {
        events.push('indexes');
        if (mode === 'index-failure') throw new Error('synthetic');
      },
    });
    if (['nonempty', 'primary-failure', 'index-failure'].includes(mode))
      await assert.rejects(operation);
    else await operation;
    assert.deepEqual(
      events,
      mode === 'primary-failure'
        ? ['primary']
        : mode === 'nonempty'
          ? ['primary', 'collections']
          : mode === 'normal'
            ? ['primary', 'connect', 'indexes']
            : ['primary', 'collections', 'connect', 'initialize', 'indexes'],
    );
  }
});
test('simultaneous account insertion permits one winner and propagates duplicate rejection', async () => {
  let inserted = false,
    writes = 0;
  const deps = {
    find: async () => null,
    hash: async () => 'synthetic hash',
    insert: async () => {
      writes++;
      if (inserted)
        throw Object.assign(new Error('duplicate'), { code: 11000 });
      inserted = true;
    },
  };
  const results = await Promise.allSettled([
    insertDemoAccount(0, 'Synthetic-password', deps),
    insertDemoAccount(0, 'Synthetic-password', deps),
  ]);
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(writes, 2);
  const rejected = results.find((result) => result.status === 'rejected');
  assert(rejected?.status === 'rejected');
  assert.equal(rejected.reason.code, 11000);
});
test('demo accounts use valid User fields and existing Argon2id without plaintext persistence', async () => {
  for (const index of [0, 1] as const) {
    const password = 'Harmless offline password 42!';
    let stored: Record<string, unknown> | undefined;
    const outcome = await insertDemoAccount(index, password, {
      find: async () => null,
      hash: hashPassword,
      insert: async (record) => {
        stored = record;
        await new User(record).validate();
      },
    });
    assert.equal(outcome, 'CREATED');
    assert(stored);
    assert.equal(stored.role, index === 0 ? 'STUDENT' : 'ADMIN');
    assert.equal(stored.plan, index === 0 ? 'PREMIUM' : 'FREE');
    assert.equal(stored.status, 'ACTIVE');
    assert(stored.emailVerifiedAt instanceof Date);
    assert(!JSON.stringify(stored).includes(password));
    assert(!Object.hasOwn(stored, 'password'));
    assert(await verifyPassword(password, stored.passwordHash as string));
    if (index === 0)
      assert.deepEqual(stored.profile, {
        experienceLevel: 'BEGINNER',
        learningGoals: ['LEARN_FROM_SCRATCH'],
        preferredDifficulty: 'BEGINNER',
        dailyStudyGoalMinutes: 20,
        interestedTechnologyIds: [],
      });
  }
});
test('existing accounts never hash/reset/promote; conflicting roles/status fail closed', async () => {
  const account = {
    role: 'STUDENT',
    plan: 'PREMIUM',
    status: 'ACTIVE',
    emailVerifiedAt: new Date(),
    passwordHash: 'existing',
  };
  const forbidden = async () => {
    throw new Error('Unexpected mutation');
  };
  assert.equal(
    await insertDemoAccount(0, 'ignored', {
      find: async () => account,
      hash: forbidden,
      insert: forbidden,
    }),
    'UNCHANGED',
  );
  for (const existing of [
    { ...account, role: 'ADMIN' },
    { ...account, plan: 'FREE' },
    { ...account, status: 'SUSPENDED' },
    { ...account, passwordHash: null },
    { ...account, emailVerifiedAt: null },
  ])
    await assert.rejects(
      insertDemoAccount(0, 'ignored', {
        find: async () => existing,
        hash: forbidden,
        insert: forbidden,
      }),
      { code: 'EXISTING_ACCOUNT_CONFLICT' },
    );
});
test('invalid password blocks hashing and duplicate insert propagates without retry', async () => {
  let hashes = 0,
    writes = 0;
  const deps = {
    find: async () => null,
    hash: async () => {
      hashes++;
      return 'test-hash';
    },
    insert: async () => {
      writes++;
      throw Object.assign(new Error('synthetic'), { code: 11000 });
    },
  };
  await assert.rejects(insertDemoAccount(0, 'short', deps));
  assert.equal(hashes, 0);
  assert.equal(writes, 0);
  await assert.rejects(insertDemoAccount(0, 'Synthetic-only-password', deps), {
    code: 11000,
  });
  assert.equal(writes, 1);
});
test('private input is bounded and errors do not echo credentials', async () => {
  assert.deepEqual(
    await readPrivateInput(Readable.from(['{"student":"synthetic"}\n'])),
    { student: 'synthetic' },
  );
  await assert.rejects(readPrivateInput(Readable.from(['x'.repeat(8193)])), {
    code: 'INPUT_LIMIT',
  });
  await assert.rejects(readPrivateInput(Readable.from([])), {
    code: 'INPUT_REQUIRED',
  });
  assert.equal(new LocalError('SAFE_FAILURE').message, 'SAFE_FAILURE');
});
test('content mechanism requires approved hash, strict manifest, no embedded IDs or empty content', () => {
  const empty = Buffer.from(
    JSON.stringify({
      revision: 1,
      database: target.database,
      synthetic: true,
      technologies: [],
    }),
  );
  assert.throws(() => validateManifest(empty, '0'.repeat(64)), {
    code: 'MANIFEST_HASH_REJECTED',
  });
  assert.throws(() => validateManifest(empty, digestBytes(empty))); // no invented demo manifest is provided
  const invalid = Buffer.from(
    JSON.stringify({
      revision: 1,
      database: target.database,
      synthetic: true,
      technologies: [],
      createdBy: 'invented',
    }),
  );
  assert.throws(() => validateManifest(invalid, digestBytes(invalid)));
  assert(
    matchesApprovedRecord(
      { title: 'Same', status: 'PUBLISHED', __v: 2 },
      { title: 'Same', status: 'PUBLISHED' },
    ),
  );
  assert(
    !matchesApprovedRecord(
      { title: 'Old', status: 'DRAFT' },
      { title: 'Same', status: 'PUBLISHED' },
    ),
  );
});
test('only LOCAL binds API loopback; no automatic env-file or seed invocation is added', () => {
  const server = readFileSync(
    new URL('../src/server.ts', import.meta.url),
    'utf8',
  );
  assert(server.includes("env.APP_ENV === 'LOCAL' ? '127.0.0.1' : undefined"));
  const launcher = readFileSync(
    new URL('../../../scripts/Start-DeepLearner.ps1', import.meta.url),
    'utf8',
  );
  assert(!launcher.includes('--env-file'));
  assert(
    launcher.includes(
      "$operation=if ($Mode -eq 'Initialize') {'initialize'} else {'check'}",
    ),
  );
});

type ContentKind = (typeof contentKinds)[number];
type ContentRow = Awaited<ReturnType<ContentStore['prepare']>>;
type ContentRows = Record<ContentKind, ContentRow[]>;
const zeroCounts = {
  technologies: 0,
  learningPaths: 0,
  modules: 0,
  topics: 0,
  concepts: 0,
};
const fullCounts = {
  technologies: 2,
  learningPaths: 2,
  modules: 4,
  topics: 4,
  concepts: 20,
};
const emptyRows = (): ContentRows => ({
  technologies: [],
  learningPaths: [],
  modules: [],
  topics: [],
  concepts: [],
});
const oid = () => new mongoose.Types.ObjectId();
function copy<T>(value: T): T {
  if (value instanceof mongoose.Types.ObjectId)
    return new mongoose.Types.ObjectId(value.toHexString()) as T;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (Array.isArray(value)) return value.map(copy) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, copy(v)]),
    ) as T;
  return value;
}
const mockManifest = () =>
  contentManifest.parse({
    revision: 1,
    database: target.database,
    synthetic: true,
    technologies: ['javascript', 'typescript'].map((slug, order) => ({
      name: slug,
      slug,
      order,
      status: 'PUBLISHED',
      iconAssetId: null,
      paths: [
        {
          title: 'Offline foundation',
          slug: 'foundation',
          order: 0,
          status: 'PUBLISHED',
          targetLevel: 'BEGINNER',
          completionScore: 70,
          modules: [0, 1].map((n) => ({
            title: 'Offline module ' + n,
            slug: 'module-' + n,
            order: n,
            status: 'PUBLISHED',
            topics: [
              {
                title: 'Offline topic',
                slug: 'topic',
                order: 0,
                status: 'PUBLISHED',
                concepts: Array.from({ length: 5 }, (_, i) => ({
                  title: 'Offline concept ' + i,
                  slug: 'concept-' + i,
                  order: i,
                  status: 'PUBLISHED',
                  difficulty: 'BEGINNER',
                  contentFormat: 'MARKDOWN',
                  schemaVersion: 1,
                  read: {
                    summary: 'Synthetic offline summary',
                    bodyMarkdown:
                      '## Offline fixture\nA harmless test explanation.',
                  },
                  source: {
                    label: 'Offline source',
                    url: 'https://example.invalid/docs',
                    sourceType: 'OFFICIAL_OR_TRUSTED',
                    isOfficial: false,
                  },
                })),
              },
            ],
          })),
        },
      ],
    })),
  });
function keyMatches(row: ContentRow, key: Record<string, unknown>): boolean {
  if (key.$or)
    return (key.$or as Record<string, unknown>[]).some((k) =>
      keyMatches(row, k),
    );
  return Object.entries(key).every(([k, v]) =>
    v instanceof mongoose.Types.ObjectId
      ? row[k] instanceof mongoose.Types.ObjectId &&
        v.equals(row[k] as Types.ObjectId)
      : row[k] === v,
  );
}
function mockContent(seed: ContentRows = emptyRows()) {
  const state = {
    db: copy(seed),
    events: [] as string[],
    writes: [] as string[],
    admin: {
      _id: oid(),
      email: 'demo.admin@deeplearner.test',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date('2026-01-01'),
    } as ContentRow,
    commit: 'ack' as 'ack' | 'unknown-applied' | 'unknown-absent',
    failWriteAt: 0,
    abortFails: false,
    endFails: '' as '' | 'write' | 'read',
    afterCommit: undefined as (() => void) | undefined,
    beforeFind: undefined as
      | ((
          kind: ContentKind,
          key: Record<string, unknown>,
          readOnly: boolean,
          rows: ContentRows,
        ) => void)
      | undefined,
    readOpen: undefined as (() => void) | undefined,
  };
  type Session = ContentSession & { rows: ContentRows; readOnly: boolean };
  const store: ContentStore = {
    openSession: async (readOnly) => {
      state.events.push(readOnly ? 'open-read' : 'open-write');
      if (readOnly) state.readOpen?.();
      const session: Session = {
        rows: copy(state.db),
        readOnly,
        startTransaction: (options) => {
          assert(!readOnly);
          assert.deepEqual(options, {
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority' },
            readPreference: 'primary',
          });
          state.events.push('start');
        },
        commitTransaction: async () => {
          assert(!readOnly);
          state.events.push('commit');
          if (state.commit !== 'unknown-absent') state.db = copy(session.rows);
          state.afterCommit?.();
          if (state.commit !== 'ack')
            throw Object.assign(new Error('private commit detail'), {
              errorLabels: [
                'UnknownTransactionCommitResult',
                'TransientTransactionError',
              ],
            });
        },
        abortTransaction: async () => {
          state.events.push('abort');
          if (state.abortFails) throw new Error('private abort detail');
        },
        endSession: async () => {
          state.events.push(readOnly ? 'end-read' : 'end-write');
          if (state.endFails === (readOnly ? 'read' : 'write'))
            throw new Error('private end detail');
        },
      };
      return session;
    },
    admin: async (session) => {
      state.events.push(
        (session as Session).readOnly ? 'admin-read' : 'admin-write',
      );
      return copy(state.admin);
    },
    prepare: async (kind, data) => {
      // Actual model validation/defaults, in memory only. Never connect/save here.
      const model = models[5 + contentKinds.indexOf(kind)] as unknown as Model<
        Record<string, unknown>
      >;
      const candidate = new model(data);
      await candidate.validate();
      state.events.push('prepare-' + kind);
      return candidate.toObject() as ContentRow;
    },
    find: async (kind, key, session) => {
      const s = session as Session;
      state.events.push((s.readOnly ? 'read-' : 'find-') + kind);
      state.beforeFind?.(kind, key, s.readOnly, s.rows);
      return copy(s.rows[kind].filter((row) => keyMatches(row, key)));
    },
    insert: async (kind, data, session) => {
      const s = session as Session;
      assert(!s.readOnly, 'readback must never write');
      state.events.push('insert-' + kind);
      state.writes.push(String(data._id));
      if (state.failWriteAt === state.writes.length)
        throw Object.assign(new Error('private duplicate detail'), {
          code: 11000,
          errorLabels: ['TransientTransactionError'],
        });
      const parentKey = {
        technologies: '',
        learningPaths: 'technologyId',
        modules: 'learningPathId',
        topics: 'moduleId',
        concepts: 'topicId',
      }[kind];
      const uniqueKey = {
        slug: data.slug,
        ...(parentKey ? { [parentKey]: data[parentKey] } : {}),
      };
      assert(
        !s.rows[kind].some((row) => keyMatches(row, uniqueKey)),
        'mock unique-index violation',
      );
      const saved = {
        ...copy(data),
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      s.rows[kind].push(saved);
      return copy(saved);
    },
  };
  return { state, store };
}
async function seededContent() {
  const mock = mockContent();
  assert.equal(
    (await executeContentProvisioning(mockManifest(), mock.store)).outcome,
    'PASS',
  );
  mock.state.events.length = 0;
  mock.state.writes.length = 0;
  return mock;
}

test('content plans all 32 records before insertion and independently verifies exact counts and complete ancestry', async () => {
  const { state, store } = mockContent();
  const originalAdmin = copy(state.admin);
  const report = await executeContentProvisioning(mockManifest(), store);
  assert.equal(report.outcome, 'PASS');
  assert.deepEqual(report.verified, {
    created: fullCounts,
    reused: zeroCounts,
    total: fullCounts,
  });
  assert.deepEqual(report.planned, fullCounts);
  assert.deepEqual(report.readback, {
    matched: fullCounts,
    missing: zeroCounts,
    mismatched: zeroCounts,
    unread: zeroCounts,
  });
  const firstInsert = state.events.findIndex((e) => e.startsWith('insert-'));
  assert.equal(
    state.events.slice(0, firstInsert).filter((e) => e.startsWith('prepare-'))
      .length,
    32,
  );
  assert.equal(state.events.filter((e) => e === 'start').length, 1);
  assert.equal(state.events.filter((e) => e === 'commit').length, 1);
  assert(state.events.indexOf('open-read') > state.events.indexOf('end-write'));
  assert.equal(new Set(state.writes).size, 32);
  for (const c of state.db.concepts) {
    const topic = state.db.topics.find((row) =>
      keyMatches(row, { _id: c.topicId }),
    )!;
    const module = state.db.modules.find((row) =>
      keyMatches(row, { _id: c.moduleId }),
    )!;
    const path = state.db.learningPaths.find((row) =>
      keyMatches(row, { _id: c.learningPathId }),
    )!;
    const tech = state.db.technologies.find((row) =>
      keyMatches(row, { _id: c.technologyId }),
    )!;
    assert(topic && module && path && tech);
    assert(
      keyMatches(topic, {
        moduleId: module._id,
        learningPathId: path._id,
        technologyId: tech._id,
      }),
    );
    assert(
      keyMatches(module, { learningPathId: path._id, technologyId: tech._id }),
    );
    assert(keyMatches(path, { technologyId: tech._id }));
    for (const row of [tech, path, module, topic, c])
      assert.equal(row.status, 'PUBLISHED');
    for (const row of [tech, path, c])
      assert(
        keyMatches(row, {
          createdBy: state.admin._id,
          updatedBy: state.admin._id,
        }),
      );
    assert.deepEqual(
      c.read,
      mockManifest().technologies[0]!.paths[0]!.modules[0]!.topics[0]!
        .concepts[0]!.read,
    );
    assert.deepEqual(
      c.source,
      mockManifest().technologies[0]!.paths[0]!.modules[0]!.topics[0]!
        .concepts[0]!.source,
    );
  }
  assert.deepEqual(state.admin, originalAdmin);
});

test('content identical reuse and mixed insertion report exact counts without changing existing records or accounts', async () => {
  const { state, store } = await seededContent();
  state.db.technologies.push({
    _id: oid(),
    slug: 'unrelated',
    status: 'DRAFT',
    privateNote: 'keep',
  });
  const original = copy(state.db);
  const admin = copy(state.admin);
  let report = await executeContentProvisioning(mockManifest(), store);
  assert.deepEqual(report.verified, {
    created: zeroCounts,
    reused: fullCounts,
    total: fullCounts,
  });
  assert.equal(state.writes.length, 0);
  assert.deepEqual(state.db, original);
  state.db.concepts.splice(10);
  const retained = copy(state.db);
  report = await executeContentProvisioning(mockManifest(), store);
  assert.deepEqual(report.verified, {
    created: { ...zeroCounts, concepts: 10 },
    reused: { ...fullCounts, concepts: 10 },
    total: fullCounts,
  });
  assert.equal(state.writes.length, 10);
  for (const kind of contentKinds)
    for (const row of retained[kind])
      assert.deepEqual(
        state.db[kind].find((r) => keyMatches(r, { _id: row._id })),
        row,
      );
  assert.deepEqual(state.admin, admin);
});

test('content preflight rejects conflicting status, hierarchy, provenance and contents before any insert', async () => {
  const base = await seededContent();
  const mutations: ((rows: ContentRows) => void)[] = [
    (rows) => {
      rows.technologies[0]!.status = 'ARCHIVED';
    },
    (rows) => {
      rows.learningPaths[0]!.createdBy = oid();
    },
    (rows) => {
      rows.modules[0]!.technologyId = oid();
    },
    (rows) => {
      rows.topics[0]!.learningPathId = oid();
    },
    (rows) => {
      rows.concepts[19]!.title = 'Conflicting title';
    },
    (rows) => {
      rows.concepts[19]!.read = { summary: 'Other', bodyMarkdown: 'Other' };
    },
    (rows) => {
      rows.concepts[19]!.source = { label: 'Other' };
    },
    (rows) => {
      rows.concepts[19]!.order = 500;
    },
    (rows) => {
      rows.concepts[19]!.updatedBy = String(base.state.admin._id);
    },
    (rows) => {
      rows.concepts[19]!.unapprovedField = true;
    },
    (rows) => {
      rows.concepts.push({ ...copy(rows.concepts[19]!), _id: oid() });
    },
  ];
  for (const change of mutations) {
    const { state, store } = mockContent(base.state.db);
    state.admin = copy(base.state.admin);
    change(state.db);
    // Earlier missing content would be inserted before a late conflict without full preflight.
    state.db.concepts.shift();
    const before = copy(state.db);
    const report = await executeContentProvisioning(mockManifest(), store);
    assert.equal(report.outcome, 'FAIL');
    assert.equal(report.phase, 'PREFLIGHT');
    assert.equal(report.reason, 'EXISTING_CONTENT_CONFLICT');
    assert.equal(report.verified, null);
    assert.equal(state.writes.length, 0);
    assert(!state.events.includes('commit'));
    assert.deepEqual(state.db, before);
  }
});

test('content transaction-time conflict and duplicate insert failure never replay or update records', async () => {
  for (const mode of ['conflict', 'duplicate'] as const) {
    const { state, store } = mockContent();
    let techReads = 0;
    state.beforeFind = (kind, key, readOnly, rows) => {
      if (
        !readOnly &&
        kind === 'technologies' &&
        ++techReads === 3 &&
        mode === 'conflict'
      )
        rows.technologies.push({ _id: oid(), slug: key.slug });
    };
    if (mode === 'duplicate') state.failWriteAt = 8;
    const report = await executeContentProvisioning(mockManifest(), store);
    assert.equal(report.outcome, 'FAIL');
    assert.equal(report.phase, 'WRITE');
    assert.equal(report.verified, null);
    assert.equal(report.rollback, 'REQUESTED');
    assert.equal(
      report.reason,
      mode === 'conflict'
        ? 'TRANSACTION_CONTENT_CONFLICT'
        : 'CONTENT_OPERATION_FAILED',
    );
    assert.equal(state.events.filter((e) => e === 'start').length, 1);
    assert.equal(state.events.filter((e) => e === 'abort').length, 1);
    assert(!state.events.includes('commit'));
    assert.equal(state.writes.length, mode === 'conflict' ? 0 : 8);
    assert.equal(new Set(state.writes).size, state.writes.length);
    assert.deepEqual(state.db, emptyRows());
    assert(!JSON.stringify(report).includes('private'));
  }
});

test('content unknown commit is reconciled only by complete independent persistence with no repeated writes', async () => {
  for (const mode of ['unknown-applied', 'unknown-absent'] as const) {
    const { state, store } = mockContent();
    state.commit = mode;
    const report = await executeContentProvisioning(mockManifest(), store);
    assert.equal(state.events.filter((e) => e === 'commit').length, 1);
    assert.equal(state.events.filter((e) => e === 'start').length, 1);
    assert(!state.events.includes('abort'));
    assert.equal(state.writes.length, 32);
    assert.equal(new Set(state.writes).size, 32);
    if (mode === 'unknown-applied') {
      assert.equal(report.outcome, 'PASS');
      assert.equal(report.commit, 'RECONCILED');
      assert.deepEqual(report.verified, {
        created: fullCounts,
        reused: zeroCounts,
        total: fullCounts,
      });
    } else {
      assert.equal(report.outcome, 'INDETERMINATE');
      assert.equal(report.commit, 'UNKNOWN');
      assert.equal(report.verified, null);
      assert.deepEqual(report.readback.missing, fullCounts);
    }
    assert(!JSON.stringify(report).includes('private'));
  }
});

test('content readback detects missing/replaced identities, duplicate keys, all ancestor links and persisted body/source changes', async () => {
  const mutations: ((rows: ContentRows) => void)[] = [
    (rows) => {
      rows.technologies[0]!.status = 'DRAFT';
    },
    (rows) => {
      rows.learningPaths[0]!.technologyId = oid();
    },
    (rows) => {
      rows.modules[0]!.learningPathId = oid();
    },
    (rows) => {
      rows.topics[0]!.moduleId = oid();
    },
    ...[
      'technologyId',
      'learningPathId',
      'moduleId',
      'topicId',
      'createdBy',
      'updatedBy',
    ].map((key) => (rows: ContentRows) => {
      rows.concepts[0]![key] = oid();
    }),
    (rows) => {
      rows.concepts[0]!.slug = 'changed-slug';
    },
    (rows) => {
      rows.concepts[0]!.order = 99;
    },
    (rows) => {
      rows.concepts[0]!.read = { summary: 'Changed', bodyMarkdown: 'Changed' };
    },
    (rows) => {
      rows.concepts[0]!.source = { label: 'Changed' };
    },
    (rows) => {
      rows.concepts[0]!._id = oid();
    },
    (rows) => {
      rows.concepts.shift();
    },
    (rows) => {
      rows.concepts.push({ ...copy(rows.concepts[0]!), _id: oid() });
    },
  ];
  for (const change of mutations) {
    const { state, store } = mockContent();
    state.afterCommit = () => change(state.db);
    const report = await executeContentProvisioning(mockManifest(), store);
    assert.equal(report.outcome, 'FAIL');
    assert.equal(report.commit, 'ACKNOWLEDGED');
    assert.equal(report.reason, 'CONTENT_READBACK_MISMATCH');
    assert.equal(report.verified, null);
    assert.equal(state.writes.length, 32);
    assert(
      contentKinds.some(
        (k) => report.readback.missing[k] || report.readback.mismatched[k],
      ),
    );
    assert.deepEqual(report.readback.unread, zeroCounts);
  }
});

test('content partial or unavailable readback after uncertain commit remains INDETERMINATE without repair', async () => {
  for (const mode of ['missing', 'mismatch', 'read-error'] as const) {
    const { state, store } = mockContent();
    state.commit = 'unknown-applied';
    state.afterCommit = () => {
      if (mode === 'missing') state.db.concepts.splice(7);
      if (mode === 'mismatch') state.db.concepts[0]!.status = 'DRAFT';
    };
    state.beforeFind = (kind, _key, readOnly) => {
      if (readOnly && kind === 'concepts' && mode === 'read-error')
        throw new Error('private read detail');
    };
    const report = await executeContentProvisioning(mockManifest(), store);
    assert.equal(report.outcome, 'INDETERMINATE');
    assert.equal(report.verified, null);
    assert.equal(report.commit, 'UNKNOWN');
    assert.equal(state.writes.length, 32);
    assert.equal(state.events.filter((e) => e === 'commit').length, 1);
    assert(!state.events.includes('abort'));
    if (mode === 'missing') {
      assert.equal(report.readback.matched.concepts, 7);
      assert.equal(report.readback.missing.concepts, 13);
    }
    if (mode === 'read-error')
      assert.equal(report.readback.unread.concepts, 20);
    assert(!JSON.stringify(report).includes('private'));
  }
});

test('content Admin eligibility and unchanged ObjectId provenance are checked before writes and at readback', async () => {
  for (const field of ['role', 'status', 'email', 'emailVerifiedAt'] as const) {
    const { state, store } = mockContent();
    state.admin[field] = null;
    const report = await executeContentProvisioning(mockManifest(), store);
    assert.equal(report.reason, 'ADMIN_PROVENANCE_REQUIRED');
    assert.equal(state.writes.length, 0);
    assert.equal(report.verified, null);
  }
  for (const mode of ['identity', 'eligibility'] as const) {
    const { state, store } = mockContent();
    state.afterCommit = () => {
      state.admin[mode === 'identity' ? '_id' : 'status'] =
        mode === 'identity' ? oid() : 'SUSPENDED';
    };
    const report = await executeContentProvisioning(mockManifest(), store);
    assert.equal(report.outcome, 'FAIL');
    assert.equal(report.verified, null);
    assert.equal(
      report.reason,
      mode === 'identity'
        ? 'ADMIN_READBACK_MISMATCH'
        : 'ADMIN_PROVENANCE_REQUIRED',
    );
  }
});

test('content read-session and cleanup failures never report PASS or verified totals', async () => {
  for (const mode of ['open-read', 'end-read', 'end-write', 'abort'] as const) {
    const { state, store } = mockContent();
    if (mode === 'open-read')
      state.readOpen = () => {
        throw new Error('private open detail');
      };
    if (mode === 'end-read') state.endFails = 'read';
    if (mode === 'end-write') state.endFails = 'write';
    if (mode === 'abort') {
      state.failWriteAt = 1;
      state.abortFails = true;
    }
    const report = await executeContentProvisioning(mockManifest(), store);
    assert.notEqual(report.outcome, 'PASS');
    if (mode === 'open-read') assert.equal(report.outcome, 'INDETERMINATE');
    assert.equal(report.verified, null);
    assert.equal(state.events.filter((e) => e === 'start').length, 1);
    if (mode === 'abort') {
      assert.equal(report.outcome, 'INDETERMINATE');
      assert.equal(report.rollback, 'UNCONFIRMED');
      assert(!state.events.includes('commit'));
    }
    assert(!JSON.stringify(report).includes('private'));
  }
});
