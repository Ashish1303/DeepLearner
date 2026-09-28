import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { Session, sessionSchema } from '../src/modules/auth/session.model.js';
import { mongoose } from '../src/config/database.js';

const fields = {
  userId: new Types.ObjectId(),
  refreshTokenHash: 'a'.repeat(64),
  expiresAt: new Date('2030-01-01'),
};

test('sessions permit multiple devices and future rotation metadata without performing rotation', async () => {
  const first = new Session({
    ...fields,
    deviceInfo: { userAgent: 'test', deviceLabel: 'laptop' },
    ipHash: 'b'.repeat(64),
  });
  const second = new Session(fields);
  await first.validate();
  await second.validate();
  assert.notEqual(String(first._id), String(second._id));
  assert.equal(first.revokedAt, null);
  assert.ok(first.createdAt instanceof Date);
  assert.ok(first.lastUsedAt instanceof Date);
  const id = String(first._id);
  first.refreshTokenHash = 'c'.repeat(64);
  first.lastUsedAt = new Date();
  first.revokedAt = new Date();
  first.revocationReason = 'TOKEN_REUSE';
  await first.validate();
  assert.equal(String(first._id), id);
});

test('sessions reject missing or malformed credentials, references and metadata', async () => {
  for (const patch of [
    { userId: undefined },
    { userId: 'invalid' },
    { refreshTokenHash: undefined },
    { refreshTokenHash: 'raw-token' },
    { refreshTokenHash: 'g'.repeat(64) },
    { expiresAt: undefined },
    { expiresAt: 'invalid' },
    { ipHash: '127.0.0.1' },
    { deviceInfo: { userAgent: 'x'.repeat(513) } },
    { revocationReason: 'x'.repeat(501) },
  ])
    await assert.rejects(new Session({ ...fields, ...patch }).validate());
  assert.throws(() => new Session({ ...fields, refreshToken: 'raw-token' }));
  // Expired records remain representable; validity belongs to future services, not TTL cleanup.
  await new Session({ ...fields, expiresAt: new Date(0) }).validate();
});

test('sessions hide hashes in selection and both serialization paths', () => {
  const session = new Session({ ...fields, ipHash: 'b'.repeat(64) });
  for (const field of ['refreshTokenHash', 'ipHash']) {
    assert.equal(sessionSchema.path(field).options.select, false);
    assert.equal(field in session.toObject(), false);
    assert.equal(field in session.toJSON(), false);
  }
});

test('session lookup, uniqueness and TTL declarations do not provision indexes', () => {
  assert.equal(Session.db, mongoose.connection);
  assert.equal(Session.db.readyState, 0);
  assert.equal(Session.collection.name, 'sessions');
  for (const option of ['autoCreate', 'autoIndex', 'bufferCommands'] as const)
    assert.equal(sessionSchema.options[option], false);
  assert.deepEqual(sessionSchema.indexes(), [
    [{ refreshTokenHash: 1 }, { unique: true }],
    [{ userId: 1, revokedAt: 1 }, {}],
    [{ expiresAt: 1 }, { expireAfterSeconds: 0 }],
  ]);
});
