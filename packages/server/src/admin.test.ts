import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, test } from "node:test";
import cookie from "@fastify/cookie";
import secureSession from "@fastify/secure-session";
import Fastify from "fastify";
import { createTestDatabase } from "./testDb.js";

process.env.NODE_ENV = "test";
process.env.HA_BASE_URL = "http://127.0.0.1:1";
process.env.HA_TOKEN = "fake-ha-token";
process.env.ADMIN_PASSWORD = "correct-horse-battery-staple";
process.env.ADMIN_SESSION_SECRET = "12345678901234567890123456789012";
process.env.API_KEY_HASH_SECRET = "12345678901234567890123456789012";

const testDb = createTestDatabase();
process.env.DATABASE_URL = testDb.databaseUrl;

const { prisma } = await import("./db.js");
const { adminRoutes } = await import("./admin.js");

const app = Fastify({ logger: false });
const sessionKey = crypto.createHash("sha256").update(process.env.ADMIN_SESSION_SECRET).digest();

await app.register(cookie);
await app.register(secureSession, {
  key: sessionKey,
  cookieName: "hgk_admin",
  cookie: { path: "/", httpOnly: true, sameSite: "lax", secure: false }
});
await app.register(adminRoutes, { prefix: "/admin" });

after(async () => {
  await app.close();
  await prisma.$disconnect();
  testDb.cleanup();
});

function sessionCookieFrom(response: {
  headers: Record<string, string | string[] | number | undefined>;
}): string {
  const setCookie = response.headers["set-cookie"];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (typeof raw !== "string") {
    throw new Error("expected a set-cookie header on the login response");
  }
  return raw.split(";")[0];
}

test("a successful login writes an admin.login audit row", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/admin/login",
    payload: { password: process.env.ADMIN_PASSWORD }
  });

  assert.equal(response.statusCode, 200);

  const logs = await prisma.auditLog.findMany({
    where: { actionIdRaw: "admin.login", success: true },
    orderBy: { timestamp: "desc" },
    take: 1
  });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].clientId, null);
  assert.equal(logs[0].error, null);
});

test("a failed login writes an admin.login audit row with the failure reason", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/admin/login",
    payload: { password: "definitely-wrong" }
  });

  assert.equal(response.statusCode, 401);

  const logs = await prisma.auditLog.findMany({
    where: { actionIdRaw: "admin.login", success: false },
    orderBy: { timestamp: "desc" },
    take: 1
  });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].error, "invalid_credentials");
});

test("deleting a client writes an admin.client.delete audit row without violating the client foreign key", async () => {
  const loginResponse = await app.inject({
    method: "POST",
    url: "/admin/login",
    payload: { password: process.env.ADMIN_PASSWORD }
  });
  const sessionCookie = sessionCookieFrom(loginResponse);

  const createResponse = await app.inject({
    method: "POST",
    url: "/admin/clients",
    headers: { cookie: sessionCookie },
    payload: {
      name: "Delete Me",
      permissions: [{ kind: "state", entityIds: ["sensor.temperature"] }]
    }
  });
  assert.equal(createResponse.statusCode, 200);
  const clientId = createResponse.json().client.id as string;

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/admin/clients/${clientId}`,
    headers: { cookie: sessionCookie }
  });
  assert.equal(deleteResponse.statusCode, 200);

  const logs = await prisma.auditLog.findMany({
    where: { actionIdRaw: "admin.client.delete" },
    orderBy: { timestamp: "desc" },
    take: 1
  });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].clientId, null, "clientId must be null since the client row no longer exists");
  assert.equal(logs[0].success, true);
  assert.equal(logs[0].error, `deleted_client:${clientId}`);
});
