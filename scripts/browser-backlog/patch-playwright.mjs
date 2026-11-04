import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import process from 'node:process';
import { log } from 'node:console';

export const originalHash =
  '2325ca4c1c83070e89dc49fb82525508f0a68e0cf12e2a624277968da216b7e0';
export const patchedHash =
  'c940637985a63463b50ddabf4d41f3c927380286afb877eea98e0cf86896f932';
export const before =
  'function killProcessTree(pid) {\n  try {\n    if (process.platform === "win32")\n      childProcess.spawnSync(`taskkill /pid ${pid} /T /F`, { shell: true, windowsHide: true });\n    else\n      process.kill(pid, "SIGKILL");\n  } catch {\n  }\n}';
export const after =
  'function killProcessTree(pid) {\n  if (process.platform === "win32")\n    throw new Error("QA_OWNED_JOB_CLEANUP_REQUIRED");\n  try {\n    process.kill(pid, "SIGKILL");\n  } catch {\n  }\n}';
export const hash = (text) => createHash('sha256').update(text).digest('hex');
export function patchSource(source, version) {
  if (version !== '1.64.0') throw Error('QA_PLAYWRIGHT_VERSION_DRIFT');
  if (hash(source) === patchedHash) return source;
  if (hash(source) !== originalHash || source.split(before).length !== 2)
    throw Error('QA_PLAYWRIGHT_SOURCE_DRIFT');
  const candidate = source.replace(before, after);
  if (hash(candidate) !== patchedHash) throw Error('QA_PATCH_HASH_REFUSED');
  return candidate;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const file = resolve('node_modules/playwright-core/lib/coreBundle.js');
  const version = JSON.parse(
    readFileSync(resolve('node_modules/playwright-core/package.json'), 'utf8'),
  ).version;
  const current = readFileSync(file, 'utf8');
  if (process.argv[2] === '--apply') {
    const candidate = patchSource(current, version);
    if (candidate !== current) writeFileSync(file, candidate);
    assert.equal(hash(readFileSync(file)), patchedHash);
    log('QA_PINNED_PLAYWRIGHT_PATCH_APPLIED');
  } else if (process.argv[2] === '--verify') {
    assert.equal(version, '1.64.0');
    assert.equal(hash(current), patchedHash);
    // Parent runs this actual installed-code negative control inside its retained Job.
    // No positive PID-tree termination is implemented or permitted.
    const require = createRequire(import.meta.url);
    assert.throws(
      () =>
        require('playwright-core/lib/coreBundle').utils.killProcessTree(
          process.pid,
        ),
      /^Error: QA_OWNED_JOB_CLEANUP_REQUIRED$/,
    );
    log('QA_INSTALLED_UNSAFE_FALLBACK_REFUSED');
  } else throw Error('QA_PATCH_ACTION_REFUSED');
}
