import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

function check(values: NodeJS.ProcessEnv) {
  const environment = { ...process.env };
  for (const key of [
    'APP_ENV',
    'PORT',
    'CORS_ORIGINS',
    'LOG_LEVEL',
    'EMAIL_PROVIDER',
    'EMAIL_FROM',
    'RESEND_API_KEY',
    'WEB_ORIGIN',
    ...Object.keys(environment).filter((key) => key.startsWith('AUTH_')),
  ])
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
        ACCESS_TOKEN_SECRET: Buffer.from(
          Array.from({ length: 32 }, (_, i) => i + 1),
        ).toString('base64'),
        ACCESS_TOKEN_ISSUER: 'test-api',
        ACCESS_TOKEN_AUDIENCE: 'test-client',
        MONGODB_URI: 'mongodb://127.0.0.1:27017',
        MONGODB_DB_NAME: 'deeplearner-test',
        MONGODB_TLS: 'true',
        ...(values.APP_ENV === 'PRODUCTION' || values.APP_ENV === 'DEVELOPMENT'
          ? {
              EMAIL_PROVIDER: 'resend',
              EMAIL_FROM: 'verify@example.com',
              RESEND_API_KEY: 'test-only-key',
              WEB_ORIGIN: 'https://web.example',
            }
          : {}),
        ...values,
      },
      encoding: 'utf8',
    },
  );
}

test('local defaults and hosted HTTPS origins validate with required signing configuration', () => {
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

test('plaintext requires explicit LOCAL opt-in and literal loopback', () => {
  for (const [APP_ENV, MONGODB_URI, valid] of [
    ['LOCAL', 'mongodb://127.0.0.1:27017/?tls=false', true],
    ['LOCAL', 'mongodb://localhost:27017/', false],
    ['LOCAL', 'mongodb://127.0.0.1,remote.example/', false],
    ['LOCAL', 'mongodb+srv://cluster.example/', false],
    ['DEVELOPMENT', 'mongodb://127.0.0.1/', false],
    ['PRODUCTION', 'mongodb://127.0.0.1/', false],
  ] as const) {
    const result = check({
      APP_ENV,
      MONGODB_URI,
      MONGODB_TLS: 'false',
      CORS_ORIGINS: 'https://web.example',
    });
    assert.equal(result.status === 0, valid);
  }
  assert.notEqual(check({ MONGODB_TLS: 'invalid' }).status, 0);
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

test('F007 email and limiter configuration is validated without exposing values', () => {
  for (const values of [
    {
      APP_ENV: 'PRODUCTION',
      CORS_ORIGINS: 'https://web.example',
      EMAIL_PROVIDER: 'disabled',
    },
    { EMAIL_PROVIDER: 'resend' },
    {
      EMAIL_PROVIDER: 'resend',
      EMAIL_FROM: 'verify@example.com',
      RESEND_API_KEY: '',
    },
    { EMAIL_FROM: 'SECRET_SENTINEL' },
    { WEB_ORIGIN: 'SECRET_SENTINEL' },
    { WEB_ORIGIN: 'http://remote.example' },
    { WEB_ORIGIN: 'https://example.com/path' },
    { AUTH_REGISTER_LIMIT: '0' },
    { AUTH_VERIFY_WINDOW_MS: '-1' },
    { AUTH_RESEND_LIMIT: '1.5' },
  ]) {
    const result = check(values);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid API configuration/);
    assert(!result.stderr.includes('SECRET_SENTINEL'));
  }
});

test('F008 signing configuration and insecure-cookie exception fail closed', () => {
  for (const values of [
    { ACCESS_TOKEN_SECRET: '' },
    { ACCESS_TOKEN_SECRET: Buffer.alloc(32).toString('base64') },
    { ACCESS_TOKEN_ISSUER: '' },
    { ACCESS_TOKEN_AUDIENCE: '' },
    { APP_ENV: 'PRODUCTION', AUTH_COOKIE_SECURE: 'false' },
    {
      APP_ENV: 'LOCAL',
      AUTH_COOKIE_SECURE: 'false',
      CORS_ORIGINS: 'https://example.com',
    },
  ])
    assert.notEqual(check(values).status, 0);
  assert.equal(
    check({ APP_ENV: 'LOCAL', AUTH_COOKIE_SECURE: 'false' }).status,
    0,
  );
});

test('malformed CORS origins use sanitized configuration errors with local cookies', () => {
  const sentinel = 'F008_MALFORMED_ORIGIN_SENTINEL_9f3b7c';
  for (const AUTH_COOKIE_SECURE of ['false', 'true']) {
    const result = check({
      APP_ENV: 'LOCAL',
      AUTH_COOKIE_SECURE,
      CORS_ORIGINS: `http://127.0.0.1:3000,http://[${sentinel}`,
    });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /Error: Invalid API configuration: CORS_ORIGINS\.1(?:, AUTH_COOKIE_SECURE)?/,
    );
    const output = result.stdout + result.stderr;
    assert(!output.includes(sentinel));
    assert(!output.includes('http://['));
    assert.doesNotMatch(output, /ERR_INVALID_URL|TypeError: Invalid URL/);
  }
});

test('F010 recovery budgets accept bounded configuration and sanitize invalid field values', () => {
  assert.equal(
    check({
      AUTH_FORGOT_LIMIT: '3',
      AUTH_RESET_LIMIT: '10',
      AUTH_CHANGE_LIMIT: '5',
      AUTH_CHANGE_IP_LIMIT: '20',
    }).status,
    0,
  );
  const result = check({
    AUTH_FORGOT_LIMIT: '0',
    AUTH_RESET_WINDOW_MS: '999',
    AUTH_CHANGE_LIMIT: '1001',
    AUTH_CHANGE_IP_WINDOW_MS: 'PRIVATE_SENTINEL',
  });
  assert.notEqual(result.status, 0);
  for (const field of [
    'AUTH_FORGOT_LIMIT',
    'AUTH_RESET_WINDOW_MS',
    'AUTH_CHANGE_LIMIT',
    'AUTH_CHANGE_IP_WINDOW_MS',
  ])
    assert(result.stderr.includes(field));
  assert(!result.stderr.includes('PRIVATE_SENTINEL'));
});
