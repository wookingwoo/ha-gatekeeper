import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import secureSession from "@fastify/secure-session";
import staticPlugin from "@fastify/static";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { env, isProd } from "./env.js";
import { prisma } from "./db.js";
import { callHaServices } from "./ha.js";
import {
  haCallsSchema
} from "./schemas.js";
import {
  getApiKeyPrefix,
  hashApiKey,
  timingSafeEqual
} from "./security.js";
import { adminRoutes } from "./admin.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: env.CORS_ORIGIN,
  credentials: true
});

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

async function logAudit(params: {
  clientId: string | null;
  actionId: string | null;
  actionIdRaw: string;
  ip: string | null;
  success: boolean;
  error?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        clientId: params.clientId,
        actionId: params.actionId,
        actionIdRaw: params.actionIdRaw,
        ip: params.ip,
        success: params.success,
        error: params.error ?? null
      }
    });
  } catch (err) {
    app.log.error({ err }, "audit_log_failed");
  }
}

app.post("/v1/actions/:actionId", async (request, reply) => {
  const actionIdRaw = (request.params as { actionId: string }).actionId;
  const ip = request.ip ?? null;

  const apiKeyHeader = request.headers["x-api-key"];
  const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;

  if (!apiKey) {
    await logAudit({
      clientId: null,
      actionId: null,
      actionIdRaw,
      ip,
      success: false,
      error: "missing_api_key"
    });
    return reply.status(401).send({ ok: false, error: "missing_api_key" });
  }

  const prefix = getApiKeyPrefix(apiKey);
  const client = await prisma.client.findFirst({
    where: { apiKeyPrefix: prefix },
    include: { role: true }
  });

  if (!client) {
    await logAudit({
      clientId: null,
      actionId: null,
      actionIdRaw,
      ip,
      success: false,
      error: "invalid_api_key"
    });
    return reply.status(401).send({ ok: false, error: "invalid_api_key" });
  }

  const computedHash = hashApiKey(apiKey);
  if (!timingSafeEqual(computedHash, client.apiKeyHash)) {
    await logAudit({
      clientId: client.id,
      actionId: null,
      actionIdRaw,
      ip,
      success: false,
      error: "invalid_api_key"
    });
    return reply.status(401).send({ ok: false, error: "invalid_api_key" });
  }

  if (client.status !== "active") {
    await logAudit({
      clientId: client.id,
      actionId: null,
      actionIdRaw,
      ip,
      success: false,
      error: "client_disabled"
    });
    return reply.status(403).send({ ok: false, error: "client_disabled" });
  }

  const action = await prisma.action.findUnique({
    where: { id: actionIdRaw },
    include: { roleActions: true }
  });

  if (!action) {
    await logAudit({
      clientId: client.id,
      actionId: null,
      actionIdRaw,
      ip,
      success: false,
      error: "action_not_found"
    });
    return reply.status(404).send({ ok: false, error: "action_not_found" });
  }

  if (action.status !== "active") {
    await logAudit({
      clientId: client.id,
      actionId: action.id,
      actionIdRaw,
      ip,
      success: false,
      error: "action_disabled"
    });
    return reply.status(403).send({ ok: false, error: "action_disabled" });
  }

  const allowed = await prisma.roleAction.findUnique({
    where: {
      roleId_actionId: {
        roleId: client.roleId,
        actionId: action.id
      }
    }
  });

  if (!allowed) {
    await logAudit({
      clientId: client.id,
      actionId: action.id,
      actionIdRaw,
      ip,
      success: false,
      error: "forbidden"
    });
    return reply.status(403).send({ ok: false, error: "forbidden" });
  }

  try {
    const haCalls = haCallsSchema.parse(JSON.parse(action.haCalls));
    const results = await callHaServices(haCalls);

    await logAudit({
      clientId: client.id,
      actionId: action.id,
      actionIdRaw,
      ip,
      success: true
    });

    return reply.send({
      ok: true,
      actionId: action.id,
      calls: results.map((r) => ({
        domain: r.domain,
        service: r.service,
        ok: r.ok
      }))
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await logAudit({
      clientId: client.id,
      actionId: action.id,
      actionIdRaw,
      ip,
      success: false,
      error: message
    });

    request.log.error({ err }, "action_failed");
    return reply.status(500).send({ ok: false, error: "action_failed" });
  }
});

await app.register(adminRoutes, { prefix: "/admin" });

app.setNotFoundHandler((request, reply) => {
  if (request.raw.url?.startsWith("/v1/") || request.raw.url?.startsWith("/admin/")) {
    return reply.status(404).send({ ok: false, error: "not_found" });
  }

  if (fs.existsSync(webDist)) {
    return reply.sendFile("index.html");
  }

  return reply.status(404).send({ ok: false, error: "not_found" });
});

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
