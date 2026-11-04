import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { Audit, auditSchema } from '../src/modules/audit/audit.model.js';
import * as repository from '../src/modules/audit/audit.repository.js';

test('F044 admission/proposal audit tuples require exact private metadata and server identities', async () => {
  const actorId = new Types.ObjectId('a'.repeat(24));
  const briefId = new Types.ObjectId('b'.repeat(24));
  const rowId = new Types.ObjectId('c'.repeat(24));
  const technologyId = new Types.ObjectId('d'.repeat(24));
  const createdAt = new Date('2026-11-04T00:00:00.000Z');
  const admitted = {
    _id: briefId,
    category: 'CONTENT_MANAGEMENT',
    action: 'CURRICULUM_BRIEF_ADMITTED',
    actorId,
    resourceType: 'CURRICULUM_BRIEF_REVISION',
    resourceId: briefId,
    requestId: 'request',
    createdAt,
    metadata: {
      technologyId,
      revision: 1,
      operationId: '12345678-1234-4123-8123-123456789abc',
    },
  };
  const proposal = {
    ...admitted,
    _id: rowId,
    action: 'LEARNING_PATH_PROPOSAL_REVISION_CREATED',
    resourceType: 'LEARNING_PATH_PROPOSAL_REVISION',
    resourceId: rowId,
    metadata: {
      proposalId: briefId,
      revision: 1,
      sourceId: briefId,
      sourceRevision: 1,
    },
  };
  for (const valid of [
    admitted,
    proposal,
    {
      ...proposal,
      metadata: { ...proposal.metadata, revision: Number.MAX_SAFE_INTEGER },
    },
  ])
    await new Audit(valid).validate();
  for (const input of [admitted, proposal]) {
    for (const change of [
      { category: 'CONTENT_APPROVAL' },
      { resourceType: 'TECHNOLOGY' },
      { actorId: undefined },
      { _id: undefined },
      { createdAt: undefined },
      { createdAt: new Date(NaN) },
      { resourceId: actorId },
      { metadata: { ...input.metadata, source: 'ACCESS_TOKEN' } },
      { metadata: { ...input.metadata, stack: 'SYNTHETIC_PRIVATE' } },
      { metadata: { ...input.metadata, changedFields: ['name'] } },
    ])
      await assert.rejects(new Audit({ ...input, ...change }).validate());
    for (const key of Object.keys(input.metadata)) {
      const metadata: Record<string, unknown> = { ...input.metadata };
      delete metadata[key];
      await assert.rejects(new Audit({ ...input, metadata }).validate());
    }
  }
  for (const revision of [0, 2, '1'])
    await assert.rejects(
      new Audit({
        ...admitted,
        metadata: { ...admitted.metadata, revision },
      }).validate(),
    );
  for (const metadata of [
    { ...proposal.metadata, sourceRevision: 2 },
    { ...proposal.metadata, revision: 0 },
    { ...proposal.metadata, sourceId: actorId },
    { ...proposal.metadata, revision: 1.1 },
    { ...proposal.metadata, proposalId: briefId.toHexString() },
  ])
    await assert.rejects(new Audit({ ...proposal, metadata }).validate());
  assert.equal(
    auditSchema
      .path('resourceId')
      .options.ref.call({ resourceType: 'CURRICULUM_BRIEF_REVISION' }),
    'AdminCurriculumBriefRevision',
  );
  assert.equal(
    auditSchema
      .path('resourceId')
      .options.ref.call({ resourceType: 'LEARNING_PATH_PROPOSAL_REVISION' }),
    'AdminLearningPathProposalRevision',
  );
});

test('F044 metadata cannot broaden existing Auth/Technology/rubric audit branches', async () => {
  const actorId = new Types.ObjectId();
  const metadata = {
    technologyId: actorId,
    revision: 1,
    operationId: '12345678-1234-4123-8123-123456789abc',
    proposalId: actorId,
    sourceId: actorId,
    sourceRevision: 1,
  };
  for (const [key, value] of Object.entries(metadata))
    for (const event of [
      {
        category: 'AUTH',
        action: 'AUTH_REGISTERED',
        resourceType: 'USER',
        metadata: { source: 'EMAIL_PASSWORD' },
      },
      {
        category: 'CONTENT_MANAGEMENT',
        action: 'TECHNOLOGY_CREATED',
        resourceType: 'TECHNOLOGY',
        metadata: {
          changedFields: ['name', 'slug'],
          revisionBefore: null,
          revisionAfter: 0,
        },
      },
      {
        category: 'CONTENT_APPROVAL',
        action: 'PRACTICE_RUBRIC_AUTHORED',
        resourceType: 'PRACTICE_RUBRIC',
        metadata: { rubricVersion: 1 },
      },
    ])
      await assert.rejects(
        new Audit({
          ...event,
          actorId,
          resourceId: actorId,
          requestId: 'request',
          metadata: { ...event.metadata, [key]: value },
        }).validate(),
      );
});

test('F043 Technology audit tuples accept exact revisions and do not broaden legacy events', async () => {
  const actorId = new Types.ObjectId();
  const resourceId = new Types.ObjectId();
  const created = {
    category: 'CONTENT_MANAGEMENT',
    action: 'TECHNOLOGY_CREATED',
    actorId,
    resourceId,
    resourceType: 'TECHNOLOGY',
    requestId: 'request',
    metadata: {
      revisionBefore: null,
      revisionAfter: 0,
      changedFields: ['name', 'order', 'slug'],
    },
  };
  const updated = {
    ...created,
    action: 'TECHNOLOGY_UPDATED',
    metadata: { revisionBefore: 0, revisionAfter: 1, changedFields: ['name'] },
  };
  await new Audit(created).validate();
  await new Audit(updated).validate();
  for (const change of [
    { category: 'AUTH' },
    { resourceType: 'USER' },
    { action: 'USER_PROFILE_UPDATED' },
    { metadata: { ...created.metadata, token: 'SYNTHETIC_PRIVATE' } },
    { metadata: { ...created.metadata, source: 'ACCESS_TOKEN' } },
    { metadata: { ...created.metadata, rubricVersion: 1 } },
    { metadata: { ...created.metadata, revisionBefore: 0 } },
    { metadata: { ...created.metadata, revisionAfter: 1 } },
    {
      metadata: {
        ...created.metadata,
        changedFields: ['name', 'name', 'slug'],
      },
    },
    { metadata: { ...created.metadata, changedFields: ['slug', 'name'] } },
    {
      metadata: {
        ...created.metadata,
        changedFields: ['profile.experienceLevel'],
      },
    },
  ])
    await assert.rejects(new Audit({ ...created, ...change }).validate());
  for (const metadata of [
    { revisionBefore: 0, revisionAfter: 2, changedFields: ['name'] },
    { revisionBefore: null, revisionAfter: 1, changedFields: ['name'] },
    { revisionBefore: 0, revisionAfter: 1, changedFields: ['slug'] },
    { revisionBefore: 0, revisionAfter: 1, changedFields: [] },
  ])
    await assert.rejects(new Audit({ ...updated, metadata }).validate());
  for (const changedFields of [['name'], ['slug'], ['order']])
    await assert.rejects(
      new Audit({
        category: 'USER_ADMIN',
        action: 'USER_PROFILE_UPDATED',
        actorId,
        resourceId: actorId,
        resourceType: 'USER',
        requestId: 'request',
        metadata: { changedFields },
      }).validate(),
    );
  await assert.rejects(
    new Audit({
      category: 'AUTH',
      action: 'AUTH_REGISTERED',
      actorId,
      resourceId: actorId,
      resourceType: 'USER',
      requestId: 'request',
      metadata: { source: 'EMAIL_PASSWORD', revisionAfter: 0 },
    }).validate(),
  );
  assert.equal(
    auditSchema
      .path('resourceId')
      .options.ref.call({ resourceType: 'TECHNOLOGY' }),
    'Technology',
  );
});

test('audit schema accepts only bounded F007 actions and metadata offline', async () => {
  const id = new Types.ObjectId();
  const input = {
    category: 'AUTH',
    action: 'AUTH_REGISTERED',
    actorId: id,
    resourceId: id,
    resourceType: 'USER',
    requestId: 'request',
    metadata: { source: 'EMAIL_PASSWORD' },
  };
  await new Audit(input).validate();
  await new Audit({ ...input, action: 'AUTH_EMAIL_VERIFIED' }).validate();
  for (const patch of [
    { action: 'AUTH_LOGIN' },
    { requestId: 'x'.repeat(129) },
    { actorId: 'invalid' },
    { metadata: { source: 'EMAIL_PASSWORD', password: 'not-allowed' } },
  ])
    await assert.rejects(new Audit({ ...input, ...patch }).validate());
  assert.deepEqual(Object.keys(repository), [
    'appendAuthAudit',
    'appendGoogleAudit',
    'appendLoginAudit',
    'appendLogoutAudit',
    'appendProfileAudit',
    'appendRecoveryAudit',
    'appendRubricAudit',
  ]);
  assert.equal(Audit.db.readyState, 0);
  assert.equal(auditSchema.options.autoCreate, false);
  assert.equal(auditSchema.options.autoIndex, false);
  assert.deepEqual(auditSchema.indexes(), [
    [{ actorId: 1, createdAt: -1 }, {}],
    [{ resourceType: 1, resourceId: 1, createdAt: -1 }, {}],
  ]);
});

test('F008 audit actions constrain subjects, session IDs, source and failure metadata', async () => {
  const id = new Types.ObjectId();
  const base = {
    category: 'AUTH',
    actorId: id,
    resourceId: id,
    resourceType: 'USER',
    requestId: 'request',
  };
  for (const action of [
    'AUTH_LOGIN_SUCCESS',
    'AUTH_REFRESH_SUCCESS',
    'AUTH_REFRESH_REUSE_DETECTED',
  ]) {
    const metadata = {
      source: action.startsWith('AUTH_REFRESH_')
        ? 'REFRESH_TOKEN'
        : 'EMAIL_PASSWORD',
      sessionId: id,
      ...(action === 'AUTH_REFRESH_REUSE_DETECTED'
        ? { failureReason: 'TOKEN_REUSE' }
        : {}),
    };
    await new Audit({ ...base, action, metadata }).validate();
    await assert.rejects(
      new Audit({
        ...base,
        actorId: null,
        resourceId: null,
        action,
        metadata,
      }).validate(),
    );
    await assert.rejects(
      new Audit({
        ...base,
        action,
        metadata: { ...metadata, sessionId: undefined },
      }).validate(),
    );
  }
  await new Audit({
    ...base,
    actorId: null,
    resourceId: null,
    action: 'AUTH_LOGIN_FAILED',
    metadata: {
      source: 'EMAIL_PASSWORD',
      failureReason: 'INVALID_CREDENTIALS',
    },
  }).validate();
  for (const metadata of [
    { source: 'EMAIL_PASSWORD' },
    { source: 'REFRESH_TOKEN', failureReason: 'INVALID_CREDENTIALS' },
    { source: 'EMAIL_PASSWORD', failureReason: 'TOKEN_REUSE' },
    {
      source: 'EMAIL_PASSWORD',
      failureReason: 'INVALID_CREDENTIALS',
      secret: 'private',
    },
  ])
    await assert.rejects(
      new Audit({ ...base, action: 'AUTH_LOGIN_FAILED', metadata }).validate(),
    );
});

test('F009 audit fields are action-specific and preserve previous constraints', async () => {
  const id = new Types.ObjectId();
  const base = {
    category: 'AUTH',
    actorId: id,
    resourceId: id,
    resourceType: 'USER',
    requestId: 'request',
  };
  const current = {
    ...base,
    action: 'AUTH_LOGOUT',
    metadata: { source: 'REFRESH_TOKEN', sessionId: id },
  };
  const all = {
    ...base,
    action: 'AUTH_LOGOUT_ALL',
    metadata: { source: 'ACCESS_TOKEN', revokedSessions: 0 },
  };
  await new Audit(current).validate();
  await new Audit(all).validate();
  for (const input of [
    { ...current, actorId: null, resourceId: null },
    { ...current, metadata: { source: 'REFRESH_TOKEN' } },
    { ...current, metadata: { ...current.metadata, revokedSessions: 1 } },
    { ...all, metadata: { source: 'ACCESS_TOKEN' } },
    ...[-1, 0.5, null, NaN].map((revokedSessions) => ({
      ...all,
      metadata: { ...all.metadata, revokedSessions },
    })),
    { ...all, metadata: { ...all.metadata, sessionId: id } },
    { ...all, metadata: { ...all.metadata, source: 'EMAIL_PASSWORD' } },
    { ...all, metadata: { ...all.metadata, failureReason: 'TOKEN_REUSE' } },
    {
      ...all,
      metadata: { ...all.metadata, reactivatedFromExpiredSuspension: true },
    },
    { ...all, metadata: { ...all.metadata, refreshToken: 'private' } },
    {
      ...all,
      action: 'AUTH_REGISTERED',
      metadata: { source: 'EMAIL_PASSWORD', revokedSessions: 0 },
    },
  ])
    await assert.rejects(new Audit(input).validate());
});

test('F010 audit metadata allows only action-specific source, subject, session and count', async () => {
  const id = new Types.ObjectId();
  const base = {
    category: 'AUTH',
    actorId: id,
    resourceId: id,
    resourceType: 'USER',
    requestId: 'request',
  };
  for (const [action, metadata] of [
    ['AUTH_PASSWORD_RESET_REQUESTED', { source: 'EMAIL_RECOVERY' }],
    ['AUTH_PASSWORD_RESET', { source: 'RESET_TOKEN', revokedSessions: 2 }],
    [
      'AUTH_PASSWORD_CHANGED',
      { source: 'ACCESS_TOKEN', sessionId: id, revokedSessions: 0 },
    ],
  ] as const) {
    await new Audit({ ...base, action, metadata }).validate();
    for (const patch of [
      { actorId: null },
      { resourceId: new Types.ObjectId() },
      { metadata: { ...metadata, source: 'EMAIL_PASSWORD' } },
      { metadata: { ...metadata, email: 'private@example.com' } },
      { metadata: { ...metadata, failureReason: 'TOKEN_REUSE' } },
    ])
      await assert.rejects(
        new Audit({ ...base, action, metadata, ...patch }).validate(),
      );
  }
  for (const metadata of [
    { source: 'RESET_TOKEN' },
    { source: 'RESET_TOKEN', revokedSessions: -1 },
    { source: 'RESET_TOKEN', revokedSessions: null },
    { source: 'RESET_TOKEN', revokedSessions: 1.5 },
    { source: 'RESET_TOKEN', revokedSessions: 0, sessionId: id },
  ])
    await assert.rejects(
      new Audit({
        ...base,
        action: 'AUTH_PASSWORD_RESET',
        metadata,
      }).validate(),
    );
});

test('F011 Google audit actions restrict metadata and preserve older action boundaries', async () => {
  const id = new Types.ObjectId();
  const base = {
    category: 'AUTH',
    actorId: id,
    resourceId: id,
    resourceType: 'USER',
    requestId: 'request',
  };
  for (const [action, metadata] of [
    [
      'AUTH_GOOGLE_LOGIN',
      {
        source: 'GOOGLE',
        sessionId: id,
        reactivatedFromExpiredSuspension: false,
      },
    ],
    ['AUTH_PROVIDER_LINKED', { source: 'GOOGLE', provider: 'GOOGLE' }],
  ] as const) {
    await new Audit({ ...base, action, metadata }).validate();
    for (const patch of [
      { actorId: null },
      { resourceId: new Types.ObjectId() },
      { metadata: { ...metadata, email: 'private@example.com' } },
      { metadata: { ...metadata, failureReason: 'TOKEN_REUSE' } },
      { metadata: { ...metadata, source: 'EMAIL_PASSWORD' } },
    ])
      await assert.rejects(
        new Audit({ ...base, action, metadata, ...patch }).validate(),
      );
  }
  for (const [action, metadata] of [
    ['AUTH_GOOGLE_LOGIN', { source: 'GOOGLE', sessionId: id }],
    [
      'AUTH_GOOGLE_LOGIN',
      {
        source: 'GOOGLE',
        sessionId: id,
        reactivatedFromExpiredSuspension: false,
        provider: 'GOOGLE',
      },
    ],
    [
      'AUTH_PROVIDER_LINKED',
      { source: 'GOOGLE', provider: 'GOOGLE', sessionId: id },
    ],
    ['AUTH_REGISTERED', { source: 'EMAIL_PASSWORD', provider: 'GOOGLE' }],
  ] as const)
    await assert.rejects(new Audit({ ...base, action, metadata }).validate());
});

test('F012 profile audit permits only changed field names and preserves auth category/source requirements', async () => {
  const id = new Types.ObjectId();
  const input = {
    category: 'USER_ADMIN',
    action: 'USER_PROFILE_UPDATED',
    actorId: id,
    resourceId: id,
    resourceType: 'USER',
    requestId: 'profile',
    metadata: { changedFields: ['firstName', 'profile.learningGoals'] },
  };
  await new Audit(input).validate();
  for (const patch of [
    { category: 'AUTH' },
    { actorId: null },
    { resourceId: new Types.ObjectId() },
    { metadata: {} },
    { metadata: { changedFields: [] } },
    { metadata: { changedFields: ['firstName', 'firstName'] } },
    { metadata: { changedFields: ['passwordHash'] } },
    { metadata: { changedFields: [null] } },
    { metadata: { ...input.metadata, source: 'ACCESS_TOKEN' } },
    { metadata: { ...input.metadata, email: 'private@example.com' } },
  ])
    await assert.rejects(new Audit({ ...input, ...patch }).validate());
  for (const metadata of [
    {},
    { source: 'EMAIL_PASSWORD', changedFields: ['firstName'] },
  ])
    await assert.rejects(
      new Audit({
        ...input,
        category: 'AUTH',
        action: 'AUTH_REGISTERED',
        metadata,
      }).validate(),
    );
  await assert.rejects(
    new Audit({
      ...input,
      action: 'AUTH_REGISTERED',
      metadata: { source: 'EMAIL_PASSWORD' },
    }).validate(),
  );
});
