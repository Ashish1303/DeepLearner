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
    'appendLoginAudit',
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
