import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

function check(values: NodeJS.ProcessEnv) {
  const environment = { ...process.env };
  for (const key of ['APP_ENV', 'PORT', 'CORS_ORIGINS', 'LOG_LEVEL'])
    delete environment[key];
  return spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--input-type=module',
      '-e',
      "await import('./src/config/env.ts')",
    ],
    {
      cwd: new URL('..', import.meta.url),
      env: { ...environment, ...values },
      encoding: 'utf8',
    },
  );
}

test('local defaults and explicit hosted HTTPS origins validate without future secrets', () => {
  for (const values of [
    {},
    {
      APP_ENV: 'DEVELOPMENT',
      CORS_ORIGINS: 'https://web.example,https://admin.example',
    },
    { APP_ENV: 'PRODUCTION', CORS_ORIGINS: 'https://web.example' },
  ]) {
    const result = check(values);
    assert.equal(result.status, 0, result.stderr);
  }
});

test('invalid configuration fails with field names, never configuration values', () => {
  for (const values of [
    { APP_ENV: 'SECRET_SENTINEL' },
    { PORT: 'SECRET_SENTINEL' },
    { LOG_LEVEL: 'SECRET_SENTINEL' },
    { CORS_ORIGINS: 'https://example.com/SECRET_SENTINEL' },
    { CORS_ORIGINS: '*' },
    { CORS_ORIGINS: 'SECRET_SENTINEL' },
    { CORS_ORIGINS: 'https://example.com/' },
    { APP_ENV: 'PRODUCTION' },
    { APP_ENV: 'DEVELOPMENT', CORS_ORIGINS: 'http://localhost:3000' },
  ]) {
    const result = check(values);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid API configuration/);
    assert(!result.stderr.includes('SECRET_SENTINEL'));
  }
});
