import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { Audit, auditSchema } from '../src/modules/audit/audit.model.js';
import * as repository from '../src/modules/audit/audit.repository.js';

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
