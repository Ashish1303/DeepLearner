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
  assert.deepEqual(Object.keys(repository), ['appendAuthAudit']);
  assert.equal(Audit.db.readyState, 0);
  assert.equal(auditSchema.options.autoCreate, false);
  assert.equal(auditSchema.options.autoIndex, false);
  assert.deepEqual(auditSchema.indexes(), [
    [{ actorId: 1, createdAt: -1 }, {}],
    [{ resourceType: 1, resourceId: 1, createdAt: -1 }, {}],
  ]);
});
