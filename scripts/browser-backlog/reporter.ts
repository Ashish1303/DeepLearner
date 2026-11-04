import { appendFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { assertCases, executionDestination } from './inventory.mjs';

export default class BacklogReporter implements Reporter {
  private rows: object[] = [];
  private executing = false;
  private failure = false;
  onBegin(_config: FullConfig, suite: Suite) {
    try {
      assertCases(
        suite.allTests().map((test) => ({
          project: test.parent.project()?.name ?? '',
          file: basename(test.location.file),
          titles: test.titlePath().slice(3),
        })),
      );
    } catch {
      this.failure = true;
    }
  }
  onTestBegin(test: TestCase) {
    // Documented execution event; --list emits no onTestBegin. No argv guessing.
    this.executing = true;
    try {
      executionDestination(process.env, test.parent.project()?.name);
    } catch {
      this.failure = true;
    }
  }
  onTestEnd(test: TestCase, result: TestResult) {
    this.executing = true;
    if (this.failure) return;
    try {
      const { directory } = executionDestination(
        process.env,
        test.parent.project()?.name,
      );
      const row = {
        id: test.id,
        title: test.title,
        identity: {
          project: test.parent.project()?.name,
          file: basename(test.location.file),
          titles: test.titlePath().slice(3),
        },
        project: test.parent.project()?.name,
        file: test.location.file
          .replaceAll('\\', '/')
          .split('/tests/browser/')[1],
        line: test.location.line,
        status: result.status,
        expected: test.expectedStatus,
        retry: result.retry,
        durationMs: result.duration,
        startedUtc: result.startTime.toISOString(),
        // Never retain raw console, request/response data or exception messages.
        errorCount: result.errors.length,
        failureClassification: result.errors
          .map(
            (e) =>
              e.message?.match(/QA_[A-Z_]+(?:: [A-Z_]+)?(?: ageMs=\d+)?/)?.[0],
          )
          .filter(Boolean),
      };
      this.rows.push(row);
      appendFileSync(
        join(directory, 'case-journal.jsonl'),
        JSON.stringify(row) + '\n',
      );
    } catch {
      this.failure = true;
    }
  }
  async onEnd(result: FullResult): Promise<{ status: 'failed' } | undefined> {
    // Reporter exceptions are swallowed by Playwright: latch and return failed.
    if (this.failure) return { status: 'failed' };
    // Discovery/zero-execution is artifact-free and supplies no execution receipt.
    if (!this.executing) return;
    try {
      const { directory, phase } = executionDestination(process.env);
      writeFileSync(
        join(directory, `${phase}-results.json`),
        JSON.stringify({ status: result.status, cases: this.rows }, null, 2) +
          '\n',
        { flag: 'wx' },
      );
    } catch {
      return { status: 'failed' };
    }
  }
}
