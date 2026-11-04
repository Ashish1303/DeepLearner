import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

export default class BacklogReporter implements Reporter {
  private rows: object[] = [];
  onTestEnd(test: TestCase, result: TestResult) {
    const row = {
      id: test.id,
      title: test.title,
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
      // No raw console, request bodies, headers, DOM snapshots or exception data.
      errorCount: result.errors.length,
      failureClassification: result.errors
        .map(
          (e) =>
            e.message?.match(/QA_[A-Z_]+(?:: [A-Z_]+)?(?: ageMs=\d+)?/)?.[0],
        )
        .filter(Boolean),
    };
    this.rows.push(row);
    const directory = process.env.QA_BROWSER_OUTPUT;
    if (!directory) throw Error('QA_REPORT_DESTINATION_REQUIRED');
    appendFileSync(
      join(directory, 'case-journal.jsonl'),
      JSON.stringify(row) + '\n',
    );
  }
  onEnd(result: FullResult) {
    const directory = process.env.QA_BROWSER_OUTPUT;
    const phase = process.env.QA_BROWSER_PHASE;
    if (!directory || !/^(qualification|student|admin)$/.test(phase ?? ''))
      throw Error('QA_REPORT_DESTINATION_REQUIRED');
    writeFileSync(
      join(directory, `${phase}-results.json`),
      JSON.stringify({ status: result.status, cases: this.rows }, null, 2) +
        '\n',
      { flag: 'wx' },
    );
  }
}
