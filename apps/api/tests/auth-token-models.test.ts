import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { EmailVerificationToken } from '../src/modules/auth/email-verification-token.model.js';
import { PasswordResetToken } from '../src/modules/auth/password-reset-token.model.js';
import { mongoose } from '../src/config/database.js';

for (const Model of [EmailVerificationToken, PasswordResetToken]) {
  const fields = {
    userId: new Types.ObjectId(),
    tokenHash: 'd'.repeat(64),
    expiresAt: new Date('2030-01-01'),
  };
  test(`${Model.modelName}: nullable consumption and explicit expiry`, async () => {
    const token = new Model(fields);
    await token.validate();
    assert.equal(token.usedAt, null);
    assert.ok(token.createdAt instanceof Date);
    token.usedAt = new Date();
    token.expiresAt = new Date(0);
    await token.validate();
  });
  test(`${Model.modelName}: malformed and missing fields fail`, async () => {
    for (const patch of [
      { userId: undefined },
      { userId: 'bad' },
      { tokenHash: undefined },
      { tokenHash: 'plaintext' },
      { tokenHash: 'f'.repeat(63) },
      { tokenHash: 'g'.repeat(64) },
      { expiresAt: undefined },
      { expiresAt: 'bad' },
      { usedAt: 'bad' },
    ])
      await assert.rejects(new Model({ ...fields, ...patch }).validate());
    assert.throws(() => new Model({ ...fields, token: 'raw-token' }));
  });
  test(`${Model.modelName}: sensitive values stay out of normal serialization`, () => {
    const token = new Model(fields);
    assert.equal(Model.schema.path('tokenHash').options.select, false);
    assert.equal('tokenHash' in token.toObject(), false);
    assert.equal('tokenHash' in token.toJSON(), false);
    assert.equal(JSON.stringify(token).includes(fields.tokenHash), false);
  });
  test(`${Model.modelName}: disconnected model declares unique, user and TTL indexes`, () => {
    assert.equal(Model.db, mongoose.connection);
    assert.equal(Model.db.readyState, 0);
    assert.equal(
      Model.collection.name,
      Model === EmailVerificationToken
        ? 'emailVerificationTokens'
        : 'passwordResetTokens',
    );
    for (const option of ['autoCreate', 'autoIndex', 'bufferCommands'] as const)
      assert.equal(Model.schema.options[option], false);
    assert.deepEqual(Model.schema.indexes(), [
      [{ tokenHash: 1 }, { unique: true }],
      [{ userId: 1 }, {}],
      [{ expiresAt: 1 }, { expireAfterSeconds: 0 }],
    ]);
  });
}
