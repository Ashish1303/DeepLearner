import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dashboardDestination,
  loginDestination,
} from '../src/lib/auth/redirect';
test('return destinations are closed to external URLs and unimplemented routes', () => {
  for (const value of [
    null,
    undefined,
    '/dashboard',
    '/signup',
    '/admin',
    '//evil.example',
    'https://evil.example',
    'javascript:alert(1)',
    '/dashboard?token=secret',
    '/%2f%2fevil',
    '\\evil.example',
    '/dashboard#secret',
  ])
    assert.equal(dashboardDestination(value), '/dashboard');
  assert.equal(loginDestination, '/login?next=/dashboard');
});
