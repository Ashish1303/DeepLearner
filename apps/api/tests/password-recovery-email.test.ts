import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRecoveryEmailService } from '../src/common/email/email.service.js';
import {
  passwordResetEmail,
  passwordResetConfirmation,
} from '../src/common/email/password-recovery-email.js';
const config = {
  EMAIL_PROVIDER: 'resend' as const,
  EMAIL_FROM: 'verify@example.com',
  RESEND_API_KEY: 'synthetic-key',
  WEB_ORIGIN: 'https://web.example',
};
const input = {
  to: 'synthetic@example.com',
  firstName: '<Test>',
  rawToken: 'a'.repeat(43),
  tokenId: 'synthetic-id',
};
test('recovery email escapes markup, uses a fragment and confirmation includes no token', () => {
  const email = passwordResetEmail(
    input.firstName,
    config.WEB_ORIGIN,
    input.rawToken,
  );
  assert(email.html.includes('&lt;Test&gt;'));
  assert(!email.html.includes('<Test>'));
  assert(email.text.includes('/reset-password#token='));
  assert(email.text.includes('30 minutes'));
  assert(
    !JSON.stringify(passwordResetConfirmation(input.firstName)).includes(
      input.rawToken,
    ),
  );
});
test('fake transport uses bounded retries and distinct stable idempotency keys without reading provider data', async () => {
  const calls: RequestInit[] = [];
  const service = createRecoveryEmailService(config, async (_url, init) => {
    assert(init);
    calls.push(init);
    return new Response(null, { status: calls.length === 1 ? 503 : 200 });
  });
  assert.equal(await service.sendReset(input), 'ACCEPTED');
  assert.equal(calls.length, 2);
  assert.equal(calls[0]!.body, calls[1]!.body);
  assert.deepEqual(calls[0]!.headers, calls[1]!.headers);
  await service.sendResetConfirmation(input);
  assert.notDeepEqual(calls[1]!.headers, calls[2]!.headers);
  assert(!String(calls[2]!.body).includes(input.rawToken));
  for (const mode of ['disabled', 'permanent', 'timeout'] as const) {
    let count = 0;
    const fake = createRecoveryEmailService(
      {
        ...config,
        EMAIL_PROVIDER: mode === 'disabled' ? 'disabled' : 'resend',
      },
      async () => {
        count++;
        if (mode === 'timeout') throw new Error('PRIVATE_PROVIDER');
        return new Response(null, { status: 400 });
      },
    );
    assert.equal(await fake.sendReset(input), 'NOT_CONFIRMED');
    assert.equal(count, mode === 'disabled' ? 0 : mode === 'timeout' ? 2 : 1);
  }
});
