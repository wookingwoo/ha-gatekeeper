import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { test } from "node:test";

test("HA deadlines cover headers and bodies and close cancels sockets without retries", async () => {
  const sockets = new Set<import("node:net").Socket>();
  let mode = "normal";
  let calls = 0;
  let captured: unknown;
  let requestReceived: (() => void) | undefined;

  const upstream = http.createServer(async (req, res) => {
    calls++;
    let body = "";
    for await (const chunk of req) body += chunk;
    captured = { url: req.url, auth: req.headers.authorization, body };
    requestReceived?.();

    if (mode === "headers" || mode === "shutdown") return;
    res.writeHead(200, { "Content-Type": "application/json" });
    if (mode === "body") {
      res.write("[");
      return;
    }
    res.end(req.url === "/api/services"
      ? '[{"domain":"light","services":{"turn_on":{}}}]'
      : req.url === "/api/states"
        ? '[{"entity_id":"sensor.test"}]'
        : '{"ok":true}');
  });
  upstream.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");

  Object.assign(process.env, {
    NODE_ENV: "test",
    HA_GATEKEEPER_ADDON: "false",
    HA_BASE_URL: `http://127.0.0.1:${(upstream.address() as import("node:net").AddressInfo).port}`,
    HA_TOKEN: "fixture-token",
    HA_REQUEST_TIMEOUT_MS: "5000",
    ADMIN_PASSWORD: "test-password",
    ADMIN_SESSION_SECRET: "session-secret",
    API_KEY_HASH_SECRET: "api-key-hash-secret",
    CLOUDFLARE_TUNNEL_ENABLED: "false"
  });
  const { env } = await import("./env.js");
  const ha = await import("./ha.js");

  async function bounded<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("test watchdog expired")), 5000);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    assert.equal((await ha.proxyHaServiceCall("light", "turn_on", { entity_id: "light.test" }, "?return_response=true")).body, '{"ok":true}');
    assert.deepEqual(captured, {
      url: "/api/services/light/turn_on?return_response=true",
      auth: "Bearer fixture-token",
      body: '{"entity_id":"light.test"}'
    });
    assert.deepEqual(await ha.fetchHaServices(), [{ domain: "light", services: ["turn_on"] }]);
    assert.deepEqual(await ha.fetchHaEntities(), [{ entityId: "sensor.test", domain: "sensor", name: "sensor.test" }]);

    env.HA_REQUEST_TIMEOUT_MS = 1000;
    for (const stalled of ["headers", "body"]) {
      mode = stalled;
      for (const call of [
        () => ha.proxyHaServiceCall("light", "turn_on", {}),
        () => ha.proxyHaState("sensor.test"),
        () => ha.fetchHaServices(),
        () => ha.fetchHaEntities()
      ]) {
        const before = calls;
        const start = Date.now();
        await assert.rejects(bounded<unknown>(call()), { message: "ha_request_timeout" });
        assert.ok(Date.now() - start >= 900, "request rejected before its HA deadline");
        assert.equal(calls, before + 1);
      }
    }

    env.HA_REQUEST_TIMEOUT_MS = 30000;
    mode = "shutdown";
    const received = new Promise<void>((resolve) => { requestReceived = resolve; });
    const pending = assert.rejects(ha.proxyHaState("sensor.test"), { message: "ha_shutdown" });
    await bounded(received);
    requestReceived = undefined;

    const socketCloses = [...sockets].map((socket) => once(socket, "close"));
    const close = ha.closeHaConnections();
    assert.strictEqual(ha.closeHaConnections(), close);
    await bounded(Promise.all([close, pending, ...socketCloses]));
    assert.equal(sockets.size, 0);

    const before = calls;
    await assert.rejects(ha.proxyHaState("sensor.test"), { message: "ha_shutdown" });
    assert.equal(calls, before);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
});
