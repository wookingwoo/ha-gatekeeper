import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import secureSession from "@fastify/secure-session";
import staticPlugin from "@fastify/static";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { closeHaConnections } from "./ha.js";
import { env, isProd } from "./env.js";
import { prisma } from "./db.js";
import { adminRoutes } from "./admin.js";
import { publicApiRoutes } from "./publicApi.js";
import { createTunnelApi, TUNNEL_API_PORT } from "./tunnelApi.js";
import { startCloudflareTunnel, type CloudflareTunnel } from "./cloudflareTunnel.js";

const app = Fastify({ logger: true });
let tunnelApi: ReturnType<typeof createTunnelApi> | undefined;
let tunnelProcess: CloudflareTunnel | undefined;

app.addHook("onClose", async () => {
  try {
    await tunnelProcess?.stop();
  } finally {
    await closeHaConnections();
    try {
      await tunnelApi?.close();
    } finally {
      await prisma.$disconnect();
    }
  }
});

await app.register(cors, {
  origin: env.CORS_ORIGIN,
  credentials: true
});

// HSTS is disabled: many self-hosted Home Assistant instances are reached over plain HTTP
// or self-signed TLS, and pinning the host to HTTPS-only for a year is a bad footgun for a
// LAN gateway. Every other helmet default (CSP, frame-ancestors, etc.) is safe as-is here.
await app.register(helmet, { hsts: false });

await app.register(cookie);

let sessionKey = Buffer.from(env.ADMIN_SESSION_SECRET, "base64");
if (sessionKey.length !== 32) {
  sessionKey = Buffer.from(env.ADMIN_SESSION_SECRET, "utf8");
}
if (sessionKey.length !== 32) {
  sessionKey = crypto.createHash("sha256").update(env.ADMIN_SESSION_SECRET).digest();
  app.log.warn("ADMIN_SESSION_SECRET was not 32 bytes; derived key via sha256");
}

await app.register(secureSession, {
  key: sessionKey,
  cookieName: "hgk_admin",
  cookie: {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProd
  }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.join(__dirname, "../../web/dist");

if (fs.existsSync(webDist)) {
  await app.register(staticPlugin, {
    root: webDist,
    prefix: "/"
  });
}

app.get("/healthz", async () => ({ ok: true }));

await app.register(publicApiRoutes, { prefix: "/api" });
await app.register(adminRoutes, { prefix: "/admin" });

app.setNotFoundHandler((request, reply) => {
  if (
    request.raw.url?.startsWith("/api/") ||
    request.raw.url?.startsWith("/v1/") ||
    request.raw.url?.startsWith("/admin/")
  ) {
    return reply.status(404).send({ ok: false, error: "not_found" });
  }

  if (fs.existsSync(webDist)) {
    return reply.sendFile("index.html");
  }

  return reply.status(404).send({ ok: false, error: "not_found" });
});

async function pruneAuditLogs() {
  if (env.AUDIT_LOG_RETENTION_DAYS <= 0) {
    return;
  }

  const cutoff = new Date(Date.now() - env.AUDIT_LOG_RETENTION_DAYS * 86_400_000);
  try {
    await prisma.auditLog.deleteMany({ where: { timestamp: { lt: cutoff } } });
  } catch (err) {
    app.log.error({ err }, "audit_log_prune_failed");
  }
}

const start = async () => {
  try {
    await pruneAuditLogs();
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    if (env.CLOUDFLARE_TUNNEL_ENABLED) {
      tunnelApi = createTunnelApi(publicApiRoutes, app.log);
      await tunnelApi.listen({ port: TUNNEL_API_PORT, host: "127.0.0.1" });
      tunnelProcess = await startCloudflareTunnel(env.CLOUDFLARE_TUNNEL_TOKEN, {
        info: (message) => app.log.info(message),
        error: (message) => app.log.error(message)
      });
    }
  } catch (err) {
    app.log.error(err);
    await closeHaConnections();
    await app.close();
    process.exit(1);
  }
};

let closing = false;
let startup: Promise<void> = Promise.resolve();
async function shutdown() {
  if (closing) return;
  closing = true;
  try {
    // Startup owns async token-file creation; finish assigning its resources
    // before teardown so no connector can appear after the close hooks ran.
    await startup;
    const drainTimer = setTimeout(() => {
      app.server.closeAllConnections();
      tunnelApi?.server.closeAllConnections();
    }, 5000);
    drainTimer.unref();
    try {
      // Stop public ingress before HTTP draining. An incomplete HTTP body must
      // not keep the connector alive or prevent its private token-file cleanup.
      try {
        await tunnelProcess?.stop();
      } finally {
        await closeHaConnections();
        await app.close();
      }
    } finally {
      clearTimeout(drainTimer);
    }
  } catch (err) {
    app.log.error(err, "shutdown_failed");
    process.exitCode = 1;
  }
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

startup = start();
