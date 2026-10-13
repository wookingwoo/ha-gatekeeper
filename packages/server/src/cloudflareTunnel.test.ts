import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { startCloudflareTunnel } from "./cloudflareTunnel.js";

async function waitFor(check: () => Promise<boolean>) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail("subprocess condition timed out");
}

async function fixture(exitOnce = false, ignoreTerm = false) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "hgk-cloudflared-fixture-"));
  const command = path.join(dir, "cloudflared");
  const record = path.join(dir, "record.json");
  await writeFile(command, `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const dir = path.dirname(process.argv[1]);
const record = path.join(dir, 'record.json');
const args = process.argv.slice(2);
const tokenFile = args[args.indexOf('--token-file') + 1];
const token = fs.readFileSync(tokenFile, 'utf8');
const previous = fs.existsSync(record) ? JSON.parse(fs.readFileSync(record, 'utf8')).starts : 0;
fs.writeFileSync(record, JSON.stringify({ args, tokenFile, token, mode: fs.statSync(tokenFile).mode & 0o777,
  starts: previous + 1, pid: process.pid, supervisor: process.env.SUPERVISOR_TOKEN,
  admin: process.env.ADMIN_PASSWORD, tunnelEnv: process.env.CLOUDFLARE_TUNNEL_TOKEN }));
process.stdout.write('fixture connected ' + token.slice(0, 5));
setTimeout(() => process.stdout.write(token.slice(5) + '\\n'), 5);
${exitOnce ? "if (!previous) setTimeout(() => process.exit(1), 15);" : ""}
${ignoreTerm ? "process.on('SIGTERM', () => {});" : ""}
setInterval(() => {}, 1000);
`, { mode: 0o700 });
  return { command, record, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test("cloudflared uses a private token file, redacts streamed logs and isolates application credentials", async () => {
  const fake = await fixture();
  const logs: string[] = [];
  const logger = { info: (line: string) => logs.push(line), error: (line: string) => logs.push(line) };
  const previous = process.env.SUPERVISOR_TOKEN;
  process.env.SUPERVISOR_TOKEN = "private-supervisor-fixture";
  const controller = await startCloudflareTunnel("private-tunnel-fixture", logger, { command: fake.command });
  let tokenFile: string | undefined;
  try {
    await waitFor(async () => logs.some((line) => line.includes("fixture connected")));
    const record = JSON.parse(await readFile(fake.record, "utf8"));
    tokenFile = record.tokenFile;
    assert.equal(record.token, "private-tunnel-fixture");
    assert.equal(record.mode, 0o600);
    assert.equal(record.supervisor, undefined);
    assert.equal(record.admin, undefined);
    assert.equal(record.tunnelEnv, undefined);
    assert.ok(!record.args.includes("private-tunnel-fixture"));
    assert.ok(!logs.join("\n").includes("private-tunnel-fixture"));
    assert.ok(logs.join("\n").includes("[REDACTED]"));
  } finally {
    if (previous === undefined) delete process.env.SUPERVISOR_TOKEN;
    else process.env.SUPERVISOR_TOKEN = previous;
    await controller.stop();
    await fake.cleanup();
  }
  await assert.rejects(readFile(tokenFile!), { code: "ENOENT" });
});

test("cloudflared restarts an exited process and stops without scheduling another restart", async () => {
  const fake = await fixture(true);
  const controller = await startCloudflareTunnel("restart-fixture", { info() {}, error() {} }, {
    command: fake.command, restartDelayMs: 20
  });
  try {
    await waitFor(async () => {
      try { return JSON.parse(await readFile(fake.record, "utf8")).starts === 2; }
      catch { return false; }
    });
    await controller.stop();
    const record = JSON.parse(await readFile(fake.record, "utf8"));
    assert.throws(() => process.kill(record.pid, 0), { code: "ESRCH" });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(JSON.parse(await readFile(fake.record, "utf8")).starts, 2);
    await controller.stop();
  } finally {
    await controller.stop();
    await fake.cleanup();
  }
});

test("shutdown force-kills a cloudflared process that ignores SIGTERM", async () => {
  const fake = await fixture(false, true);
  const controller = await startCloudflareTunnel("shutdown-fixture", { info() {}, error() {} }, {
    command: fake.command, shutdownTimeoutMs: 30
  });
  try {
    await waitFor(async () => {
      try { await readFile(fake.record); return true; } catch { return false; }
    });
    await controller.stop();
    const record = JSON.parse(await readFile(fake.record, "utf8"));
    assert.throws(() => process.kill(record.pid, 0), { code: "ESRCH" });
    await assert.rejects(readFile(record.tokenFile), { code: "ENOENT" });
  } finally {
    await controller.stop();
    await fake.cleanup();
  }
});

test("missing cloudflared is reported safely and pending retries can be cancelled", async () => {
  const logs: string[] = [];
  const controller = await startCloudflareTunnel("spawn-error-fixture", {
    info() {}, error: (line: string) => logs.push(line)
  }, { command: "/does-not-exist/cloudflared", restartDelayMs: 1000 });
  await waitFor(async () => logs.length > 0);
  await controller.stop();
  assert.ok(logs.join("\n").includes("ENOENT"));
  assert.ok(!logs.join("\n").includes("spawn-error-fixture"));
});
