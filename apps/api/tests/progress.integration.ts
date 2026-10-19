// Entry point only for a separately approved, owned disposable database gate.
// Reuses the expanded F031-F037 fixture rather than duplicating seeds or connections.
import assert from 'node:assert/strict';
assert.equal(process.env.APP_ENV, 'LOCAL');
assert.equal(process.env.F021_TEST_ALLOW_WRITES, 'APPROVED');
assert.equal(
  process.env.F021_TEST_URI,
  'mongodb://127.0.0.1:27018/?replicaSet=f021-test',
);
assert.equal(process.env.F021_TEST_DB, 'deeplearner-f021-test');
// The external verified runner must establish retained-handle/Job ownership,
// fresh storage, PRIMARY and an empty target before invoking this entry point.
await import('./practice.integration.js');
