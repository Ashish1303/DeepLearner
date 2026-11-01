// Dedicated development setup only. Importing this module never opens a connection.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongooseLibrary, { Types } from 'mongoose';
import { z } from 'zod';

export const setupTarget = {
  host: '127.0.0.1',
  port: 27019,
  database: 'deeplearner-dev',
  replicaSet: 'deeplearner-dev-rs',
} as const;
export const setupRole = 'deeplearner-local-dev-setup';
export const setupUser = setupRole;
export const apiSourcePin =
  'AC19767B22EE20FD6AADCA45B59D1A801EBA316F7B84C0D99C4DE7BF9E5E96E0';
export const dependencyLockPin =
  '12147DC7CCB1EF3F6A998546CCA9F6020145D602498C8BDB24752AE97831C37F';
export const setupActions = [
  'preflight',
  'setup-role',
  'setup-user',
  'schema',
  'accounts',
  'content',
  'verify',
] as const;
export const setupPolicy = {
  id: 'DEV-ADDITIVE-SYNTHETIC-27019',
  status: 'ACTIVE',
  version: 1,
  target: setupTarget,
  actions: setupActions,
} as const;
export const seedCollections = [
  'users',
  'technologies',
  'learningPaths',
  'modules',
  'topics',
  'concepts',
  'practiceQuestions',
  'visualizations',
] as const;
export const approvedCollections = [
  'auditLogs',
  'completionRequests',
  'concepts',
  'emailVerificationTokens',
  'learningPaths',
  'modules',
  'passwordResetTokens',
  'practiceAssessments',
  'practiceAttempts',
  'practiceQuestions',
  'practiceRubricAuthorities',
  'practiceRubricVersions',
  'sectionActivityReceipts',
  'sectionEvidenceChallenges',
  'sessions',
  'studentProgress',
  'technologies',
  'topics',
  'users',
  'visualizationCheckpointDefinitions',
  'visualizations',
];
const operatorName = 'deeplearner-local-operator',
  applicationName = 'deeplearner-local-app';
const secret = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const requestSchema = z.strictObject({
  action: z.enum(setupActions),
  ownerSid: z.literal('S-1-5-21-3436178198-164699745-524212520-1001'),
  target: z.strictObject({
    host: z.literal('127.0.0.1'),
    port: z.literal(27019),
    database: z.literal('deeplearner-dev'),
    replicaSet: z.literal('deeplearner-dev-rs'),
  }),
  ownedProcessId: z.number().int().positive().max(0xffffffff),
  existingCompleted: z.boolean(),
  secrets: z.strictObject({
    operator: secret,
    application: secret,
    setup: secret.optional(),
    student: secret.optional(),
    admin: secret.optional(),
  }),
});
export const validateSetupRequest = (input: unknown) => {
  const r = requestSchema.parse(input);
  if (r.existingCompleted && r.action !== 'preflight' && r.action !== 'verify')
    throw new Error('SETUP_ACTION_REJECTED');
  return r;
};
const digest = (bytes: Buffer | string) =>
  createHash('sha256').update(bytes).digest('hex').toUpperCase();
export function setupPrivileges() {
  return [
    {
      resource: { db: setupTarget.database, collection: '' },
      actions: ['listCollections'],
    },
    ...approvedCollections.map((collection) => ({
      resource: { db: setupTarget.database, collection },
      actions: [
        'find',
        'listIndexes',
        'createCollection',
        'createIndex',
        ...(seedCollections.includes(
          collection as (typeof seedCollections)[number],
        )
          ? ['insert']
          : []),
      ],
    })),
  ];
}
function privilegeSignature(input: unknown): string {
  const values = z
    .array(
      z.strictObject({
        resource: z.strictObject({
          db: z.literal(setupTarget.database),
          collection: z.string(),
        }),
        actions: z.array(z.string()),
      }),
    )
    .parse(input);
  return JSON.stringify(
    values
      .map((v) => ({ resource: v.resource, actions: [...v.actions].sort() }))
      .sort((a, b) =>
        a.resource.collection.localeCompare(b.resource.collection),
      ),
  );
}
export function assertSetupRole(input: unknown) {
  const r = z
    .object({
      role: z.literal(setupRole),
      db: z.literal(setupTarget.database),
      roles: z.tuple([]),
      privileges: z.unknown(),
      inheritedPrivileges: z.unknown().optional(),
    })
    .parse(input);
  if (
    privilegeSignature(r.privileges) !==
      privilegeSignature(setupPrivileges()) ||
    (r.inheritedPrivileges !== undefined &&
      privilegeSignature(r.inheritedPrivileges) !==
        privilegeSignature(setupPrivileges()))
  )
    throw new Error('SETUP_PRIVILEGES_REJECTED');
}
export function canonical(value: unknown): string {
  if (value instanceof Types.ObjectId)
    return JSON.stringify(value.toHexString());
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export function indexEquivalent(
  actual: Record<string, unknown>,
  key: Record<string, unknown>,
  options: Record<string, unknown>,
) {
  return (
    JSON.stringify(actual.key) === JSON.stringify(key) &&
    [
      'unique',
      'sparse',
      'expireAfterSeconds',
      'partialFilterExpression',
      'collation',
    ].every(
      (k) =>
        canonical(
          actual[k] ?? (['unique', 'sparse'].includes(k) ? false : null),
        ) ===
        canonical(
          options[k] ?? (['unique', 'sparse'].includes(k) ? false : null),
        ),
    ) &&
    (!options.name || actual.name === options.name)
  );
}
export function assertKnownCollections(names: string[]) {
  if (
    new Set(names).size !== names.length ||
    names.some((n) => !approvedCollections.includes(n))
  )
    throw new Error('UNEXPECTED_DATABASE_CONTENTS');
}

type DeclaredCollection = {
  collection: string;
  indexes: readonly (readonly [
    Record<string, unknown>,
    Record<string, unknown>,
  ])[];
};
export function planAdditiveSchema(
  declared: DeclaredCollection[],
  actual: { collection: string; indexes: Record<string, unknown>[] }[],
) {
  assertKnownCollections(declared.map((v) => v.collection));
  assertKnownCollections(actual.map((v) => v.collection));
  const collections: string[] = [];
  const indexes: {
    collection: string;
    key: Record<string, unknown>;
    options: Record<string, unknown>;
  }[] = [];
  for (const row of declared) {
    const current = actual.find((v) => v.collection === row.collection);
    if (!current) collections.push(row.collection);
    for (const [key, options] of row.indexes) {
      const name =
        options.name ??
        Object.entries(key)
          .map(([k, v]) => k + '_' + String(v))
          .join('_');
      if (
        current?.indexes.some(
          (i) =>
            (JSON.stringify(i.key) === JSON.stringify(key) ||
              i.name === name) &&
            !indexEquivalent(i, key, options),
        )
      )
        throw new Error('INDEX_CONFLICT');
      if (!current?.indexes.some((i) => indexEquivalent(i, key, options)))
        indexes.push({ collection: row.collection, key, options });
    }
  }
  return { collections, indexes };
}
export function assertExistingDemoAccount(
  existing: Record<string, unknown>,
  expected: (typeof demoAccounts)[number],
  passwordMatches: boolean,
) {
  if (
    String(existing._id) !== String(expected._id) ||
    existing.email !== expected.email ||
    existing.role !== expected.role ||
    existing.status !== 'ACTIVE' ||
    !existing.emailVerifiedAt ||
    !passwordMatches
  )
    throw new Error('ACCOUNT_CONFLICT');
}
export function assertSetupPhaseRecord(
  input: unknown,
  phase: string,
  ownerSid: string,
  bindingHash: string,
  result = false,
) {
  const status: Record<string, string> = {
    role: 'SETUP_ROLE_VERIFIED',
    user: 'SETUP_USER_VERIFIED',
    schema: 'SCHEMA_VERIFIED',
    accounts: 'ACCOUNTS_VERIFIED',
    content: 'CONTENT_VERIFIED',
    verify: 'PERSISTENT_SETUP_VERIFIED',
  };
  if (!status[phase]) throw new Error('SETUP_STAGE_REJECTED');
  const shape = {
    revision: z.literal(1),
    phase: z.literal(phase),
    ownerSid: z.literal(ownerSid),
    sourceBindingHash: z.literal(bindingHash),
  };
  if (result)
    z.strictObject({
      ...shape,
      result: z.object({ status: z.literal(status[phase]) }),
    }).parse(input);
  else z.strictObject(shape).parse(input);
}
export function assertSetupPhaseInventory(
  facts: { phase: string; intent?: unknown; result?: unknown }[],
  action: string,
  existingCompleted: boolean,
  owner: string,
  bindingHash: string,
) {
  const phases = ['role', 'user', 'schema', 'accounts', 'content', 'verify'];
  if (
    facts.length !== 6 ||
    facts.some((f, i) => f.phase !== phases[i]) ||
    !(setupActions as readonly string[]).includes(action) ||
    (existingCompleted && action !== 'preflight' && action !== 'verify')
  )
    throw new Error('SETUP_STAGE_REJECTED');
  const current = action.startsWith('setup-') ? action.slice(6) : action;
  for (const f of facts) {
    if (f.intent !== undefined)
      assertSetupPhaseRecord(f.intent, f.phase, owner, bindingHash);
    if (f.result !== undefined)
      assertSetupPhaseRecord(f.result, f.phase, owner, bindingHash, true);
    if (f.result && !f.intent) throw new Error('SETUP_STAGE_REJECTED');
    if (
      f.intent &&
      !f.result &&
      (f.phase !== current || action === 'preflight' || existingCompleted)
    )
      throw new Error('SETUP_UNCONFIRMED_OPERATION');
  }
  let missing = false;
  for (const f of facts) {
    if (f.result && missing) throw new Error('SETUP_STAGE_ORDER_REJECTED');
    if (!f.result) missing = true;
  }
  const complete = new Set(facts.filter((f) => f.result).map((f) => f.phase));
  if (existingCompleted && complete.size !== 6)
    throw new Error('SETUP_COMPLETION_MISSING');
  if (action !== 'preflight' && !existingCompleted) {
    const index = phases.indexOf(current);
    if (
      index < 0 ||
      !facts[index]?.intent ||
      facts[index]?.result ||
      facts.slice(0, index).some((f) => !f.result) ||
      facts.slice(index + 1).some((f) => f.intent || f.result)
    )
      throw new Error('SETUP_PHASE_NOT_AUTHORIZED');
  }
  return complete;
}
export const seedId = (name: string) =>
  new Types.ObjectId(
    createHash('sha256')
      .update('DeepLearner.dev.synthetic.v1:' + name)
      .digest('hex')
      .slice(0, 24),
  );
export const demoAccounts = [
  {
    _id: seedId('student'),
    email: 'student.dev@deeplearner.test',
    firstName: 'Demo',
    lastName: 'Student',
    role: 'STUDENT',
  },
  {
    _id: seedId('admin'),
    email: 'admin.dev@deeplearner.test',
    firstName: 'Demo',
    lastName: 'Admin',
    role: 'ADMIN',
  },
] as const;
export function demoContent() {
  const tech = seedId('javascript'),
    learningPath = seedId('fundamentals'),
    module = seedId('first-steps'),
    topic = seedId('values'),
    admin = seedId('admin');
  const authored = { createdBy: admin, updatedBy: admin };
  const hierarchy = {
    technologyId: tech,
    learningPathId: learningPath,
    moduleId: module,
    topicId: topic,
  };
  return [
    {
      model: 'Technology',
      data: {
        _id: tech,
        name: 'JavaScript',
        slug: 'javascript',
        description:
          'Synthetic local curriculum: variables and numeric expressions.',
        status: 'PUBLISHED',
        order: 0,
        ...authored,
      },
    },
    {
      model: 'Technology',
      data: {
        _id: seedId('draft-tech'),
        name: 'JavaScript Sandbox Draft',
        slug: 'javascript-sandbox-draft',
        description: 'Synthetic editable draft for local Admin review.',
        status: 'DRAFT',
        order: 10,
        ...authored,
      },
    },
    {
      model: 'Technology',
      data: {
        _id: seedId('archived-tech'),
        name: 'JavaScript Legacy Example',
        slug: 'javascript-legacy-example',
        description:
          'Synthetic archived example; read-only in Technology Management.',
        status: 'ARCHIVED',
        order: 20,
        ...authored,
      },
    },
    {
      model: 'LearningPath',
      data: {
        _id: learningPath,
        technologyId: tech,
        title: 'JavaScript Fundamentals',
        slug: 'javascript-fundamentals',
        description:
          'Build confidence with values, variables and simple expressions.',
        targetLevel: 'BEGINNER',
        completionScore: 70,
        status: 'PUBLISHED',
        order: 0,
        ...authored,
      },
    },
    {
      model: 'Module',
      data: {
        _id: module,
        technologyId: tech,
        learningPathId: learningPath,
        title: 'First Steps',
        slug: 'first-steps',
        description: 'Read and reason about small JavaScript programs.',
        status: 'PUBLISHED',
        order: 0,
      },
    },
    {
      model: 'Topic',
      data: {
        _id: topic,
        technologyId: tech,
        learningPathId: learningPath,
        moduleId: module,
        title: 'Values and Expressions',
        slug: 'values-and-expressions',
        description: 'Store a value, then compute a result.',
        status: 'PUBLISHED',
        order: 0,
      },
    },
    {
      model: 'Concept',
      data: {
        _id: seedId('variables'),
        ...hierarchy,
        title: 'Variables with let',
        slug: 'variables-with-let',
        difficulty: 'BEGINNER',
        contentFormat: 'MARKDOWN',
        schemaVersion: 1,
        status: 'PUBLISHED',
        order: 0,
        read: {
          summary: 'Use let for a block-scoped binding whose value can change.',
          bodyMarkdown:
            '## Store and update a value\n\nA variable gives a value a useful name. A `let` binding belongs to its block and can be assigned a new value.\n\n```javascript\nlet score = 40;\nscore = 42;\nconsole.log(score); // 42\n```\n\nThe assignment changes the stored value; it does not declare a second binding.',
        },
        examples: [
          {
            title: 'An updated score',
            bodyMarkdown:
              '```javascript\nlet score = 40;\nscore = score + 2;\nconsole.log(score); // 42\n```',
          },
        ],
        revise: {
          summary: 'Declare once, then assign a new value when needed.',
          keyPoints: [
            'let is block scoped.',
            'A let binding can be reassigned.',
          ],
          importantCodeMarkdown:
            '```javascript\nlet score = 40;\nscore = 42;\n```',
        },
        source: {
          label: 'MDN: let',
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let',
          sourceType: 'OFFICIAL_OR_TRUSTED',
          isOfficial: true,
        },
        ...authored,
      },
    },
    {
      model: 'Concept',
      data: {
        _id: seedId('addition'),
        ...hierarchy,
        title: 'Numeric Addition',
        slug: 'numeric-addition',
        difficulty: 'BEGINNER',
        contentFormat: 'MARKDOWN',
        schemaVersion: 1,
        status: 'PUBLISHED',
        order: 1,
        read: {
          summary: 'Add two numbers with the + operator.',
          bodyMarkdown:
            '## Evaluate a numeric expression\n\nWhen both operands are numbers, `+` computes their sum.\n\n```javascript\nconst total = 40 + 2;\nconsole.log(total); // 42\n```\n\nA string operand changes the operation to concatenation. Compare `40 + 2` with `"40" + 2`.',
        },
        examples: [
          {
            title: 'Numbers and strings',
            bodyMarkdown:
              '```javascript\nconsole.log(40 + 2);   // 42\nconsole.log("40" + 2); // "402"\n```',
          },
        ],
        revise: {
          summary: 'Check operand types before predicting +.',
          keyPoints: [
            'Two numbers produce a numeric sum.',
            'A string operand produces concatenation.',
          ],
          memoryTrick: 'Numbers add; a string joins.',
          importantCodeMarkdown: '```javascript\n40 + 2; // 42\n```',
        },
        source: {
          label: 'MDN: Addition operator',
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Addition',
          sourceType: 'OFFICIAL_OR_TRUSTED',
          isOfficial: true,
        },
        ...authored,
      },
    },
    {
      model: 'PracticeQuestion',
      data: {
        _id: seedId('practice'),
        technologyId: tech,
        topicId: topic,
        conceptId: seedId('addition'),
        type: 'OUTPUT',
        difficulty: 'BEGINNER',
        prompt: 'What is printed by this program? Enter only the output value.',
        starterCode: 'let score = 40;\nscore = score + 2;\nconsole.log(score);',
        language: 'JAVASCRIPT',
        answer: '42',
        explanation:
          'The numeric expression 40 + 2 evaluates to 42, which is assigned to score and printed.',
        status: 'PUBLISHED',
        schemaVersion: 1,
        ...authored,
      },
    },
    {
      model: 'Visualization',
      data: {
        _id: seedId('visualization'),
        technologyId: tech,
        topicId: topic,
        conceptId: seedId('addition'),
        type: 'ANIMATED_FLOW',
        title: 'From operands to sum',
        textAlternative:
          'The numbers 40 and 2 enter an addition expression, producing 42.',
        nodes: [
          { id: 'left', label: '40' },
          { id: 'right', label: '2' },
          { id: 'sum', label: '42' },
        ],
        edges: [
          { id: 'left-sum', source: 'left', target: 'sum', label: 'add' },
          { id: 'right-sum', source: 'right', target: 'sum', label: 'add' },
        ],
        steps: [
          {
            title: 'Read the operands',
            explanation: 'Both values are numbers.',
            nodeIds: ['left', 'right'],
            edgeIds: [],
          },
          {
            title: 'Add the operands',
            explanation: 'Compute 40 + 2.',
            nodeIds: ['left', 'right', 'sum'],
            edgeIds: ['left-sum', 'right-sum'],
          },
          {
            title: 'Use the result',
            explanation: 'The expression evaluates to 42.',
            nodeIds: ['sum'],
            edgeIds: [],
          },
        ],
        animationConfig: { stepDurationMs: 800, autoplay: false },
        status: 'PUBLISHED',
        schemaVersion: 1,
        ...authored,
      },
    },
  ];
}
const modulePaths = [
  'users/user.model',
  'auth/session.model',
  'audit/audit.model',
  'auth/email-verification-token.model',
  'auth/password-reset-token.model',
  'technologies/technology.model',
  'learning-paths/learning-path.model',
  'modules/module.model',
  'topics/topic.model',
  'concepts/concept.model',
  'visualizations/visualization.model',
  'practice/practice-question.model',
  'practice/practice-attempt.model',
  'practice/practice-assessment.model',
  'practice/practice-rubric.model',
  'progress/progress.model',
  'progress/section-evidence-challenge.model',
  'progress/section-evidence-receipt.model',
  'progress/completion-request.model',
  'visualizations/visualization-checkpoint-definition.model',
];
function sourceTreePin(root: string): string {
  const lines: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('SOURCE_PATH_REJECTED');
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.ts'))
        lines.push(
          path.relative(root, full).replaceAll('\\', '/').toLowerCase() +
            '|' +
            digest(readFileSync(full)),
        );
      else throw new Error('UNPINNED_SOURCE_ARTIFACT');
    }
  };
  walk(root);
  if (lines.length !== 173) throw new Error('SOURCE_FILE_COUNT_REJECTED');
  return digest(lines.sort().join('\n'));
}
export function assertSetupBinding(
  input: unknown,
  facts: {
    ownerSid: string;
    normalTransitionHash: string;
    sources: { powershell: string; helper: string };
  },
) {
  const hash = z.string().regex(/^[A-F0-9]{64}$/);
  const r = z
    .strictObject({
      revision: z.literal(1),
      purpose: z.literal('ADDITIVE_SCHEMA_SYNTHETIC_FIXTURES'),
      ownerSid: z.literal(facts.ownerSid),
      normalTransitionHash: z.literal(facts.normalTransitionHash),
      allowedAction: z.literal('ProvisionLocal'),
      sources: z.strictObject({ powershell: hash, helper: hash }),
    })
    .parse(input);
  if (canonical(r.sources) !== canonical(facts.sources))
    throw new Error('SETUP_SOURCE_BINDING_REJECTED');
}
let accepted = false;
let completedPhases = new Set<string>();
let stage = 'ENTRY';
let connectionAttempted = false,
  writeAttempted = false,
  writePending = false,
  acknowledgedWrites = 0;
const writeStages = [
  'CREATE_SETUP_ROLE',
  'CREATE_SETUP_USER',
  'CREATE_COLLECTION',
  'CREATE_INDEX',
  'SAVE_ACCOUNT',
  'SAVE_CONTENT',
] as const;
const publicFailureGates = new Set([
  'ACCOUNT_CONFLICT',
  'ACCOUNT_MISSING',
  'ACCOUNT_SECRET_MISSING',
  'CONTENT_CONFLICT',
  'CONTENT_MISSING',
  'INDEX_CONFLICT',
  'INDEX_VERIFICATION_FAILED',
  'MODEL_INVENTORY_REJECTED',
  'MODEL_MISSING',
  'NORMAL_RECEIPT_CHANGED',
  'NORMAL_SOURCE_DRIFT',
  'OWNED_TARGET_REJECTED',
  'SETUP_ACTION_REJECTED',
  'SETUP_AUTHENTICATION_REJECTED',
  'SETUP_CLI_REJECTED',
  'SETUP_COMPLETION_MISSING',
  'SETUP_EXECUTION_CONTEXT_REQUIRED',
  'SETUP_NORMAL_CONFIGURATION_REJECTED',
  'SETUP_OWNER_REJECTED',
  'SETUP_PATH_REJECTED',
  'SETUP_PHASE_NOT_AUTHORIZED',
  'SETUP_POLICY_REJECTED',
  'SETUP_PRIVILEGES_REJECTED',
  'SETUP_RECORD_REJECTED',
  'SETUP_RESPONSE_TOO_LARGE',
  'SETUP_ROLE_MISSING',
  'SETUP_SECRET_MISSING',
  'SETUP_SOURCE_BINDING_REJECTED',
  'SETUP_SOURCE_DRIFT',
  'SETUP_STAGE_ORDER_REJECTED',
  'SETUP_STAGE_REJECTED',
  'SETUP_UNCONFIRMED_OPERATION',
  'SETUP_UNKNOWN_METADATA',
  'SOURCE_FILE_COUNT_REJECTED',
  'SOURCE_PATH_REJECTED',
  'UNEXPECTED_DATABASE_CONTENTS',
  'UNEXPECTED_SETUP_ROLE',
  'UNEXPECTED_SETUP_USER',
  'UNPINNED_SOURCE_ARTIFACT',
]);
export function safeSetupFailure(
  error: unknown,
  phase: string,
  connected: boolean,
  wrote: boolean,
  pending: boolean,
  count: number,
) {
  const known = [
    'ENTRY',
    'SOURCE_BINDING',
    'MODEL_IMPORT',
    'OWNED_TARGET_VERIFICATION',
    'PREFLIGHT',
    'SETUP_ROLE',
    'SETUP_USER',
    'SCHEMA',
    'ACCOUNTS',
    'CONTENT',
    'VERIFY',
    ...writeStages,
  ];
  const code =
    error instanceof mongooseLibrary.mongo.MongoServerError &&
    typeof error.code === 'number' &&
    Number.isSafeInteger(error.code) &&
    Math.abs(error.code) <= 99999
      ? error.code
      : null;
  return {
    status: 'SETUP_FAILED',
    stage: known.includes(phase) ? phase : 'UNKNOWN',
    gate:
      error instanceof Error && publicFailureGates.has(error.message)
        ? error.message
        : 'UNKNOWN',
    classification: pending
      ? 'WRITE_ACKNOWLEDGEMENT_UNCERTAIN'
      : count > 0
        ? 'PARTIAL_ACKNOWLEDGED'
        : 'REFUSED_OR_READ_FAILED',
    mongoCode: code,
    connectionAttempted: connected,
    writeAttempted: wrote,
    acknowledgedWrites:
      Number.isSafeInteger(count) && count >= 0 && count <= 1000 ? count : null,
    automaticRetry: false,
  };
}
async function writeOnce<T>(
  operation: (typeof writeStages)[number],
  body: () => Promise<T>,
): Promise<T> {
  stage = operation;
  writeAttempted = true;
  writePending = true;
  const value = await body();
  writePending = false;
  acknowledgedWrites++;
  return value;
}

export async function executeSetup(input: unknown) {
  if (!accepted) throw new Error('SETUP_EXECUTION_CONTEXT_REQUIRED');
  const r = validateSetupRequest(input);
  stage = 'MODEL_IMPORT';
  const { mongoose } = await import('../src/config/database.js');
  const exportsByModel: Record<string, (typeof mongoose.models)[string]> = {};
  for (const module of modulePaths) {
    const loaded = (await import('../src/modules/' + module + '.js')) as Record<
      string,
      unknown
    >;
    for (const [name, value] of Object.entries(loaded)) {
      if (value && typeof value === 'function' && 'modelName' in value)
        exportsByModel[name] = value as (typeof mongoose.models)[string];
    }
  }
  const models = Object.values(mongoose.models).sort((a, b) =>
    a.collection.collectionName.localeCompare(b.collection.collectionName),
  );
  if (
    canonical(models.map((m) => m.collection.collectionName).sort()) !==
      canonical(approvedCollections) ||
    models.some(
      (m) =>
        m.schema.options.autoCreate !== false ||
        m.schema.options.autoIndex !== false,
    )
  )
    throw new Error('MODEL_INVENTORY_REJECTED');
  const { hashPassword, verifyPassword } =
    await import('../src/modules/auth/password.service.js');
  const clients: mongooseLibrary.mongo.MongoClient[] = [];
  const connect = async (
    user: string,
    password: string,
    authSource: string,
  ) => {
    const c = new mongooseLibrary.mongo.MongoClient(
      'mongodb://127.0.0.1:27019/?replicaSet=deeplearner-dev-rs&directConnection=true',
      {
        auth: { username: user, password },
        authSource,
        authMechanism: 'SCRAM-SHA-256',
        tls: false,
        directConnection: true,
        retryReads: false,
        retryWrites: false,
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 10000,
        timeoutMS: 20000,
        maxPoolSize: 1,
        minPoolSize: 0,
      },
    );
    clients.push(c);
    connectionAttempted = true;
    await c.connect();
    return c;
  };
  try {
    stage = 'OWNED_TARGET_VERIFICATION';
    const operator = await connect(operatorName, r.secrets.operator, 'admin');
    const server = await operator.db('admin').command({ serverStatus: 1 });
    const hello = await operator.db('admin').command({ hello: 1 });
    const replica = await operator.db('admin').command({ replSetGetConfig: 1 });
    if (
      server.pid !== r.ownedProcessId ||
      hello.isWritablePrimary !== true ||
      hello.setName !== setupTarget.replicaSet ||
      replica.config?._id !== setupTarget.replicaSet ||
      replica.config.members?.length !== 1 ||
      replica.config.members[0]?.host !== 'localhost:27019'
    )
      throw new Error('OWNED_TARGET_REJECTED');
    const app = await connect(
      applicationName,
      r.secrets.application,
      setupTarget.database,
    );
    const appDb = app.db(setupTarget.database);
    const collections = await appDb
      .listCollections({}, { nameOnly: true })
      .toArray();
    assertKnownCollections(collections.map((v) => v.name));
    if (!r.existingCompleted) {
      // A completed immutable phase permits only its exact synthetic records.
      const expected = new Map<string, Record<string, unknown>[]>();
      if (completedPhases.has('accounts'))
        expected.set(
          'users',
          demoAccounts.map((a) => ({ ...a, status: 'ACTIVE' })),
        );
      if (completedPhases.has('content'))
        for (const item of demoContent()) {
          const name = (
            exportsByModel[item.model] ?? mongoose.models[item.model]!
          ).collection.collectionName;
          expected.set(name, [...(expected.get(name) ?? []), item.data]);
        }
      for (const { name } of collections) {
        const records = expected.get(name) ?? [];
        const actual = await appDb
          .collection(name)
          .find({}, { projection: { _id: 1 } })
          .toArray();
        if (
          actual.length !== records.length ||
          actual.some(
            (d) => !records.some((e) => String(d._id) === String(e._id)),
          )
        )
          throw new Error('UNEXPECTED_DATABASE_CONTENTS');
      }
      if (completedPhases.has('accounts')) {
        for (const account of demoAccounts) {
          const password =
            account.role === 'STUDENT' ? r.secrets.student : r.secrets.admin;
          if (!password) throw new Error('ACCOUNT_SECRET_MISSING');
          const existing = await appDb
            .collection('users')
            .findOne({ _id: account._id });
          if (!existing) throw new Error('ACCOUNT_MISSING');
          assertExistingDemoAccount(
            existing,
            account,
            await verifyPassword(password, String(existing.passwordHash)),
          );
        }
      }
      if (completedPhases.has('content')) {
        for (const item of demoContent()) {
          const name = (
            exportsByModel[item.model] ?? mongoose.models[item.model]!
          ).collection.collectionName;
          const existing = await appDb
            .collection(name)
            .findOne({ _id: item.data._id });
          if (!existing) throw new Error('CONTENT_MISSING');
          for (const [key, value] of Object.entries(item.data))
            if (canonical(existing[key]) !== canonical(value))
              throw new Error('CONTENT_CONFLICT');
        }
      }
    }
    if (r.action === 'preflight')
      return {
        status: 'PREFLIGHT_VERIFIED',
        collections: collections.length,
        ownedProcessId: r.ownedProcessId,
      };
    stage = r.action.toUpperCase().replaceAll('-', '_');
    const roleInfo = await operator.db(setupTarget.database).command({
      rolesInfo: { role: setupRole, db: setupTarget.database },
      showPrivileges: true,
    });
    if (r.action === 'setup-role') {
      if (roleInfo.roles.length) throw new Error('UNEXPECTED_SETUP_ROLE');
      await writeOnce('CREATE_SETUP_ROLE', () =>
        operator.db(setupTarget.database).command({
          createRole: setupRole,
          privileges: setupPrivileges(),
          roles: [],
          writeConcern: { w: 'majority', j: true, wtimeout: 10000 },
        }),
      );
      const result = await operator.db(setupTarget.database).command({
        rolesInfo: { role: setupRole, db: setupTarget.database },
        showPrivileges: true,
      });
      assertSetupRole(result.roles[0]);
      return { status: 'SETUP_ROLE_VERIFIED' };
    }
    if (roleInfo.roles.length !== 1) throw new Error('SETUP_ROLE_MISSING');
    assertSetupRole(roleInfo.roles[0]);
    if (r.action === 'setup-user') {
      const info = await operator.db(setupTarget.database).command({
        usersInfo: { user: setupUser, db: setupTarget.database },
        showPrivileges: true,
      });
      if (info.users.length || !r.secrets.setup)
        throw new Error('UNEXPECTED_SETUP_USER');
      await writeOnce('CREATE_SETUP_USER', () =>
        operator.db(setupTarget.database).command({
          createUser: setupUser,
          pwd: r.secrets.setup,
          roles: [{ role: setupRole, db: setupTarget.database }],
          mechanisms: ['SCRAM-SHA-256'],
          writeConcern: { w: 'majority', j: true, wtimeout: 10000 },
        }),
      );
    }
    if (!r.secrets.setup) throw new Error('SETUP_SECRET_MISSING');
    const setup = await connect(
      setupUser,
      r.secrets.setup,
      setupTarget.database,
    );
    const db = setup.db(setupTarget.database, {
      writeConcern: { w: 'majority', journal: true, wtimeoutMS: 10000 },
    });
    const info = await db.command({
      connectionStatus: 1,
      showPrivileges: true,
    });
    if (
      canonical(info.authInfo.authenticatedUsers) !==
        canonical([{ user: setupUser, db: setupTarget.database }]) ||
      privilegeSignature(info.authInfo.authenticatedUserPrivileges) !==
        privilegeSignature(setupPrivileges())
    )
      throw new Error('SETUP_AUTHENTICATION_REJECTED');
    if (r.action === 'setup-user') return { status: 'SETUP_USER_VERIFIED' };
    const schemaInventory = async () => {
      const output = [];
      for (const model of models) {
        const name = model.collection.collectionName;
        const indexes = await db.collection(name).listIndexes().toArray();
        for (const [key, options] of model.schema.indexes()) {
          if (
            !indexes.some((i) =>
              indexEquivalent(
                i,
                key as Record<string, unknown>,
                options as Record<string, unknown>,
              ),
            )
          )
            throw new Error('INDEX_VERIFICATION_FAILED');
        }
        output.push({
          collection: name,
          indexNames: indexes.map((i) => i.name),
          uniqueIndexNames: indexes
            .filter((i) => i.unique === true)
            .map((i) => i.name),
        });
      }
      return output;
    };
    if (r.action === 'schema') {
      const actual = [];
      for (const name of collections.map((v) => v.name))
        actual.push({
          collection: name,
          indexes: await db.collection(name).listIndexes().toArray(),
        });
      const plan = planAdditiveSchema(
        models.map((m) => ({
          collection: m.collection.collectionName,
          indexes: m.schema.indexes() as DeclaredCollection['indexes'],
        })),
        actual,
      );
      for (const name of plan.collections)
        await writeOnce('CREATE_COLLECTION', () =>
          db.createCollection(name, {
            writeConcern: { w: 'majority', j: true, wtimeoutMS: 10000 },
          }),
        );
      for (const row of plan.indexes)
        await writeOnce('CREATE_INDEX', () =>
          db
            .collection(row.collection)
            .createIndex(
              row.key as mongooseLibrary.mongo.IndexSpecification,
              row.options,
            ),
        );
      const inventory = await schemaInventory();
      const session = app.startSession();
      try {
        session.startTransaction({
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority', j: true },
          readPreference: 'primary',
        });
        await appDb
          .collection('users')
          .findOne({ _id: seedId('student') }, { session });
        await session.abortTransaction();
      } finally {
        await session.endSession();
      }
      return {
        status: 'SCHEMA_VERIFIED',
        inventory,
        transaction: 'READ_ONLY_TRANSACTION_ABORTED_VERIFIED',
      };
    }
    // Model validation happens before any fixture insert. No raw product writes.
    await mongoose.connect(
      'mongodb://127.0.0.1:27019/deeplearner-dev?replicaSet=deeplearner-dev-rs&directConnection=true',
      {
        auth: { username: setupUser, password: r.secrets.setup },
        authSource: setupTarget.database,
        authMechanism: 'SCRAM-SHA-256',
        tls: false,
        directConnection: true,
        autoCreate: false,
        autoIndex: false,
        bufferCommands: false,
        retryReads: false,
        retryWrites: false,
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 1,
      },
    );
    const accountDocuments = [];
    for (const account of demoAccounts) {
      const password =
        account.role === 'STUDENT' ? r.secrets.student : r.secrets.admin;
      if (!password) throw new Error('ACCOUNT_SECRET_MISSING');
      const hash = await hashPassword(password);
      const model = mongoose.models.User!;
      const doc = new model({
        ...account,
        plan: 'FREE',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        passwordHash: hash,
      });
      await doc.validate();
      accountDocuments.push({ account, password, doc });
    }
    if (
      r.action === 'accounts' ||
      r.action === 'content' ||
      r.action === 'verify'
    ) {
      const missing = [];
      for (const { account, password, doc } of accountDocuments) {
        const existing = await mongoose.models
          .User!.findOne({
            $or: [{ _id: account._id }, { email: account.email }],
          })
          .select('+passwordHash +authProviders')
          .exec();
        if (!existing) {
          if (r.action !== 'accounts') throw new Error('ACCOUNT_MISSING');
          missing.push(doc);
          continue;
        }
        assertExistingDemoAccount(
          existing.toObject() as Record<string, unknown>,
          account,
          await verifyPassword(password, String(existing.get('passwordHash'))),
        );
      }
      if (r.action === 'accounts') {
        for (const doc of missing)
          await writeOnce('SAVE_ACCOUNT', () =>
            doc.save({
              writeConcern: { w: 'majority', j: true, wtimeout: 10000 },
            }),
          );
        return {
          status: 'ACCOUNTS_VERIFIED',
          identities: demoAccounts.map((a) => ({
            email: a.email,
            role: a.role,
            status: 'ACTIVE',
            emailVerified: true,
          })),
          created: missing.length,
        };
      }
    }
    const docs = demoContent().map((item) => {
      const Model = exportsByModel[item.model] ?? mongoose.models[item.model];
      if (!Model) throw new Error('MODEL_MISSING');
      return { item, doc: new Model(item.data) };
    });
    for (const { doc } of docs) await doc.validate();
    const missing = [];
    for (const { item, doc } of docs) {
      const Model = exportsByModel[item.model] ?? mongoose.models[item.model]!;
      const existing = await Model.findById(item.data._id)
        .select(item.model === 'PracticeQuestion' ? '+answer +explanation' : '')
        .lean()
        .exec();
      if (!existing) {
        if (r.action === 'verify') throw new Error('CONTENT_MISSING');
        missing.push(doc);
        continue;
      }
      for (const [key, value] of Object.entries(item.data)) {
        if (
          canonical((existing as Record<string, unknown>)[key]) !==
          canonical(value)
        )
          throw new Error('CONTENT_CONFLICT');
      }
    }
    if (r.action === 'content') {
      for (const doc of missing)
        await writeOnce('SAVE_CONTENT', () =>
          doc.save({
            writeConcern: { w: 'majority', j: true, wtimeout: 10000 },
          }),
        );
      return {
        status: 'CONTENT_VERIFIED',
        created: missing.length,
        documents: docs.length,
        practiceAnswerValidated: true,
        studentProgressSeeded: false,
      };
    }
    if (r.action !== 'verify') throw new Error('SETUP_ACTION_REJECTED');
    return {
      status: 'PERSISTENT_SETUP_VERIFIED',
      inventory: await schemaInventory(),
      accounts: 2,
      contentDocuments: docs.length,
      credentialsRotated: false,
      progressFabricated: false,
    };
  } finally {
    await mongoose.disconnect();
    await Promise.allSettled(clients.map((c) => c.close()));
  }
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  try {
    if (
      process.argv.length !== 3 ||
      process.argv[2] !== '--provision-local' ||
      process.platform !== 'win32' ||
      Number(process.versions.node.split('.')[0]) !== 24
    )
      throw new Error('SETUP_CLI_REJECTED');
    stage = 'SOURCE_BINDING';
    const repo = path.resolve(
      fileURLToPath(new URL('../../..', import.meta.url)),
    );
    if (
      repo !== 'E:\\AI\\DeepLearner' ||
      realpathSync(repo) !== repo ||
      sourceTreePin(path.join(repo, 'apps/api/src')) !== apiSourcePin ||
      digest(readFileSync(path.join(repo, 'package-lock.json'))) !==
        dependencyLockPin
    )
      throw new Error('SETUP_SOURCE_DRIFT');
    const owner = execFileSync(
      'C:\\Windows\\System32\\whoami.exe',
      ['/user', '/fo', 'csv', '/nh'],
      {
        encoding: 'utf8',
        timeout: 5000,
        maxBuffer: 4096,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    )
      .trim()
      .match(/^"[^"\r\n]+","(S-1-5-21-(?:\d+-){2}\d+-\d+)"$/)?.[1];
    if (!owner) throw new Error('SETUP_OWNER_REJECTED');
    const control =
      'C:\\Users\\Shreeji\\AppData\\Local\\DeepLearner\\dev\\mongo-control';
    const readBounded = (name: string) => {
      const full = path.join(control, name);
      if (realpathSync(full) !== full) throw new Error('SETUP_PATH_REJECTED');
      const bytes = readFileSync(full);
      if (bytes.length > 16384) throw new Error('SETUP_RECORD_REJECTED');
      return bytes;
    };
    const normal = readBounded('manual-normal-transition.json');
    if (
      digest(normal) !==
      '27DDABEF2F3D4A466FC5D8730920738A35E282D1E1220606121D5366BD25721B'
    )
      throw new Error('NORMAL_RECEIPT_CHANGED');
    const normalRecord = JSON.parse(normal.toString('utf8')) as {
      sources: Record<string, unknown>;
    };
    const corePaths = {
      powershell: 'scripts/Setup-DeepLearnerDev.ps1',
      validator: 'apps/api/scripts/dev-local.ts',
      helper: 'apps/api/scripts/dev-mongo-bootstrap.ts',
      owner: 'scripts/LocalProcessOwner.cs',
    };
    for (const [key, relative] of Object.entries(corePaths))
      if (
        normalRecord.sources[key] !==
        digest(readFileSync(path.join(repo, relative)))
      )
        throw new Error('NORMAL_SOURCE_DRIFT');
    for (const base of ['dev-local', 'dev-mongo-bootstrap'])
      for (const extension of ['.js', '.cjs', '.mjs', '.jsx'])
        if (
          statSync(path.join(repo, 'apps/api/scripts', base + extension), {
            throwIfNoEntry: false,
          })
        )
          throw new Error('UNPINNED_SOURCE_ARTIFACT');
    // Exact .ts module imports occur only after their actual bytes and resolution are pinned.
    const normalModuleUrl = new URL('./dev-mongo-bootstrap.ts', import.meta.url)
      .href;
    const {
      assertNormalTransition,
      preservedNormalTransitionLineage,
      bootstrapTarget,
      validateBootstrapRequest,
    } = (await import(
      normalModuleUrl
    )) as typeof import('./dev-mongo-bootstrap.js');
    const readerModuleUrl = new URL('./dev-local.ts', import.meta.url).href;
    const { readRequest } = (await import(
      readerModuleUrl
    )) as typeof import('./dev-local.js');

    const binding = readBounded('local-provisioning-sources.json');
    assertSetupBinding(JSON.parse(binding.toString('utf8')), {
      ownerSid: owner,
      normalTransitionHash: digest(normal),
      sources: {
        powershell: digest(
          readFileSync(path.join(repo, 'scripts/Provision-DeepLearnerDev.ps1')),
        ),
        helper: digest(readFileSync(fileURLToPath(import.meta.url))),
      },
    });
    const policySource = readFileSync(
      path.join(repo, 'scripts/Provision-DeepLearnerDev.ps1'),
      'utf8',
    );
    const policies = [
      ...policySource.matchAll(
        /^\{"id":"DEV-ADDITIVE-SYNTHETIC-27019"[^\r\n]*\}$/gm,
      ),
    ];
    if (
      policies.length !== 1 ||
      canonical(JSON.parse(policies[0]![0])) !== canonical(setupPolicy)
    )
      throw new Error('SETUP_POLICY_REJECTED');
    const request = validateSetupRequest(await readRequest(process.stdin));
    if (request.ownerSid !== owner) throw new Error('SETUP_OWNER_REJECTED');
    const manifestBytes = readBounded('bootstrap/bootstrap-plan.json');
    const manifest = JSON.parse(manifestBytes.toString('utf8')) as Record<
      string,
      unknown
    >;
    const lineage: Record<string, string> = {};
    for (const name of Object.keys(preservedNormalTransitionLineage))
      lineage[name] = digest(readBounded(name));
    assertNormalTransition(
      JSON.parse(normal.toString('utf8')),
      {
        ownerSid: owner,
        sources: {
          powershell: digest(
            readFileSync(path.join(repo, 'scripts/Setup-DeepLearnerDev.ps1')),
          ),
          validator: digest(
            readFileSync(path.join(repo, 'apps/api/scripts/dev-local.ts')),
          ),
          helper: digest(
            readFileSync(
              path.join(repo, 'apps/api/scripts/dev-mongo-bootstrap.ts'),
            ),
          ),
          owner: digest(
            readFileSync(path.join(repo, 'scripts/LocalProcessOwner.cs')),
          ),
        },
        lineage,
        manifestHash: digest(manifestBytes),
      },
      manifest,
      validateBootstrapRequest({
        action: 'verify-normal',
        target: bootstrapTarget,
        operatorPassword: request.secrets.operator,
        applicationPassword: request.secrets.application,
        certificates: manifest.certificates,
      }),
      'verify-normal',
    );
    if (
      digest(readFileSync(path.join(control, 'mongod.cfg'))) !==
      '46DF9958682B4BEE0AA445FC3B7290FDB442ECAF587CB49286195A5CF6A951D8'
    )
      throw new Error('SETUP_NORMAL_CONFIGURATION_REJECTED');
    const phases = ['role', 'user', 'schema', 'accounts', 'content', 'verify'];
    const allowedSetup = new Set([
      'local-setup-material.json',
      ...phases.flatMap((p) => [
        'local-setup-' + p + '-intent.json',
        'local-setup-' + p + '.json',
      ]),
    ]);
    for (const item of readdirSync(control, { withFileTypes: true }))
      if (
        item.name.toLowerCase().startsWith('local-setup-') &&
        (!item.isFile() || !allowedSetup.has(item.name))
      )
        throw new Error('SETUP_UNKNOWN_METADATA');
    const facts = phases.map((phase) => {
      const readOptional = (suffix: string) => {
        const name = 'local-setup-' + phase + suffix + '.json';
        if (!statSync(path.join(control, name), { throwIfNoEntry: false }))
          return undefined;
        const value: unknown = JSON.parse(readBounded(name).toString('utf8'));
        if (value === null || typeof value !== 'object' || Array.isArray(value))
          throw new Error('SETUP_RECORD_REJECTED');
        return value;
      };
      const intent = readOptional('-intent'),
        result = readOptional('');
      return { phase, intent, result };
    });
    completedPhases = assertSetupPhaseInventory(
      facts,
      request.action,
      request.existingCompleted,
      owner,
      digest(binding),
    );
    accepted = true;
    const result = await executeSetup(request);
    const frame = JSON.stringify(result);
    if (Buffer.byteLength(frame) > 8191)
      throw new Error('SETUP_RESPONSE_TOO_LARGE');
    process.stdout.write(frame + '\n');
  } catch (error) {
    process.stdout.write(
      JSON.stringify(
        safeSetupFailure(
          error,
          stage,
          connectionAttempted,
          writeAttempted,
          writePending,
          acknowledgedWrites,
        ),
      ) + '\n',
    );
    process.exitCode = 1;
  } finally {
    accepted = false;
    completedPhases.clear();
  }
}
