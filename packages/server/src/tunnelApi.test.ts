import assert from "node:assert/strict";
import { after, test } from "node:test";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import secureSession from "@fastify/secure-session";
import { createTestDatabase } from "./testDb.js";

process.env.NODE_ENV = "test";
process.env.HA_GATEKEEPER_ADDON = "true";
process.env.ADDON_EXPOSE_API = "false";
process.env.SUPERVISOR_TOKEN = "supervisor-test-token";
process.env.ADMIN_SESSION_SECRET = "12345678901234567890123456789012";
process.env.API_KEY_HASH_SECRET = "12345678901234567890123456789012";
process.env.CLOUDFLARE_TUNNEL_ENABLED = "true";
process.env.CLOUDFLARE_TUNNEL_TOKEN = "private-tunnel-fixture";
process.env.CLOUDFLARE_PUBLIC_URL = "https://gatekeeper.example.com";

const testDb = createTestDatabase();
process.env.DATABASE_URL = testDb.databaseUrl;
const { prisma } = await import("./db.js");
const { createTokenAccess } = await import("./tokenAccess.js");
const { publicApiRoutes } = await import("./publicApi.js");
const { createTunnelApi } = await import("./tunnelApi.js");
const { adminRoutes } = await import("./admin.js");

const tunnel = createTunnelApi(publicApiRoutes);
const lan = Fastify({ logger: false });
await lan.register(publicApiRoutes, { prefix: "/api" });
const admin = Fastify({ logger: false });
await admin.register(cookie);
await admin.register(secureSession, { key: Buffer.alloc(32, 1) });
await admin.register(adminRoutes, { prefix: "/admin" });
const { apiKey } = await createTokenAccess(prisma, {
  name: "Remote agent",
  permissions: [{ kind: "state", entityIds: ["sensor.temperature"] }]
});
const disabled = await createTokenAccess(prisma, {
  name: "Disabled remote agent",
  status: "disabled",
  permissions: [{ kind: "state", entityIds: ["sensor.temperature"] }]
});
const headers = { authorization: `Bearer ${apiKey}` };

after(async () => {
  await tunnel.close();
  await lan.close();
  await admin.close();
  await prisma.$disconnect();
  testDb.cleanup();
});

test("tunnel allows authenticated capabilities while the LAN API remains disabled", async () => {
  const response = await tunnel.inject({ url: "/api/capabilities", headers });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().capabilities.stateReads, ["sensor.temperature"]);
  const local = await lan.inject({ url: "/api/capabilities", headers });
  assert.equal(local.statusCode, 403);
  assert.equal(local.json().error, "api_not_exposed");
});

test("tunnel rejects missing, invalid, and disabled bearer tokens", async () => {
  for (const token of [undefined, "invalid-key", disabled.apiKey]) {
    const response = await tunnel.inject({
      url: "/api/capabilities",
      headers: token ? { authorization: `Bearer ${token}` } : {}
    });
    assert.equal(response.statusCode, token === disabled.apiKey ? 403 : 401);
  }
});

test("tunnel enforces entity and service permissions before contacting Home Assistant", async () => {
  const state = await tunnel.inject({ url: "/api/states/sensor.private", headers });
  assert.equal(state.statusCode, 403);
  assert.equal(state.json().error, "entity_not_allowed");
  const service = await tunnel.inject({
    method: "POST", url: "/api/services/light/turn_on", headers,
    payload: { entity_id: "light.living_room" }
  });
  assert.equal(service.statusCode, 403);
  assert.equal(service.json().error, "forbidden");
});

test("tunnel never exposes admin, static assets, documentation, or unknown paths", async () => {
  for (const url of ["/", "/admin/me", "/admin/login", "/assets/app.js", "/healthz", "/api/documentation", "/api/documentation/json", "/api/unknown", "/api/capabilities/extra"]) {
    const response = await tunnel.inject({ url, headers });
    assert.equal(response.statusCode, 404, url);
    assert.equal(response.json().error, "not_found", url);
  }
});

test("tunnel rejects wrong methods even with valid credentials", async () => {
  for (const [method, url] of [["POST", "/api/capabilities"], ["DELETE", "/api/states/sensor.temperature"], ["GET", "/api/services/light/turn_on"], ["HEAD", "/api/capabilities"]] as const) {
    const response = await tunnel.inject({ method, url, headers });
    assert.equal(response.statusCode, 404, `${method} ${url}`);
  }
});

test("only authenticated administrators receive the public URL, never tunnel credentials", async () => {
  const outside = await admin.inject({ url: "/admin/me" });
  assert.equal(outside.json().publicApiBaseUrl, null);
  const ingress = await admin.inject({ url: "/admin/me", remoteAddress: "172.30.32.2", headers: { "x-ingress-path": "/api/hassio_ingress/fixture" } });
  assert.equal(ingress.json().publicApiBaseUrl, "https://gatekeeper.example.com");
  assert.ok(!ingress.body.includes("private-tunnel-fixture"));
  assert.ok(!ingress.body.includes("supervisor-test-token"));
});
