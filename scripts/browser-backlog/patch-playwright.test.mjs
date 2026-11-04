import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import {
  before,
  after,
  hash,
  originalHash,
  patchedHash,
  patchSource,
} from './patch-playwright.mjs';
const installed = readFileSync(
  new URL(
    '../../node_modules/playwright-core/lib/coreBundle.js',
    import.meta.url,
  ),
  'utf8',
);
const original =
  hash(installed) === patchedHash
    ? installed.replace(after, before)
    : installed;
test('pinned installed source transforms to exact reviewed refusal', () => {
  assert.equal(hash(original), originalHash);
  assert.equal(hash(patchSource(original, '1.64.0')), patchedHash);
});
test('reviewed patch is idempotent, no automatic dependency upgrade', () => {
  const result = patchSource(original, '1.64.0');
  assert.equal(patchSource(result, '1.64.0'), result);
  assert.throws(() => patchSource(original, '1.65.0'));
});
test('drift and partial patch fail closed', () => {
  assert.throws(() => patchSource(original + '\n', '1.64.0'));
  assert.throws(() =>
    patchSource(original.replace('taskkill /pid', 'taskkill /PID'), '1.64.0'),
  );
});
