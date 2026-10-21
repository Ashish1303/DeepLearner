/** INTERNAL INITIALIZER, not a CLI or public route. Execution requires separate
 * owner approval and the existing external native-handle/Job supervisor.
 * This module does not authenticate a GO message or attest physical storage.
 * The trusted harness supplies live supervisor operations, not serialized flags.
 * Importing it performs no connection, account creation, provisioning or startup. */
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createServer, type Server } from 'node:http';
import type { Readable } from 'node:stream';
import { z } from 'zod';
import { Types } from 'mongoose';
import { mongoose, createDatabase } from '../src/config/database.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { hashPassword } from '../src/modules/auth/password.service.js';
import { createLoginService } from '../src/modules/auth/login.service.js';
import { loginRepository } from '../src/modules/auth/login.repository.js';
import { createLogoutService } from '../src/modules/auth/logout.service.js';
import { logoutRepository } from '../src/modules/auth/logout.repository.js';
import { User } from '../src/modules/users/user.model.js';
import { Session } from '../src/modules/auth/session.model.js';
import { Technology } from '../src/modules/technologies/technology.model.js';
import { LearningPath } from '../src/modules/learning-paths/learning-path.model.js';
import { Module } from '../src/modules/modules/module.model.js';
import { Topic } from '../src/modules/topics/topic.model.js';
import { Visualization } from '../src/modules/visualizations/visualization.model.js';
import { createCompletionEvidenceService } from '../src/modules/progress/completion-evidence.service.js';
import { completionIndexes } from '../src/modules/progress/completion.repository.js';
import { createPracticeGradingService } from '../src/modules/practice/practice-grading.service.js';
import { practiceRepository } from '../src/modules/practice/practice.repository.js';
import { createVisualizationCheckpointService } from '../src/modules/visualizations/visualization-checkpoint.service.js';
import { installShutdown } from './local-tools.js';

export const fixtureTarget = Object.freeze({
  uri: 'mongodb://127.0.0.1:27018/?replicaSet=f021-test',
  database: 'deeplearner-f021-test',
  replicaSet: 'f021-test',
  host: '127.0.0.1:27018',
});
const failure = () => new Error('COMPLETION_FIXTURE_UNAVAILABLE');
const credentialsSchema = z.strictObject({
  author: z.string().min(10).max(128),
  reviewer: z.string().min(10).max(128),
  student: z.string().min(10).max(128),
});
export function parseFixtureCredentials(input: unknown) {
  const result = credentialsSchema.safeParse(input);
  if (!result.success) throw failure();
  return result.data;
}
export async function readFixtureCredentials(input: Readable) {
  // Caller verifies this private owned pipe before invoking; pipe contents alone
  // never authorize bootstrap. No echo, prompt, logging or output of passwords.
  return new Promise<ReturnType<typeof parseFixtureCredentials>>(
    (resolve, reject) => {
      input.setEncoding('utf8');
      let text = '',
        bytes = 0,
        finished = false;
      const clear = () => {
        clearTimeout(timer);
        input.off('data', data);
        input.off('end', invalid);
        input.off('error', invalid);
        input.pause();
        text = '';
      };
      const invalid = () => {
        if (finished) return;
        finished = true;
        clear();
        input.destroy();
        reject(failure());
      };
      const data = (chunk: Buffer | string) => {
        if (finished) return;
        bytes += Buffer.byteLength(chunk);
        if (bytes > 8192) {
          invalid();
          return;
        }
        text += String(chunk);
        const end = text.indexOf('\n');
        if (end < 0) return;
        try {
          if (text.slice(end + 1).length) throw failure();
          const value = parseFixtureCredentials(JSON.parse(text.slice(0, end)));
          finished = true;
          clear();
          resolve(value);
        } catch {
          invalid();
        }
      };
      const timer = setTimeout(invalid, 15000);
      input.on('data', data);
      input.once('end', invalid);
      input.once('error', invalid);
    },
  );
}
export interface FixtureIndex {
  collection: string;
  name: string;
  key: Record<string, 1 | -1>;
  unique: boolean;
  partialFilterExpression?: Record<string, unknown>;
  expireAfterSeconds?: number;
}
export const fixtureIndexes: readonly FixtureIndex[] = Object.freeze([
  ...completionIndexes,
  { collection: 'users', name: 'email_1', key: { email: 1 }, unique: true },
  {
    collection: 'users',
    name: 'status_1_createdAt_-1',
    key: { status: 1, createdAt: -1 },
    unique: false,
  },
  {
    collection: 'users',
    name: 'plan_1_createdAt_-1',
    key: { plan: 1, createdAt: -1 },
    unique: false,
  },
  {
    collection: 'users',
    name: 'role_1_createdAt_-1',
    key: { role: 1, createdAt: -1 },
    unique: false,
  },
  {
    collection: 'users',
    name: 'authProviders.provider_1_authProviders.providerUserId_1',
    key: { 'authProviders.provider': 1, 'authProviders.providerUserId': 1 },
    unique: true,
    partialFilterExpression: {
      'authProviders.providerUserId': { $type: 'string' },
    },
  },
  {
    collection: 'sessions',
    name: 'refreshTokenHash_1',
    key: { refreshTokenHash: 1 },
    unique: true,
  },
  {
    collection: 'sessions',
    name: 'userId_1_revokedAt_1',
    key: { userId: 1, revokedAt: 1 },
    unique: false,
  },
  {
    collection: 'sessions',
    name: 'expiresAt_1',
    key: { expiresAt: 1 },
    unique: false,
    expireAfterSeconds: 0,
  },
]);
export function verifyFixtureIndex(
  actual: Record<string, unknown>,
  expected: FixtureIndex,
) {
  const allowed = [
    'v',
    'name',
    'key',
    'unique',
    ...(expected.partialFilterExpression ? ['partialFilterExpression'] : []),
    ...(expected.expireAfterSeconds === undefined
      ? []
      : ['expireAfterSeconds']),
  ];
  if (
    actual.v !== 2 ||
    actual.name !== expected.name ||
    JSON.stringify(actual.key) !== JSON.stringify(expected.key) ||
    (actual.unique === true) !== expected.unique ||
    (actual.unique !== undefined && typeof actual.unique !== 'boolean') ||
    JSON.stringify(actual.partialFilterExpression) !==
      JSON.stringify(expected.partialFilterExpression) ||
    actual.expireAfterSeconds !== expected.expireAfterSeconds ||
    Object.keys(actual).some((k) => !allowed.includes(k))
  )
    throw failure();
}
/** Code dependencies supplied only by the owner-approved guarded harness.
 * assertOwned must execute retained native-handle/executable/owner/parent/Job/
 * microsecond time/storage/baseline checks, not return caller claims. The same
 * supervisor remains alive and kills its exact Job if its lifecycle is lost.
 * onLoss must notify this serving process; no GO/LOCAL/JSON attestation adapter.
 * No production caller or HTTP request can construct a fixture through a route. */
export interface SupervisedFixtureInitialization {
  assertOwned(): Promise<void>;
  onLoss(stop: () => void): () => void;
  readCredentials(): Promise<unknown>;
  dbPath: string;
  mongoPid: number;
}
export function requireFixtureInitialization(
  value: SupervisedFixtureInitialization | undefined,
): asserts value is SupervisedFixtureInitialization {
  if (
    !value ||
    typeof value.assertOwned !== 'function' ||
    typeof value.onLoss !== 'function' ||
    typeof value.readCredentials !== 'function' ||
    !Number.isSafeInteger(value.mongoPid) ||
    value.mongoPid < 1 ||
    typeof value.dbPath !== 'string' ||
    !path.isAbsolute(value.dbPath)
  )
    throw failure();
}
export async function initializeCompletionStudentFixture(
  initialization: SupervisedFixtureInitialization,
) {
  requireFixtureInitialization(initialization);
  // These callable code dependencies are not proof by their mere presence. Only
  // the approved supervisor's trusted initializer may supply their implementation.
  try {
    await initialization.assertOwned();
  } catch {
    throw failure();
  }
  const { env } = await import('../src/config/env.js');
  if (
    env.APP_ENV !== 'LOCAL' ||
    env.MONGODB_URI !== fixtureTarget.uri ||
    env.MONGODB_DB_NAME !== fixtureTarget.database ||
    env.MONGODB_TLS !== false ||
    env.PORT !== 4000 ||
    env.WEB_ORIGIN !== 'http://127.0.0.1:3000'
  )
    throw failure();
  if (mongoose.connection.readyState !== 0) throw failure();
  const database = createDatabase(mongoose, env, {
    info() {},
    warn() {},
    error() {},
  });
  const tokens = createAccessTokens(env);
  let credentials: ReturnType<typeof parseFixtureCredentials> | undefined;
  let server: Server | undefined,
    disposed = false;
  let origin: ReturnType<typeof createCompletionEvidenceService> | undefined;
  let unsubscribe: (() => void) | undefined;
  let closing: Promise<void> | undefined;
  function stop(): Promise<void> {
    if (closing) return closing;
    disposed = true;
    credentials = undefined;
    closing = Promise.resolve().then(async () => {
      try {
        origin?.dispose();
        unsubscribe?.();
      } finally {
        try {
          if (server?.listening) {
            server.closeAllConnections();
            await new Promise<void>((resolve, reject) =>
              server!.close((e) => (e ? reject(failure()) : resolve())),
            );
          }
        } finally {
          try {
            await database.disconnect();
          } finally {
            process.stdin.destroy();
          }
        }
      }
    });
    return closing;
  }
  try {
    unsubscribe = initialization.onLoss(() => {
      origin?.dispose();
      void stop().catch(() => {
        process.exitCode = 1;
      });
    });
    // Reserve our own API listener before writes; an occupied port is terminal.
    // Only a sanitized unavailable response is possible before initialization.
    server = createServer((_req, res) => {
      res.writeHead(503, { 'Cache-Control': 'no-store' });
      res.end();
    });
    await new Promise<void>((resolve, reject) => {
      server!.once('error', () => reject(failure()));
      server!.listen(4000, '127.0.0.1', resolve);
    });
    await database.connect();
    const db = mongoose.connection.db!;
    const client = mongoose.connection.getClient();
    const sameGeneration = async () => {
      if (
        disposed ||
        mongoose.connection.readyState !== 1 ||
        mongoose.connection.getClient() !== client ||
        mongoose.connection.db !== db
      )
        throw failure();
      await initialization.assertOwned();
      if (disposed) throw failure();
    };
    await sameGeneration();
    const opts = { timeoutMS: 5000 };
    const admin = db.admin(),
      h = await admin.command({ hello: 1 }, opts),
      cmd = await admin.command({ getCmdLineOpts: 1 }, opts),
      status = await admin.command({ serverStatus: 1 }, opts),
      repl = await admin.command({ replSetGetConfig: 1 }, opts);
    const parsed = cmd.parsed;
    if (
      db.databaseName !== fixtureTarget.database ||
      h.isWritablePrimary !== true ||
      h.setName !== fixtureTarget.replicaSet ||
      h.hosts?.length !== 1 ||
      h.hosts[0] !== fixtureTarget.host ||
      parsed?.net?.bindIp !== '127.0.0.1' ||
      parsed.net.port !== 27018 ||
      parsed.replication?.replSet !== fixtureTarget.replicaSet ||
      path.resolve(parsed.storage?.dbPath ?? '').toLowerCase() !==
        path.resolve(initialization.dbPath).toLowerCase() ||
      Number(status.pid) !== initialization.mongoPid ||
      repl.config?._id !== fixtureTarget.replicaSet ||
      repl.config.members?.length !== 1 ||
      repl.config.members[0].host !== fixtureTarget.host
    )
      throw failure();
    const databases = await admin.listDatabases({
      nameOnly: true,
      timeoutMS: 5000,
    });
    if (
      databases.databases.some(
        (d) =>
          !['admin', 'config', 'local', fixtureTarget.database].includes(
            d.name,
          ),
      )
    )
      throw failure();
    // The separately approved supervisor provisions empty collections/indexes.
    // This initializer never provisions, syncs, migrates or backfills anything.
    const collections = await db
      .listCollections({}, { ...opts, nameOnly: false })
      .toArray();
    const allowedCollections = new Set([
      ...fixtureIndexes.map((i) => i.collection),
      'auditLogs',
      'technologies',
      'learningPaths',
      'modules',
      'topics',
      'concepts',
      'practiceQuestions',
      'visualizations',
    ]);
    for (const collection of collections) {
      if (
        !allowedCollections.has(collection.name) ||
        collection.type !== 'collection' ||
        Object.keys(collection.options ?? {}).length ||
        (await db
          .collection(collection.name)
          .countDocuments({}, { limit: 1, timeoutMS: 5000 })) !== 0
      )
        throw failure();
    }
    for (const expected of fixtureIndexes) {
      const indexes = await db.collection(expected.collection).indexes(opts);
      const actual = indexes.find((i) => i.name === expected.name);
      if (!actual) throw failure();
      verifyFixtureIndex(actual, expected);
      if (
        indexes.some(
          (i) =>
            i.name !== '_id_' &&
            !fixtureIndexes.some(
              (v) => v.collection === expected.collection && v.name === i.name,
            ),
        )
      )
        throw failure();
    }
    for (const collection of allowedCollections)
      if (!collections.some((c) => c.name === collection)) throw failure();
    await sameGeneration();
    credentials = parseFixtureCredentials(
      await initialization.readCredentials(),
    );
    const author = new Types.ObjectId(),
      reviewer = new Types.ObjectId(),
      authorEmail =
        'completion-author-' + author.toHexString() + '@example.invalid',
      reviewerEmail =
        'completion-reviewer-' + reviewer.toHexString() + '@example.invalid';
    const authorHash = await hashPassword(credentials.author),
      reviewerHash = await hashPassword(credentials.reviewer);
    await sameGeneration();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(
        async () => {
          await sameGeneration();
          await new User({
            _id: author,
            email: authorEmail,
            firstName: 'Synthetic',
            lastName: 'Author',
            role: 'ADMIN',
            plan: 'FREE',
            status: 'ACTIVE',
            emailVerifiedAt: new Date(),
            passwordHash: authorHash,
            authProviders: [],
          }).save({ session });
          await new User({
            _id: reviewer,
            email: reviewerEmail,
            firstName: 'Synthetic',
            lastName: 'Reviewer',
            role: 'ADMIN',
            plan: 'FREE',
            status: 'ACTIVE',
            emailVerifiedAt: new Date(),
            passwordHash: reviewerHash,
            authProviders: [],
          }).save({ session });
        },
        {
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority', wtimeoutMS: 2000 },
          readPreference: 'primary',
          timeoutMS: 10000,
        },
      );
    } finally {
      await session.endSession();
    }
    await sameGeneration();
    const login = createLoginService({
      repository: loginRepository,
      tokens,
      log: { warn() {} },
    });
    let authored = await login.login(
      { email: authorEmail, password: credentials.author },
      randomUUID(),
    );
    let reviewed = await login.login(
      { email: reviewerEmail, password: credentials.reviewer },
      randomUUID(),
    );
    credentials.author = '';
    credentials.reviewer = '';
    const a = await tokens.verify(authored.accessToken),
      r = await tokens.verify(reviewed.accessToken);
    if (
      a.sub !== author.toHexString() ||
      r.sub !== reviewer.toHexString() ||
      a.sub === r.sub ||
      a.sid === r.sid ||
      a.role !== 'ADMIN' ||
      r.role !== 'ADMIN'
    )
      throw failure();
    for (const actor of [a, r]) {
      const current = await User.findById(actor.sub)
        .select('role status emailVerifiedAt')
        .lean();
      const liveSession = await Session.findOne({
        _id: new Types.ObjectId(actor.sid),
        userId: new Types.ObjectId(actor.sub),
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      }).lean();
      if (
        !current ||
        current.role !== 'ADMIN' ||
        current.status !== 'ACTIVE' ||
        !current.emailVerifiedAt ||
        !liveSession
      )
        throw failure();
    }
    const technology = new Technology({
      name: 'Completion fixture',
      slug: 'completion-' + author,
      status: 'PUBLISHED',
      createdBy: author,
      updatedBy: author,
    });
    await technology.save();
    const learningPath = await new LearningPath({
      technologyId: technology._id,
      title: 'Completion fixture path',
      slug: 'completion-' + author,
      status: 'PUBLISHED',
      completionScore: 70,
      createdBy: author,
      updatedBy: author,
    }).save();
    const module = await new Module({
      technologyId: technology._id,
      learningPathId: learningPath._id,
      title: 'Completion fixture module',
      slug: 'completion-' + author,
      status: 'PUBLISHED',
    }).save();
    const topic = await new Topic({
      technologyId: technology._id,
      learningPathId: learningPath._id,
      moduleId: module._id,
      title: 'Completion fixture topic',
      slug: 'completion-' + author,
      status: 'PUBLISHED',
    }).save();
    origin = createCompletionEvidenceService(
      tokens,
      env,
      undefined,
      undefined,
      async () => {
        await sameGeneration();
        if (!credentials?.student) throw failure();
        const password = credentials.student;
        credentials.student = '';
        return password;
      },
    );
    const created = await origin.create(authored.accessToken, {
      topicId: topic.id,
      summary: 'Follow a single value through an unchanged node.',
      bodyMarkdown:
        'A value enters a node and remains unchanged. Read the flow and compare the example.',
      example: 'The output of the literal expression `1` is `1`.',
      prompt: 'What is the output of the literal expression `1`?',
      answer: '1',
    });
    credentials = undefined;
    const visualization = await new Visualization({
      conceptId: new Types.ObjectId(created.conceptId),
      topicId: topic._id,
      technologyId: technology._id,
      status: 'PUBLISHED',
      type: 'ANIMATED_FLOW',
      schemaVersion: 1,
      title: 'Unchanged value',
      textAlternative:
        'The input value stays in one node. No animation is needed to identify the node.',
      nodes: [{ id: 'value', label: 'Unchanged value' }],
      edges: [],
      steps: [
        {
          title: 'Observe the value',
          explanation: 'The value remains in the same node.',
          nodeIds: ['value'],
          edgeIds: [],
        },
      ],
      createdBy: author,
      updatedBy: author,
    }).save();
    await sameGeneration();
    const visual = createVisualizationCheckpointService(tokens, env);
    const definition = await visual.author(
      authored.accessToken,
      {
        conceptId: created.conceptId,
        visualizationId: visualization.id,
        checkpointId: 'unchanged',
        checkpointVersion: 1,
        prompt: 'Which node is present in the flow?',
        textAlternative: 'A single node labelled Unchanged value is present.',
        choices: [
          { id: 'value', label: 'Unchanged value' },
          { id: 'other', label: 'Another node' },
        ],
        expectedChoiceId: 'value',
      },
      randomUUID(),
    );
    await visual.approve(
      reviewed.accessToken,
      { definitionId: definition.id },
      randomUUID(),
    );
    const source = await practiceRepository.qualified(
      created.questionId,
      created.conceptId,
    );
    if (!source) throw failure();
    const grading = createPracticeGradingService(tokens, env),
      rubric = await grading.author(
        authored.accessToken,
        {
          questionId: created.questionId,
          conceptId: created.conceptId,
          questionRevision: source.questionRevision,
          type: 'OUTPUT',
          answerForm: 'TEXT',
          comparison: 'EXACT_TEXT',
          normalization: 'NONE',
          expectedAnswer: '1',
        },
        randomUUID(),
      );
    await grading.approve(
      reviewed.accessToken,
      { rubricId: rubric.rubricId, version: rubric.version },
      randomUUID(),
    );
    const policy = await origin.author(authored.accessToken, {
      conceptId: created.conceptId,
      rubricId: rubric.rubricId,
      rubricVersion: rubric.version,
      checkpointDefinitionId: definition.id,
      minimumScore: 70,
    });
    await origin.approve(reviewed.accessToken, {
      conceptId: created.conceptId,
      version: policy.version,
    });
    // Revoke the setup refresh sessions through existing repository behavior;
    // short-lived access JWTs are not claimed to be immediately invalidated.
    const logout = createLogoutService(logoutRepository);
    await logout.logout(authored.refreshToken, randomUUID());
    await logout.logout(reviewed.refreshToken, randomUUID());
    authored = { ...authored, accessToken: '', refreshToken: '' };
    reviewed = { ...reviewed, accessToken: '', refreshToken: '' };
    await sameGeneration();
    const { createApp } = await import('../src/app.js');
    const app = createApp();
    server.removeAllListeners('request');
    server.on('request', app);
    await sameGeneration();
    // Reuse the existing bounded STOP/EOF lifecycle on the same private pipe.
    // This is shutdown control only, never bootstrap authentication.
    installShutdown(stop);
    return Object.freeze({
      studentEmail: 'synthetic-' + created.userId + '@example.invalid',
      conceptId: created.conceptId,
      conceptUrl: 'http://127.0.0.1:3000/concepts/' + created.conceptId,
      stop,
    });
  } catch {
    await stop().catch(() => {
      process.exitCode = 1;
    });
    throw failure();
  }
}
