import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type {
  FullConfig,
  FullResult,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import BacklogReporter from './reporter';

const end = { status: 'passed' } as FullResult;
const fakeTest = { parent: { project: () => ({ name: 'admin' }) } } as TestCase;
test('ordinary discovery has no destination requirement or result artifacts, even with execution variables present', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'qa-reporter-'));
  const previous = {
    output: process.env.QA_BROWSER_OUTPUT,
    phase: process.env.QA_BROWSER_PHASE,
  };
  try {
    for (const configured of [false, true]) {
      if (configured) {
        process.env.QA_BROWSER_OUTPUT = directory;
        process.env.QA_BROWSER_PHASE = 'admin';
      } else {
        delete process.env.QA_BROWSER_OUTPUT;
        delete process.env.QA_BROWSER_PHASE;
      }
      assert.equal(await new BacklogReporter().onEnd(end), undefined);
      assert.deepEqual(readdirSync(directory), []);
    }
  } finally {
    if (previous.output === undefined) delete process.env.QA_BROWSER_OUTPUT;
    else process.env.QA_BROWSER_OUTPUT = previous.output;
    if (previous.phase === undefined) delete process.env.QA_BROWSER_PHASE;
    else process.env.QA_BROWSER_PHASE = previous.phase;
    rmSync(directory, { recursive: true });
  }
});
test('missing execution destination returns failed instead of relying on swallowed exceptions', async () => {
  const previous = process.env.QA_BROWSER_OUTPUT;
  try {
    delete process.env.QA_BROWSER_OUTPUT;
    const reporter = new BacklogReporter();
    reporter.onTestBegin(fakeTest);
    reporter.onTestEnd(fakeTest, {} as TestResult);
    assert.deepEqual(await reporter.onEnd(end), { status: 'failed' });
  } finally {
    if (previous === undefined) delete process.env.QA_BROWSER_OUTPUT;
    else process.env.QA_BROWSER_OUTPUT = previous;
  }
});
test('inventory errors explicitly fail discovery without creating a successful receipt', async () => {
  const reporter = new BacklogReporter();
  reporter.onBegin(
    {} as FullConfig,
    { allTests: () => [] } as unknown as Suite,
  );
  assert.deepEqual(await reporter.onEnd(end), { status: 'failed' });
});

test('real execution requires destination and emits sanitized bounded result; duplicate receipt fails', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'qa-reporter-'));
  const previous = {
    output: process.env.QA_BROWSER_OUTPUT,
    phase: process.env.QA_BROWSER_PHASE,
  };
  const current = {
    ...fakeTest,
    id: 'synthetic',
    title: 'synthetic',
    expectedStatus: 'passed',
    location: { file: 'tests/browser/admin-synthetic.spec.ts', line: 1 },
    titlePath: () => ['', 'admin', 'admin-synthetic.spec.ts', 'synthetic'],
  } as TestCase;
  const result = {
    status: 'passed',
    retry: 0,
    duration: 1,
    startTime: new Date(0),
    errors: [{ message: 'PRIVATE_SYNTHETIC_VALUE' }],
  } as TestResult;
  try {
    process.env.QA_BROWSER_OUTPUT = directory;
    process.env.QA_BROWSER_PHASE = 'admin';
    const reporter = new BacklogReporter();
    reporter.onTestBegin(current);
    reporter.onTestEnd(current, result);
    assert.equal(await reporter.onEnd(end), undefined);
    const receipt = readFileSync(join(directory, 'admin-results.json'), 'utf8');
    assert.ok(!receipt.includes('PRIVATE_SYNTHETIC_VALUE'));
    assert.equal(JSON.parse(receipt).cases.length, 1);
    assert.deepEqual(await reporter.onEnd(end), { status: 'failed' });
  } finally {
    if (previous.output === undefined) delete process.env.QA_BROWSER_OUTPUT;
    else process.env.QA_BROWSER_OUTPUT = previous.output;
    if (previous.phase === undefined) delete process.env.QA_BROWSER_PHASE;
    else process.env.QA_BROWSER_PHASE = previous.phase;
    rmSync(directory, { recursive: true });
  }
});
