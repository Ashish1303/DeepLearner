import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  assertCases,
  assertCaseIdentity,
  assertOwnedImport,
  assertSources,
  executionDestination,
  inventory,
} from './inventory.mjs';

const cases = inventory.files.flatMap((f) =>
  f.cases.map((titles) => ({ project: f.project, file: f.file, titles })),
);
test('frozen 225 stable project/file/title-path identities and explicit U exclusion', () => {
  assert.equal(cases.length, 225);
  assertCases(cases);
  assertSources();
  assert.deepEqual(inventory.excluded, [
    {
      file: 'admin-learning-path-proposals.spec.ts',
      cases: 16,
      status: 'NOT_RUN',
    },
  ]);
});
for (const [name, change] of [
  [
    'same count substituted title',
    (a) => {
      a[0].titles = ['unreviewed'];
    },
  ],
  [
    'wrong actor project',
    (a) => {
      a[0].project = 'qualification';
    },
  ],
  [
    'missing case',
    (a) => {
      a.pop();
    },
  ],
  [
    'duplicate identity',
    (a) => {
      a[0] = a[1];
    },
  ],
  [
    'U case enrolled',
    (a) => {
      a[0].file = 'admin-learning-path-proposals.spec.ts';
    },
  ],
])
  test(name + ' fails closed', () => {
    const a = JSON.parse(JSON.stringify(cases));
    change(a);
    assert.throws(() => assertCases(a), /QA_CASE_INVENTORY_REFUSED/);
  });
test('complete per-file subset accepted, partial file refused', () => {
  const a = cases.filter((c) => c.file === cases[0].file);
  assertCases(a);
  assert.throws(() => assertCases(a.slice(1)));
});
test('owned aliased fixture and approved Admin origin import required', () => {
  assertOwnedImport(
    "import { test as base, ADMIN_ORIGIN } from './qa-test'",
    'admin',
  );
  for (const source of [
    "import { test } from '@playwright/test'",
    "import type { test, ADMIN_ORIGIN } from './qa-test'",
    "import { test } from './qa-test'",
    "// import { test, ADMIN_ORIGIN } from './qa-test'",
  ])
    assert.throws(() => assertOwnedImport(source, 'admin'));
});
test('execution destinations remain mandatory and phase-bound', () => {
  for (const env of [
    {},
    { QA_BROWSER_OUTPUT: '/synthetic' },
    { QA_BROWSER_OUTPUT: '/synthetic', QA_BROWSER_PHASE: 'discovery' },
  ])
    assert.throws(() => executionDestination(env));
  const env = { QA_BROWSER_OUTPUT: '/synthetic', QA_BROWSER_PHASE: 'admin' };
  assert.throws(() => executionDestination(env, 'student'));
  assert.deepEqual(executionDestination(env, 'admin'), {
    directory: '/synthetic',
    phase: 'admin',
  });
});

test('single runtime identity admission rejects changed title, project and U', () => {
  assertCaseIdentity(cases[0]);
  for (const change of [
    { titles: ['changed'] },
    { project: 'unqualified' },
    { file: 'admin-learning-path-proposals.spec.ts' },
  ])
    assert.throws(() => assertCaseIdentity({ ...cases[0], ...change }));
});
test('source and unexpected-file drift refuse before execution', () => {
  const root = mkdtempSync(join(tmpdir(), 'qa-inventory-'));
  const directory = join(root, 'tests/browser');
  const source = "import { test, ADMIN_ORIGIN } from './qa-test';";
  const digest = (text) => createHash('sha256').update(text).digest('hex');
  const frozen = {
    files: [
      {
        file: 'admin-synthetic.spec.ts',
        project: 'admin',
        sha256: digest(source),
        cases: [['synthetic']],
      },
    ],
    excluded: [],
    supportSources: { 'fixture.txt': digest('approved') },
  };
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'admin-synthetic.spec.ts'), source);
    writeFileSync(join(root, 'fixture.txt'), 'approved');
    assertSources(root, frozen);
    writeFileSync(join(root, 'fixture.txt'), 'changed');
    assert.throws(() => assertSources(root, frozen), /QA_FIXTURE_SOURCE_DRIFT/);
    writeFileSync(join(root, 'fixture.txt'), 'approved');
    writeFileSync(
      join(directory, 'admin-synthetic.spec.ts'),
      source + '// changed',
    );
    assert.throws(() => assertSources(root, frozen), /QA_SPEC_SOURCE_DRIFT/);
    writeFileSync(join(directory, 'new.spec.ts'), '');
    assert.throws(
      () => assertSources(root, frozen),
      /QA_FILE_INVENTORY_REFUSED/,
    );
  } finally {
    rmSync(root, { recursive: true });
  }
});
