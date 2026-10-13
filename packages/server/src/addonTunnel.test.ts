import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { createTestDatabase } from "./testDb.js";

for (const mode of ["normal", "startup", "incomplete request"] as const) {
test(`Add-on shuts down its connector and token file during ${mode}`, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "hgk-addon-tunnel-"));
  const database = createTestDatabase();
  const recordFile = path.join(dir, "record.json");
  const startupMarker = path.join(dir, "startup");
  const tokenDirMarker = path.join(dir, "token-dir");
  const preload = path.join(dir, "delay.mjs");
  await writeFile(preload, `import fs from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const original = fs.mkdtemp;
fs.mkdtemp = async (...args) => {
  if (!String(args[0]).includes('hgk-cloudflared-')) return original(...args);
  writeFileSync(${JSON.stringify(startupMarker)}, 'starting');
  await new Promise(resolve => setTimeout(resolve, 500));
  const dir = await original(...args);
  writeFileSync(${JSON.stringify(tokenDirMarker)}, dir);
  return dir;
};
syncBuiltinESMExports();
`);
  await writeFile(path.join(dir, "cloudflared"), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.writeFileSync(${JSON.stringify(recordFile)}, JSON.stringify({ pid: process.pid, tokenFile: args[args.indexOf('--token-file') + 1] }));
setInterval(() => {}, 1000);
`, { mode: 0o700 });
  const probe = net.createServer();
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = (probe.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  const serverDir = fileURLToPath(new URL("..", import.meta.url));
  const args = ["--import", "tsx"];
  if (mode === "startup") args.push("--import", preload);
  args.push("src/index.ts");
  const server = spawn(process.execPath, args, {
    cwd: serverDir,
    env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}`,
      NODE_ENV: "test", PORT: String(port), DATABASE_URL: database.databaseUrl,
      HA_GATEKEEPER_ADDON: "true", ADDON_EXPOSE_API: "false", SUPERVISOR_TOKEN: "fake-supervisor-token",
      ADMIN_SESSION_SECRET: "12345678901234567890123456789012", API_KEY_HASH_SECRET: "12345678901234567890123456789012",
      CLOUDFLARE_TUNNEL_ENABLED: "true", CLOUDFLARE_TUNNEL_TOKEN: "fake-tunnel-token",
      CLOUDFLARE_PUBLIC_URL: "https://gatekeeper.example.com"
    }, stdio: "pipe"
  });
  let output = "";
  server.stdout.on("data", (chunk) => { output += chunk; });
  server.stderr.on("data", (chunk) => { output += chunk; });
  const exited = new Promise((resolve) => server.once("close", resolve));
  let record: { pid: number; tokenFile: string } | undefined;
  let pendingSocket: net.Socket | undefined;
  async function expectExitWithin(ms: number) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([exited, new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`shutdown exceeded ${ms}ms`)), ms);
      })]);
    } finally { clearTimeout(timer); }
  }
  try {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      if (mode === "startup") {
        try { await readFile(startupMarker); break; } catch {}
      }
      try { record = JSON.parse(await readFile(recordFile, "utf8")); break; } catch {}
      if (server.exitCode !== null) assert.fail(`server exited: ${output}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (mode === "startup") {
      await readFile(startupMarker);
      server.kill("SIGTERM");
      await expectExitWithin(2000);
      const tokenDir = await readFile(tokenDirMarker, "utf8");
      await assert.rejects(readFile(path.join(tokenDir, "token")), { code: "ENOENT" });
      return;
    }
    assert.ok(record, `cloudflared was not started: ${output}`);
    const tunnel = await fetch("http://127.0.0.1:8081/api/capabilities");
    assert.equal(tunnel.status, 401);
    assert.equal((await fetch("http://127.0.0.1:8081/admin/me")).status, 404);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/capabilities`)).status, 403);
    assert.equal((await fetch(`http://127.0.0.1:${port}/healthz`)).status, 200);
    if (mode === "incomplete request") {
      pendingSocket = net.createConnection(port, "127.0.0.1");
      await new Promise<void>((resolve) => pendingSocket!.once("connect", resolve));
      pendingSocket.write("POST /admin/login HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{");
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    server.kill("SIGTERM");
    await expectExitWithin(6500);
    assert.throws(() => process.kill(record!.pid, 0), { code: "ESRCH" });
    await assert.rejects(readFile(record.tokenFile), { code: "ENOENT" });
    assert.ok(!output.includes("fake-tunnel-token"));
  } finally {
    pendingSocket?.destroy();
    if (server.exitCode === null) server.kill("SIGTERM");
    const killTimer = setTimeout(() => server.kill("SIGKILL"), 1000);
    await exited;
    clearTimeout(killTimer);
    try { record ??= JSON.parse(await readFile(recordFile, "utf8")); } catch {}
    if (record) {
      try { process.kill(record.pid, "SIGKILL"); } catch {}
      await rm(path.dirname(record.tokenFile), { recursive: true, force: true });
    }
    database.cleanup();
    await rm(dir, { recursive: true, force: true });
  }
});
}
