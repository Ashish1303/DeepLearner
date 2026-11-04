import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyTarget } from './network-policy.mjs';
test('only exact logical API proxy probe qualifies transport', () => {
  assert.deepEqual(classifyTarget('http://127.0.0.1:4000/qa-network-probe'), {
    deniedProxy: 1,
    apiFallthrough: 0,
    proxyProbes: 1,
    directProbes: 0,
  });
});
test('absolute unmatched API and altered probes count as fallthrough', () => {
  for (const suffix of [
    '/api/v1/auth/login',
    '/qa-network-probe?extra=1',
    '/',
  ]) {
    const result = classifyTarget('http://127.0.0.1:4000' + suffix);
    assert.equal(result.apiFallthrough, 1);
    assert.equal(result.proxyProbes, 0);
  }
});
test('direct probe cannot qualify a proxy route', () => {
  const result = classifyTarget('/qa-network-probe');
  assert.equal(result.directProbes, 1);
  assert.equal(result.apiFallthrough, 1);
  assert.equal(result.proxyProbes, 0);
});
test('CONNECT to logical API counts as unmatched, every CONNECT is denied', () => {
  assert.equal(classifyTarget('127.0.0.1:4000', true).apiFallthrough, 1);
  assert.equal(classifyTarget('example.invalid:443', true).deniedProxy, 1);
});
test('background proxy traffic is denied without counting as synthetic API', () => {
  assert.deepEqual(classifyTarget('https://example.invalid/'), {
    deniedProxy: 1,
    apiFallthrough: 0,
    proxyProbes: 0,
    directProbes: 0,
  });
  assert.equal(classifyTarget('/api/v1/other').apiFallthrough, 1);
});
