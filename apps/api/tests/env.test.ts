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
      env: {
        ...environment,
        MONGODB_URI: 'mongodb://127.0.0.1:27017',
        MONGODB_DB_NAME: 'deeplearner-test',
        ...values,
      },
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

test('TLS validation preserves production and local security boundaries', () => {
  for (const APP_ENV of ['LOCAL', 'PRODUCTION']) {
    for (const [query, valid] of [
      ['tlsInsecure=false&tls=true', true],
      [
        'tlsAllowInvalidCertificates=false&tlsAllowInvalidHostnames=false',
        true,
      ],
      ['tlsInsecure=false&tlsInsecure=true', false],
      ['tlsInsecure=false&tlsAllowInvalidCertificates=true', false],
      ['tlsInsecure=false&tlsAllowInvalidHostnames=true', false],
      ['tlsInsecure=false&tls=false', false],
    ] as const) {
      const result = check({
        APP_ENV,
        CORS_ORIGINS: 'https://web.example',
        MONGODB_URI: `mongodb://127.0.0.1:27017/?${query}`,
      });
      assert.equal(result.status === 0, valid);
      if (!valid) assert.match(result.stderr, /Invalid API configuration/);
    }
  }
});

test('invalid configuration fails with field names, never configuration values', () => {
  for (const values of [
    { APP_ENV: 'SECRET_SENTINEL' },
    { PORT: 'SECRET_SENTINEL' },
    { LOG_LEVEL: 'SECRET_SENTINEL' },
    { MONGODB_URI: '' },
    { MONGODB_URI: undefined },
    { MONGODB_DB_NAME: undefined },
    { MONGODB_URI: 'SECRET_SENTINEL' },
    { MONGODB_URI: 'mongodb+srv://<user>:<password>@cluster.example' },
    { MONGODB_URI: 'mongodb://localhost/?tls=false' },
    { MONGODB_URI: 'mongodb://localhost/?ssl=false' },
    { MONGODB_URI: 'mongodb://localhost/?TLSAllowInvalidCertificates=true' },
    { MONGODB_URI: 'mongodb://localhost/?tlsAllowInvalidHostnames=true' },
    { MONGODB_URI: 'mongodb://localhost/?tlsInsecure=true' },
    { MONGODB_URI: 'mongodb://localhost/?tlsDisableOCSPEndpointCheck=true' },
    { MONGODB_DB_NAME: '' },
    { MONGODB_DB_NAME: 'admin' },
    { MONGODB_DB_NAME: 'LOCAL' },
    { MONGODB_DB_NAME: 'config' },
    { MONGODB_DB_NAME: 'x'.repeat(64) },
    { MONGODB_DB_NAME: 'SECRET_SENTINEL/name' },
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
