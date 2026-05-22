import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import cookie from "@fastify/cookie";
import secureSession from "@fastify/secure-session";
import Fastify from "fastify";

test("addon admin login rejects non-ingress requests before accepting the sentinel password", async () => {
  process.env.NODE_ENV = "test";
  process.env.HA_GATEKEEPER_ADDON = "true";
  process.env.ADDON_EXPOSE_API = "true";
  process.env.SUPERVISOR_TOKEN = "supervisor-token";
  process.env.ADMIN_SESSION_SECRET = "12345678901234567890123456789012";
  process.env.API_KEY_HASH_SECRET = "12345678901234567890123456789012";

  const { adminRoutes } = await import("./admin.js");
  const app = Fastify({ logger: false });
  const sessionKey = crypto.createHash("sha256").update(process.env.ADMIN_SESSION_SECRET).digest();

  await app.register(cookie);
  await app.register(secureSession, {
    key: sessionKey,
    cookieName: "hgk_admin",
    cookie: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false
    }
  });
  await app.register(adminRoutes, { prefix: "/admin" });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/admin/login",
      remoteAddress: "192.0.2.10",
      payload: { password: "addon-ingress-authenticated" }
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), { ok: false, error: "unauthorized" });
    assert.equal(response.headers["set-cookie"], undefined);
  } finally {
    await app.close();
  }
});
