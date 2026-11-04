import http from 'node:http';
import process from 'node:process';
import { log } from 'node:console';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import next from 'next';
import { preview } from 'vite';
import { classifyTarget } from './network-policy.mjs';

const counters = {
  deniedProxy: 0,
  apiFallthrough: 0,
  proxyProbes: 0,
  directProbes: 0,
};
const canary = http.createServer((request, response) => {
  if (request.url === '/qa/stats') {
    response.writeHead(200, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    });
    response.end(JSON.stringify(counters));
    return;
  }
  const classified = classifyTarget(request.url);
  if (classified.apiFallthrough)
    log(
      'QA_DENIED_API_KIND=' +
        (/\/favicon\.ico(?:\?|$)/.test(request.url ?? '')
          ? 'FAVICON'
          : 'OTHER'),
    );
  for (const key of Object.keys(counters)) counters[key] += classified[key];
  response.writeHead(503, {
    'content-type': 'text/plain',
    'cache-control': 'no-store',
  });
  response.end('QA_NETWORK_DENIED');
});
canary.on('connect', (request, socket) => {
  const classified = classifyTarget(request.url, true);
  for (const key of Object.keys(counters)) counters[key] += classified[key];
  socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
});
await new Promise((ok, fail) => {
  canary.once('error', fail);
  canary.listen(4101, '127.0.0.1', ok);
});
let app, web, admin;
if (process.env.QA_CANARY_ONLY !== '1') {
  app = next({
    dir: resolve('apps/web'),
    dev: false,
    hostname: '127.0.0.1',
    port: 3101,
  });
  await app.prepare();
  web = http.createServer(app.getRequestHandler());
  await new Promise((ok, fail) => {
    web.once('error', fail);
    web.listen(3101, '127.0.0.1', ok);
  });
  admin = await preview({
    root: resolve('apps/admin'),
    preview: { host: '127.0.0.1', port: 5181, strictPort: true },
  });
}
log('QA_SERVERS_READY');
let closing = false;
async function stop() {
  if (closing) return;
  closing = true;
  await Promise.all(
    [canary, web, admin?.httpServer].filter(Boolean).map(
      (server) =>
        new Promise((ok, fail) => {
          server.close((error) => (error ? fail(error) : ok()));
          server.closeIdleConnections();
        }),
    ),
  );
  await app?.close();
  process.stdin.destroy();
}
const input = createInterface({ input: process.stdin });
input.on('line', (line) => {
  if (line === 'STOP') {
    input.close();
    stop().catch(() => {
      process.exitCode = 1;
    });
  }
});
input.on('close', () => {
  if (!closing)
    stop().catch(() => {
      process.exitCode = 1;
    });
});
