import {
  existsSync,
  readFileSync,
  writeFileSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { resolve, relative, isAbsolute, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import process from 'node:process';

export const WEB_ORIGIN = 'http://127.0.0.1:3101';
export const ADMIN_ORIGIN = 'http://127.0.0.1:5181';
// Logical mock origin required by the unchanged Admin client allowlist.
// No API is started here: unmatched traffic is denied by the owned 4101 proxy.
export const API_ORIGIN = 'http://127.0.0.1:4000';

export function validateLease(value, facts) {
  if (facts.closing) throw Error('QA_BROWSER_CLOSING');
  if (
    !value ||
    value.revision !== 1 ||
    value.repo !== facts.repo ||
    value.ownerSid !== 'S-1-5-21-3436178198-164699745-524212520-1001' ||
    typeof value.creation !== 'string' ||
    !/^\d{17,18}$/.test(value.creation) ||
    !/^[a-f0-9]{64}$/.test(value.nonce ?? '') ||
    value.nonce !== facts.nonce ||
    !/^ws:\/\/127\.0\.0\.1:9281\/devtools\/browser\/[a-f0-9-]+$/.test(
      value.endpoint ?? '',
    ) ||
    !Number.isSafeInteger(value.chromePid) ||
    value.chromePid <= 0 ||
    !value.sources ||
    !Object.keys(value.sources).length
  )
    throw Error('QA_LEASE_REFUSED');
  for (const [file, hash] of Object.entries(value.sources)) {
    if (
      isAbsolute(file) ||
      file.split(/[\\/]/).includes('..') ||
      !/^[a-f0-9]{64}$/.test(hash) ||
      facts.hash(file) !== hash
    )
      throw Error('QA_SOURCE_DRIFT');
  }
  const proof = facts.proof;
  const refuse = (reason) => {
    throw Error('QA_LIVE_OWNERSHIP_NOT_PROVEN: ' + reason);
  };
  if (!proof) refuse('MISSING_PROOF');
  if (proof.nonce !== value.nonce) refuse('GENERATION_MISMATCH');
  if (proof.chromePid !== value.chromePid) refuse('PROCESS_MISMATCH');
  if (proof.creation !== value.creation) refuse('CREATION_MISMATCH');
  if (proof.owned !== true) refuse('UNOWNED');
  if (!Number.isFinite(Date.parse(proof.time))) refuse('MALFORMED_TIME');
  const age = facts.now - Date.parse(proof.time);
  if (age < -250) refuse('FUTURE_PROOF');
  if (age > 2000) refuse('STALE_PROOF ageMs=' + Math.min(Math.floor(age), 1e9));
  if (facts.closing) throw Error('QA_BROWSER_CLOSING');
  return value;
}

export function readLease() {
  const file = process.env.QA_BROWSER_LEASE;
  const repo = realpathSync(process.cwd());
  if (
    !file ||
    !resolve(file).startsWith(join(repo, '.cache', 'browser-backlog') + '\\') ||
    statSync(file).size > 262144
  )
    throw Error('QA_GUARD_REQUIRED');
  const value = JSON.parse(readFileSync(file, 'utf8'));
  return validateLease(value, {
    repo,
    nonce: process.env.QA_BROWSER_NONCE,
    // Read the latest native proof AFTER hashing, at the point of admission.
    get proof() {
      return JSON.parse(readFileSync(join(dirname(file), 'live.json'), 'utf8'));
    },
    get now() {
      return Date.now();
    },
    get closing() {
      return existsSync(file + '.close.json');
    },
    hash(name) {
      const actual = realpathSync(resolve(repo, name));
      if (
        isAbsolute(relative(repo, actual)) ||
        relative(repo, actual).startsWith('..')
      )
        throw Error('QA_SOURCE_PATH_REFUSED');
      return createHash('sha256').update(readFileSync(actual)).digest('hex');
    },
  });
}

export function markBrowserClose() {
  const lease = readLease();
  writeFileSync(
    process.env.QA_BROWSER_LEASE + '.close.json',
    JSON.stringify({
      action: 'CLOSE_OWNED_BROWSER',
      nonce: lease.nonce,
      chromePid: lease.chromePid,
      creation: lease.creation,
      time: new Date().toISOString(),
    }),
    { flag: 'wx' },
  );
}
