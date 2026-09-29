import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEmailService } from '../src/common/email/email.service.js';
import { verificationEmail } from '../src/common/email/verification-email.js';

const config = {
  EMAIL_PROVIDER: 'resend' as const,
  EMAIL_FROM: 'verify@example.com',
  RESEND_API_KEY: 'synthetic-key',
  WEB_ORIGIN: 'https://web.example',
};
const input = {
  to: 'synthetic@example.com',
  firstName: '<Ada>',
  rawToken: 'a'.repeat(43),
  tokenId: 'synthetic-id',
};
test('verification template escapes HTML and uses fragment token and fifteen-minute explanation', () => {
  const output = verificationEmail(
    input.firstName,
    config.WEB_ORIGIN,
    input.rawToken,
  );
  assert(output.html.includes('&lt;Ada&gt;'));
  assert(!output.html.includes('<Ada>'));
  assert(output.text.includes('/verify-email#token='));
  assert(output.text.includes('15 minutes'));
});
test('disabled delivery never invokes transport or claims acceptance', async () => {
  const service = createEmailService(
    { ...config, EMAIL_PROVIDER: 'disabled' },
    async () => {
      assert.fail('Unexpected email request');
    },
  );
  assert.equal(await service.sendVerification(input), 'NOT_CONFIRMED');
});
test('provider acceptance, transient retry and permanent failure use bounded fake transport', async () => {
  const calls: RequestInit[] = [];
  const service = createEmailService(config, async (_url, init) => {
    assert.ok(init);
    calls.push(init);
    return new Response(null, { status: calls.length === 1 ? 503 : 200 });
  });
  assert.equal(await service.sendVerification(input), 'ACCEPTED');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0]?.headers, calls[1]?.headers);
  assert.equal(calls[0]?.body, calls[1]?.body);
  let count = 0;
  const permanent = createEmailService(config, async () => {
    count++;
    return new Response(null, { status: 403 });
  });
  assert.equal(await permanent.sendVerification(input), 'NOT_CONFIRMED');
  assert.equal(count, 1);
});
test('ambiguous network errors are swallowed and retry at most once', async () => {
  let count = 0;
  const service = createEmailService(config, async () => {
    count++;
    throw new Error('SECRET_SENTINEL');
  });
  assert.equal(await service.sendVerification(input), 'NOT_CONFIRMED');
  assert.equal(count, 2);
});
