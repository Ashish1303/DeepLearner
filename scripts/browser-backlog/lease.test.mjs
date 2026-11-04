import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateLease } from './lease.mjs';
const nonce = 'a'.repeat(64),
  now = Date.parse('2026-11-04T00:00:00Z');
const value = {
  revision: 1,
  repo: 'qa',
  nonce,
  endpoint: 'ws://127.0.0.1:9281/devtools/browser/abc-123',
  chromePid: 123,
  creation: '123456789012345678',
  ownerSid: 'S-1-5-21-3436178198-164699745-524212520-1001',
  sources: { 'package-lock.json': nonce },
};
const facts = () => ({
  repo: 'qa',
  nonce,
  now,
  hash: () => nonce,
  proof: {
    nonce,
    chromePid: 123,
    creation: '123456789012345678',
    owned: true,
    time: new Date(now).toISOString(),
  },
});
test('exact fresh owned lease accepted', () =>
  assert.equal(validateLease(value, facts()), value));
test('close intent immediately refuses new connection authority', () =>
  assert.throws(
    () => validateLease(value, { ...facts(), closing: true }),
    /QA_BROWSER_CLOSING/,
  ));
test('source verification cannot hide a newly created close intent', () => {
  const f = facts();
  f.hash = () => {
    f.closing = true;
    return nonce;
  };
  assert.throws(() => validateLease(value, f), /QA_BROWSER_CLOSING/);
});
test('proof is admitted only after source verification', () => {
  const f = facts();
  f.hash = () => {
    f.proof.time = new Date(now - 2001).toISOString();
    return nonce;
  };
  assert.throws(() => validateLease(value, f), /STALE_PROOF ageMs=2001/);
});
for (const [name, change] of [
  ['wrong worktree', { repo: 'dev' }],
  ['wrong Windows owner', { ownerSid: 'S-1-5-18' }],
  ['numeric FILETIME', { creation: 123456789012345680 }],
  ['wrong nonce', { nonce: 'b'.repeat(64) }],
  [
    'unknown endpoint',
    { endpoint: 'ws://127.0.0.1:9222/devtools/browser/abc' },
  ],
  [
    'nonloopback endpoint',
    { endpoint: 'ws://example.test:9281/devtools/browser/abc' },
  ],
  ['missing source inventory', { sources: {} }],
  ['path traversal', { sources: { '../dev': nonce } }],
])
  test(name + ' refused', () =>
    assert.throws(() => validateLease({ ...value, ...change }, facts())),
  );
test('source hash drift refused', () =>
  assert.throws(() =>
    validateLease(value, { ...facts(), hash: () => 'b'.repeat(64) }),
  ));
for (const [name, change] of [
  ['unowned process', { owned: false }],
  ['PID reuse', { creation: '123456789012345679' }],
  ['different process', { chromePid: 124 }],
  ['stale proof', { time: new Date(now - 2001).toISOString() }],
  ['future proof', { time: new Date(now + 251).toISOString() }],
])
  test(name + ' refused', () => {
    const f = facts();
    assert.throws(() =>
      validateLease(value, { ...f, proof: { ...f.proof, ...change } }),
    );
  });
