import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import { authenticate } from '../src/middleware/authenticate.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { AppError } from '../src/common/errors/app-error.js';
test('Bearer middleware rejects missing and invalid tokens and attaches validated typed claims', async () => {
  const tokens = createAccessTokens({
    ACCESS_TOKEN_SECRET: Buffer.alloc(32, 7).toString('base64'),
    ACCESS_TOKEN_ISSUER: 'test',
    ACCESS_TOKEN_AUDIENCE: 'test',
  });
  const context = {
    sub: 'a'.repeat(24),
    sid: 'b'.repeat(24),
    role: 'ADMIN' as const,
    plan: 'PREMIUM' as const,
  };
  const app = express();
  app.get('/', authenticate(tokens), (req, res) => res.json(req.auth));
  app.use(((error: AppError, _req, res, next) => {
    void next;
    res.status(error.statusCode).json({ code: error.code });
  }) satisfies express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(url)).status, 401);
    for (const authorization of ['Basic test', 'Bearer bad', 'Bearer a.b.c'])
      assert.equal(
        (await fetch(url, { headers: { authorization } })).status,
        401,
      );
    assert.deepEqual(
      await (
        await fetch(url, {
          headers: { authorization: `Bearer ${await tokens.sign(context)}` },
        })
      ).json(),
      context,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
