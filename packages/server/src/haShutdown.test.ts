import assert from "node:assert/strict";
import { test } from "node:test";
import http from 'node:http';
import { spawn } from 'node:child_process';
import type { AddressInfo, Socket } from "node:net";
import { fileURLToPath } from "node:url";
import { once } from 'node:events';

test("index exits and closes hung HA socket within bounded shutdown", async () => {
  const haSockets = new Set<Socket>();
  let received = false;
  const ha = http.createServer((_request, _response) => { received = true; });
  ha.on('connection', (socket) => {
    haSockets.add(socket);
    socket.on('close', () => haSockets.delete(socket));
  });
  ha.listen(0, '127.0.0.1');
  await once(ha, 'listening');
  const probe = http.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = (probe.address() as AddressInfo).port;
  await new Promise((resolve) => probe.close(resolve));

  Object.assign(process.env, {
    NODE_ENV: 'test', HA_GATEKEEPER_ADDON: 'false', PORT: String(port),
    HA_BASE_URL: `http://127.0.0.1:${(ha.address() as AddressInfo).port}`,
    HA_TOKEN: 'fixture-ha-token', ADMIN_PASSWORD: 'fixture-admin-password',
    ADMIN_SESSION_SECRET: '12345678901234567890123456789012',
    API_KEY_HASH_SECRET: '12345678901234567890123456789012',
    CLOUDFLARE_TUNNEL_ENABLED: 'false'
  });
  const { createTestDatabase } = await import("./testDb.js");
  const db = createTestDatabase();
  process.env.DATABASE_URL = db.databaseUrl;
  const { prisma } = await import("./db.js");
  const { createTokenAccess } = await import("./tokenAccess.js");
  const { apiKey } = await createTokenAccess(prisma, {
    name: 'shutdown-probe', permissions: [{ kind: 'state', entityIds: ['sensor.test'] }]
  });
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: fileURLToPath(new URL("..", import.meta.url)), env: { ...process.env }, stdio: 'ignore'
  });
  let closed = false;
  child.once('close', () => { closed = true; });
  let request: http.ClientRequest | undefined;
  try {
    const startDeadline = Date.now() + 5000;
    let ready = false;
    while (Date.now() < startDeadline) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/healthz`);
        if (response.ok) { ready = true; break; }
      } catch {}
      if (closed) throw new Error('child exited before ready');
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    if (!ready) throw new Error('child failed to start within five seconds');
    request = http.get(`http://127.0.0.1:${port}/api/states/sensor.test`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    request.on('error', () => {});
    const haDeadline = Date.now() + 2000;
    while (!received && Date.now() < haDeadline) await new Promise((resolve) => setTimeout(resolve, 20));
    if (!received) throw new Error('upstream request was not received');

    child.kill('SIGTERM');
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([once(child, 'close'), new Promise((_, reject) => { exitTimer = setTimeout(() => reject(new Error('shutdown exceeded 6500ms')), 6500); })]); } finally { clearTimeout(exitTimer); }
    assert.equal(haSockets.size, 0);

    assert.equal(child.exitCode, 0);
  } finally {
    request?.destroy();
    if (!closed) child.kill('SIGKILL');
    if (!closed) await once(child, 'close');
    for (const socket of haSockets) socket.destroy();
    await new Promise((resolve) => ha.close(resolve));
    await prisma.$disconnect();
    db.cleanup();
  }

});
