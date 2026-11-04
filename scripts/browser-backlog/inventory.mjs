import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, URL } from 'node:url';
import { resolve, basename } from 'node:path';
import ts from 'typescript';
import { ADMIN_ORIGIN, WEB_ORIGIN } from './lease.mjs';

export const inventory = JSON.parse(
  readFileSync(new URL('./inventory.json', import.meta.url), 'utf8'),
);
export const identity = (project, file, titles) =>
  JSON.stringify([project, basename(file), titles]);
export function assertCases(actual, frozen = inventory) {
  const files = new Set(actual.map((c) => c.file));
  const expected = frozen.files
    .filter((f) => files.has(f.file))
    .flatMap((f) =>
      f.cases.map((titles) => identity(f.project, f.file, titles)),
    );
  const keys = actual.map((c) => identity(c.project, c.file, c.titles));
  if (
    !keys.length ||
    new Set(keys).size !== keys.length ||
    JSON.stringify([...keys].sort()) !== JSON.stringify(expected.sort())
  )
    throw Error('QA_CASE_INVENTORY_REFUSED');
}
export function assertCaseIdentity(actual, frozen = inventory) {
  const expected = frozen.files.find(
    (file) => file.file === actual.file && file.project === actual.project,
  );
  if (
    !expected ||
    !expected.cases.some(
      (titles) =>
        identity(actual.project, actual.file, titles) ===
        identity(actual.project, actual.file, actual.titles),
    )
  )
    throw Error('QA_CASE_INVENTORY_REFUSED');
}
export function assertOwnedImport(source, project) {
  const ast = ts.createSourceFile(
    'spec.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  let owned = false,
    origin = project !== 'admin';
  for (const node of ast.statements) {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteral(node.moduleSpecifier)
    )
      continue;
    const clause = node.importClause;
    if (
      !clause ||
      clause.isTypeOnly ||
      !clause.namedBindings ||
      !ts.isNamedImports(clause.namedBindings)
    )
      continue;
    for (const item of clause.namedBindings.elements) {
      if (item.isTypeOnly) continue;
      const name = (item.propertyName ?? item.name).text;
      if (name === 'test') {
        if (node.moduleSpecifier.text !== './qa-test')
          throw Error('QA_OWNED_FIXTURE_REQUIRED');
        owned = true;
      }
      if (name === 'ADMIN_ORIGIN' && node.moduleSpecifier.text === './qa-test')
        origin = true;
    }
  }
  if (!owned || !origin) throw Error('QA_OWNED_FIXTURE_REQUIRED');
}
export function assertSources(
  root = resolve(fileURLToPath(new URL('../..', import.meta.url))),
  frozen = inventory,
) {
  if (
    ADMIN_ORIGIN !== 'http://127.0.0.1:5181' ||
    WEB_ORIGIN !== 'http://127.0.0.1:3101'
  )
    throw Error('QA_ORIGIN_REFUSED');
  const actual = readdirSync(resolve(root, 'tests/browser'))
    .filter((f) => f.endsWith('.spec.ts'))
    .sort();
  const expected = [
    ...frozen.files.map((f) => f.file),
    ...frozen.excluded.map((f) => f.file),
  ].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw Error('QA_FILE_INVENTORY_REFUSED');
  for (const [path, hash] of Object.entries(frozen.supportSources)) {
    if (
      createHash('sha256')
        .update(readFileSync(resolve(root, path)))
        .digest('hex') !== hash
    )
      throw Error('QA_FIXTURE_SOURCE_DRIFT');
  }
  for (const file of frozen.files) {
    const source = readFileSync(resolve(root, 'tests/browser', file.file));
    if (createHash('sha256').update(source).digest('hex') !== file.sha256)
      throw Error('QA_SPEC_SOURCE_DRIFT');
    assertOwnedImport(source.toString('utf8'), file.project);
  }
}
export function executionDestination(env, project) {
  if (
    !env.QA_BROWSER_OUTPUT ||
    !/^(qualification|student|admin)$/.test(env.QA_BROWSER_PHASE ?? '') ||
    (project && project !== env.QA_BROWSER_PHASE)
  )
    throw Error('QA_REPORT_DESTINATION_REQUIRED');
  return { directory: env.QA_BROWSER_OUTPUT, phase: env.QA_BROWSER_PHASE };
}
