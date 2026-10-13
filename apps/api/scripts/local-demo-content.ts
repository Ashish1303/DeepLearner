import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { ClientSession, Model, Types } from 'mongoose';
import { mongoose } from '../src/config/database.js';
import { User } from '../src/modules/users/user.model.js';
import { Technology } from '../src/modules/technologies/technology.model.js';
import { LearningPath } from '../src/modules/learning-paths/learning-path.model.js';
import { Module } from '../src/modules/modules/module.model.js';
import { Topic } from '../src/modules/topics/topic.model.js';
import { Concept } from '../src/modules/concepts/concept.model.js';
import { LocalError, digestBytes } from './local-tools.js';

// Mechanism only. No content records, source URLs or Admin IDs are supplied.
const text = (max: number) => z.string().trim().min(1).max(max);
const slug = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/);
const level = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
const fields = {
  title: text(120),
  slug,
  description: z.string().max(2000).optional(),
  order: z.number().int().nonnegative(),
  status: z.literal('PUBLISHED'),
};
const concept = z.strictObject({
  title: text(120),
  slug,
  order: fields.order,
  status: fields.status,
  difficulty: z.enum([
    'BEGINNER',
    'INTERMEDIATE',
    'ADVANCED',
    'INTERVIEW_READY',
  ]),
  contentFormat: z.literal('MARKDOWN'),
  schemaVersion: z.literal(1),
  read: z.strictObject({
    summary: text(2000),
    bodyMarkdown: z
      .string()
      .min(1)
      .max(50000)
      .refine((value) => !!value.trim()),
  }),
  source: z.strictObject({
    label: text(120),
    url: z
      .string()
      .max(2048)
      .refine((value) => {
        try {
          const url = new URL(value);
          return (
            /^https:\/\//i.test(value) &&
            !/[\s\\]/.test(value) &&
            url.protocol === 'https:' &&
            !url.username &&
            !url.password
          );
        } catch {
          return false;
        }
      }),
    sourceType: z.literal('OFFICIAL_OR_TRUSTED'),
    isOfficial: z.boolean(),
  }),
});
const children = <T extends z.ZodType<{ slug: string }>>(schema: T) =>
  z
    .array(schema)
    .min(1)
    .max(30)
    .refine(
      (rows) => new Set(rows.map((row) => row.slug)).size === rows.length,
    );
export const contentManifest = z.strictObject({
  revision: z.literal(1),
  database: z.literal('deeplearner-local-demo'),
  synthetic: z.literal(true),
  technologies: children(
    z.strictObject({
      name: text(80),
      slug: z.enum(['javascript', 'typescript']),
      description: fields.description,
      iconAssetId: z.null(),
      order: fields.order,
      status: fields.status,
      paths: children(
        z.strictObject({
          ...fields,
          targetLevel: level.nullable(),
          completionScore: z.number().int().min(0).max(100),
          modules: children(
            z.strictObject({
              ...fields,
              topics: children(
                z.strictObject({ ...fields, concepts: children(concept) }),
              ),
            }),
          ),
        }),
      ),
    }),
  ).max(2),
});
export function validateManifest(bytes: Buffer, expectedHash: string) {
  if (
    bytes.length > 1_000_000 ||
    !/^[a-f0-9]{64}$/i.test(expectedHash) ||
    digestBytes(bytes) !== expectedHash.toLowerCase()
  )
    throw new LocalError('MANIFEST_HASH_REJECTED');
  return contentManifest.parse(JSON.parse(bytes.toString('utf8')));
}
function normalized(value: unknown): unknown {
  if (value instanceof mongoose.Types.ObjectId) return value.toHexString();
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, normalized(v)]),
    );
  return value;
}
export function matchesApprovedRecord(
  actual: Record<string, unknown>,
  desired: Record<string, unknown>,
) {
  const content = (record: Record<string, unknown>) =>
    normalized(
      Object.fromEntries(
        Object.entries(record).filter(
          ([key, value]) =>
            !['_id', '__v', 'createdAt', 'updatedAt'].includes(key) &&
            value !== undefined,
        ),
      ),
    );
  // Compare both directions: unexpected stored content must not be silently reused.
  return (
    Object.entries(desired).every(
      ([key, value]) =>
        !(value instanceof mongoose.Types.ObjectId) ||
        key === '_id' ||
        (actual[key] instanceof mongoose.Types.ObjectId &&
          value.equals(actual[key] as Types.ObjectId)),
    ) && JSON.stringify(content(actual)) === JSON.stringify(content(desired))
  );
}

export const contentKinds = [
  'technologies',
  'learningPaths',
  'modules',
  'topics',
  'concepts',
] as const;
type Kind = (typeof contentKinds)[number];
type Counts = Record<Kind, number>;
type RecordData = Record<string, unknown> & { _id: unknown };
type Manifest = z.infer<typeof contentManifest>;
export interface ContentSession {
  startTransaction(options: {
    readConcern: { level: 'snapshot' };
    writeConcern: { w: 'majority' };
    readPreference: 'primary';
  }): void;
  commitTransaction(): Promise<void>;
  abortTransaction(): Promise<void>;

  endSession(): Promise<void>;
}
export interface ContentStore {
  openSession(readOnly: boolean): Promise<ContentSession>;
  admin(session: ContentSession): Promise<RecordData | null>;
  prepare(kind: Kind, data: Record<string, unknown>): Promise<RecordData>;
  find(
    kind: Kind,
    key: Record<string, unknown>,
    session: ContentSession,
  ): Promise<RecordData[]>;
  insert(
    kind: Kind,
    data: RecordData,
    session: ContentSession,
  ): Promise<RecordData>;
}
interface PlannedRecord {
  kind: Kind;
  key: Record<string, unknown>;
  data: RecordData;
  reused: boolean;
}
const counts = (): Counts => ({
  technologies: 0,
  learningPaths: 0,
  modules: 0,
  topics: 0,
  concepts: 0,
});
const sameId = (a: unknown, b: unknown) =>
  a instanceof mongoose.Types.ObjectId &&
  b instanceof mongoose.Types.ObjectId &&
  a.equals(b);

function requireAdmin(admin: RecordData | null) {
  if (
    !admin ||
    !(admin._id instanceof mongoose.Types.ObjectId) ||
    admin.email !== 'demo.admin@deeplearner.test' ||
    admin.role !== 'ADMIN' ||
    admin.status !== 'ACTIVE' ||
    !(admin.emailVerifiedAt instanceof Date) ||
    !Number.isFinite(admin.emailVerifiedAt.getTime())
  )
    throw new LocalError('ADMIN_PROVENANCE_REQUIRED');
  return admin;
}
function totals(manifest: Manifest) {
  const result = counts();
  for (const t of manifest.technologies) {
    result.technologies++;
    for (const p of t.paths) {
      result.learningPaths++;
      for (const m of p.modules) {
        result.modules++;
        for (const topic of m.topics) {
          result.topics++;
          result.concepts += topic.concepts.length;
        }
      }
    }
  }
  return result;
}

async function planContent(
  manifest: Manifest,
  adminId: unknown,
  store: ContentStore,
  session: ContentSession,
) {
  const plan: PlannedRecord[] = [];
  const provenance = { createdBy: adminId, updatedBy: adminId };
  const add = async (
    kind: Kind,
    key: Record<string, unknown>,
    data: Record<string, unknown>,
  ) => {
    const candidate = await store.prepare(kind, data);
    const rows = await store.find(kind, key, session);
    if (
      rows.length > 1 ||
      (rows[0] && !matchesApprovedRecord(rows[0], candidate))
    )
      throw new LocalError('EXISTING_CONTENT_CONFLICT');
    const resolved = rows[0] ? { ...candidate, _id: rows[0]._id } : candidate;
    if (
      !(resolved._id instanceof mongoose.Types.ObjectId) ||
      plan.some((p) => p.kind === kind && sameId(p.data._id, resolved._id))
    )
      throw new LocalError('CONTENT_IDENTITY_CONFLICT');
    plan.push({ kind, key, data: resolved, reused: !!rows[0] });
    return resolved._id;
  };
  // All reads and model validation finish before the first insert.
  // IDs for new candidates become actual saved IDs before their children are inserted.
  for (const { paths, ...tech } of manifest.technologies) {
    const technologyId = await add(
      'technologies',
      { slug: tech.slug },
      { ...tech, ...provenance },
    );
    for (const { modules, ...p } of paths) {
      const learningPathId = await add(
        'learningPaths',
        { technologyId, slug: p.slug },
        { ...p, technologyId, ...provenance },
      );
      for (const { topics, ...m } of modules) {
        const moduleId = await add(
          'modules',
          { learningPathId, slug: m.slug },
          { ...m, technologyId, learningPathId },
        );
        for (const { concepts, ...topic } of topics) {
          const topicId = await add(
            'topics',
            { moduleId, slug: topic.slug },
            { ...topic, technologyId, learningPathId, moduleId },
          );
          for (const c of concepts)
            await add(
              'concepts',
              { topicId, slug: c.slug },
              {
                ...c,
                technologyId,
                learningPathId,
                moduleId,
                topicId,
                ...provenance,
              },
            );
        }
      }
    }
  }
  return plan;
}

export interface ContentReport {
  outcome: 'PASS' | 'FAIL' | 'INDETERMINATE';
  phase: 'PREFLIGHT' | 'WRITE' | 'COMMIT' | 'READBACK' | 'COMPLETE';
  reason: string | null;
  planned: Counts;
  // Acknowledged operations inside the transaction, NOT persisted counts.
  transactionObserved: { created: Counts; reused: Counts };
  commit: 'NOT_ATTEMPTED' | 'ACKNOWLEDGED' | 'UNKNOWN' | 'RECONCILED';
  rollback: 'NOT_NEEDED' | 'REQUESTED' | 'UNCONFIRMED';
  readback: {
    matched: Counts;
    missing: Counts;
    mismatched: Counts;
    unread: Counts;
  };
  verified: { created: Counts; reused: Counts; total: Counts } | null;
  sessionCleanup: { write: boolean; read: boolean };
}
export async function executeContentProvisioning(
  input: Manifest,
  store: ContentStore,
): Promise<ContentReport> {
  const manifest = contentManifest.parse(input);
  const report: ContentReport = {
    outcome: 'FAIL',
    phase: 'PREFLIGHT',
    reason: null,
    planned: totals(manifest),
    transactionObserved: { created: counts(), reused: counts() },
    commit: 'NOT_ATTEMPTED',
    rollback: 'NOT_NEEDED',
    readback: {
      matched: counts(),
      missing: counts(),
      mismatched: counts(),
      unread: totals(manifest),
    },
    verified: null,
    sessionCleanup: { write: true, read: true },
  };
  let session: ContentSession | undefined;
  let plan: PlannedRecord[] = [];
  let adminId: unknown;
  let started = false;
  let commitAttempted = false;
  try {
    session = await store.openSession(false);
    session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary',
    });
    started = true;
    adminId = requireAdmin(await store.admin(session))._id;
    plan = await planContent(manifest, adminId, store, session);
    report.phase = 'WRITE';
    for (const item of plan) {
      // Retain transaction-time identity/content checks and insert-only unique-index enforcement.
      const rows = await store.find(item.kind, item.key, session);
      if (item.reused) {
        if (
          rows.length !== 1 ||
          !sameId(rows[0]!._id, item.data._id) ||
          !matchesApprovedRecord(rows[0]!, item.data)
        )
          throw new LocalError('TRANSACTION_CONTENT_CONFLICT');
        report.transactionObserved.reused[item.kind]++;
      } else {
        if (rows.length) throw new LocalError('TRANSACTION_CONTENT_CONFLICT');
        const saved = await store.insert(item.kind, item.data, session);
        if (
          !sameId(saved._id, item.data._id) ||
          !matchesApprovedRecord(saved, item.data)
        )
          throw new LocalError('SAVED_CONTENT_MISMATCH');
        report.transactionObserved.created[item.kind]++;
      }
    }
    report.phase = 'COMMIT';
    commitAttempted = true;
    // No withTransaction callback or transaction replay. The driver may retry the same commit.
    // Exactly one application-level commit invocation; a thrown result never implies rollback.
    try {
      await session.commitTransaction();
      report.commit = 'ACKNOWLEDGED';
    } catch {
      report.commit = 'UNKNOWN';
    }
  } catch (error) {
    report.reason =
      error instanceof LocalError ? error.code : 'CONTENT_OPERATION_FAILED';
    if (session && started && !commitAttempted) {
      try {
        // The driver can swallow abort-command errors; resolution is not proof of rollback.
        await session.abortTransaction();
        report.rollback = 'REQUESTED';
      } catch {
        report.rollback = 'UNCONFIRMED';
        report.outcome = 'INDETERMINATE';
      }
    }
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch {
        report.sessionCleanup.write = false;
      }
    }
  }
  if (!commitAttempted) {
    if (!report.sessionCleanup.write) {
      report.reason ??= 'SESSION_CLEANUP_FAILED';
      report.outcome = 'INDETERMINATE';
    }
    return report;
  }

  report.phase = 'READBACK';
  let readSession: ContentSession | undefined;
  try {
    // Fresh primary snapshot: no reads from the write transaction's cached view.
    readSession = await store.openSession(true);
    if (!sameId(requireAdmin(await store.admin(readSession))._id, adminId))
      throw new LocalError('ADMIN_READBACK_MISMATCH');
    for (const item of plan) {
      // Both identity and unique key are checked, detecting replacement and duplicate matches.
      const rows = await store.find(
        item.kind,
        { $or: [{ _id: item.data._id }, item.key] },
        readSession,
      );
      report.readback.unread[item.kind]--;
      if (!rows.length) report.readback.missing[item.kind]++;
      else if (
        rows.length !== 1 ||
        !sameId(rows[0]!._id, item.data._id) ||
        !matchesApprovedRecord(rows[0]!, item.data)
      )
        report.readback.mismatched[item.kind]++;
      else report.readback.matched[item.kind]++;
    }
    const complete = contentKinds.every(
      (k) => report.readback.matched[k] === report.planned[k],
    );
    if (!complete) throw new LocalError('CONTENT_READBACK_MISMATCH');
    if (report.sessionCleanup.write) {
      report.verified = {
        created: { ...report.transactionObserved.created },
        reused: { ...report.transactionObserved.reused },
        total: { ...report.readback.matched },
      };
      report.outcome = 'PASS';

      if (report.commit === 'UNKNOWN') report.commit = 'RECONCILED';
    } else report.reason = 'SESSION_CLEANUP_FAILED';
  } catch (error) {
    report.reason =
      error instanceof LocalError ? error.code : 'CONTENT_READBACK_FAILED';
    // A read failure cannot establish persistence, even if commit was acknowledged.
    if (!(error instanceof LocalError)) report.outcome = 'INDETERMINATE';
  } finally {
    if (readSession) {
      try {
        await readSession.endSession();
      } catch {
        report.sessionCleanup.read = false;
        report.reason = 'SESSION_CLEANUP_FAILED';
        report.verified = null;
        report.outcome = 'FAIL';
      }
    }
  }
  if (report.outcome === 'PASS') report.phase = 'COMPLETE';
  if (report.outcome !== 'PASS') {
    report.verified = null;
    if (report.commit === 'UNKNOWN') report.outcome = 'INDETERMINATE';
  }
  return report;
}

const models = {
  technologies: Technology,
  learningPaths: LearningPath,
  modules: Module,
  topics: Topic,
  concepts: Concept,
};
const modelFor = (kind: Kind) =>
  models[kind] as unknown as Model<Record<string, unknown>>;
const databaseStore: ContentStore = {
  openSession: async (readOnly) =>
    mongoose.startSession(readOnly ? { snapshot: true } : {}),
  admin: async (session) =>
    User.findOne({
      email: 'demo.admin@deeplearner.test',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: { $ne: null },
    })
      .select('_id email role status emailVerifiedAt')
      .session(session as ClientSession)
      .read('primary')
      .lean() as Promise<RecordData | null>,
  prepare: async (kind, data) => {
    const candidate = new (modelFor(kind))(data);
    await candidate.validate();
    return candidate.toObject() as RecordData;
  },
  find: async (kind, key, session) =>
    modelFor(kind)
      .find(key)
      .session(session as ClientSession)
      .read('primary')
      .lean() as Promise<RecordData[]>,
  insert: async (kind, data, session) => {
    const candidate = new (modelFor(kind))(data);
    await candidate.save({ session: session as ClientSession }); // Insert only; never replay the provisioning operation.
    return candidate.toObject() as RecordData;
  },
};

export async function provisionContent(
  file: string,
  hash: string,
  root: string,
) {
  const resolved = await realpath(file);
  if (
    resolved
      .toLowerCase()
      .startsWith(path.join(root, 'mongodb').toLowerCase() + path.sep)
  )
    throw new LocalError('MANIFEST_PATH_REJECTED');
  const info = await stat(resolved);
  if (!info.isFile() || info.size > 1_000_000)
    throw new LocalError('MANIFEST_SIZE_REJECTED');
  const manifest = validateManifest(await readFile(resolved), hash);
  const report = await executeContentProvisioning(manifest, databaseStore);
  // Only counts/codes: never print stored documents, account data, Markdown or source values.
  process.stdout.write(
    JSON.stringify({ manifestSha256: hash.toUpperCase(), ...report }) + '\n',
  );
  if (report.outcome !== 'PASS')
    throw new LocalError(
      report.outcome === 'INDETERMINATE'
        ? 'CONTENT_INDETERMINATE'
        : 'CONTENT_VERIFICATION_FAILED',
    );
}
