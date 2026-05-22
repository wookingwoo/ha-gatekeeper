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
import { proxyHaServiceCall, proxyHaState } from "./ha.js";
import {
  asServiceRequestBody,
  extractRequestedEntityIds
} from "./policy.js";
import {
  findAllowedServicePermission,
  findAllowedStatePermission
} from "./permissions.js";
import {
  getApiKeyPrefix,
  hashApiKey,
  timingSafeEqual
} from "./security.js";
import { adminRoutes } from "./admin.js";
import { buildCapabilitiesResponse } from "./capabilities.js";
import { resolvePublicApiClient } from "./publicAuth.js";

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
  permissionId: string | null;
  actionIdRaw: string;
  ip: string | null;
  success: boolean;
  error?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        clientId: params.clientId,
        permissionId: params.permissionId,
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

function getBearerToken(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }
  const [scheme, token] = authorization.trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}

async function findClientByApiKey(apiKey: string) {
  const prefix = getApiKeyPrefix(apiKey);
  const candidates = await prisma.client.findMany({
    where: { apiKeyPrefix: prefix },
    include: { permissions: true }
  });
  const computedHash = hashApiKey(apiKey);

  return candidates.find((candidate: any) => timingSafeEqual(computedHash, candidate.apiKeyHash)) ?? null;
}

app.get("/api/capabilities", async (request, reply) => {
  const authorization = Array.isArray(request.headers.authorization)
    ? request.headers.authorization[0]
    : request.headers.authorization;
  const auth = await resolvePublicApiClient(authorization, findClientByApiKey);
  const ip = request.ip ?? null;

  if (!auth.ok) {
    await logAudit({
      clientId: auth.clientId,
      permissionId: null,
      actionIdRaw: "capabilities.read",
      ip,
      success: false,
      error: auth.error
    });
    return reply.status(auth.status).send({ ok: false, error: auth.error });
  }

  await logAudit({
    clientId: auth.client.id,
    permissionId: null,
    actionIdRaw: "capabilities.read",
    ip,
    success: true
  });

  return buildCapabilitiesResponse(auth.client);
});

app.post("/api/services/:domain/:service", async (request, reply) => {
  const { domain, service } = request.params as { domain: string; service: string };
  const actionIdRaw = `${domain}.${service}`;
  const ip = request.ip ?? null;

  const authorization = Array.isArray(request.headers.authorization)
    ? request.headers.authorization[0]
    : request.headers.authorization;
  const apiKey = getBearerToken(authorization);

  if (!apiKey) {
    await logAudit({
      clientId: null,
      permissionId: null,
      actionIdRaw,
      ip,
      success: false,
      error: "missing_bearer_token"
    });
    return reply.status(401).send({ ok: false, error: "missing_bearer_token" });
  }

  const client = await findClientByApiKey(apiKey);

  if (!client) {
    await logAudit({
      clientId: null,
      permissionId: null,
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
      permissionId: null,
      actionIdRaw,
      ip,
      success: false,
      error: "client_disabled"
    });
    return reply.status(403).send({ ok: false, error: "client_disabled" });
  }

  const body = asServiceRequestBody(request.body);
  if (!body) {
    await logAudit({
      clientId: client.id,
      permissionId: null,
      actionIdRaw,
      ip,
      success: false,
      error: "invalid_body"
    });
    return reply.status(400).send({ ok: false, error: "invalid_body" });
  }

  const entityExtraction = extractRequestedEntityIds(body);
  if (!entityExtraction.ok) {
    await logAudit({
      clientId: client.id,
      permissionId: null,
      actionIdRaw,
      ip,
      success: false,
      error: entityExtraction.error
    });
    return reply.status(403).send({ ok: false, error: entityExtraction.error });
  }

  const matchedPermission = findAllowedServicePermission(
    client.permissions,
    domain,
    service,
    entityExtraction.entityIds
  );

  if (!matchedPermission.ok) {
    await logAudit({
      clientId: client.id,
      permissionId: null,
      actionIdRaw,
      ip,
      success: false,
      error: matchedPermission.error
    });
    return reply.status(403).send({ ok: false, error: matchedPermission.error });
  }

  try {
    const queryIndex = request.url.indexOf("?");
    const queryString = queryIndex >= 0 ? request.url.slice(queryIndex) : "";
    const haResponse = await proxyHaServiceCall(domain, service, body, queryString);

    await logAudit({
      clientId: client.id,
      permissionId: matchedPermission.permission.id,
      actionIdRaw,
      ip,
      success: haResponse.ok,
      error: haResponse.ok ? null : `ha_request_failed:${haResponse.status}`
    });

    if (haResponse.contentType) {
      reply.header("content-type", haResponse.contentType);
    }
    return reply.status(haResponse.status).send(haResponse.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await logAudit({
      clientId: client.id,
      permissionId: matchedPermission.permission.id,
      actionIdRaw,
      ip,
      success: false,
      error: message
    });

    request.log.error({ err }, "ha_proxy_failed");
    return reply.status(502).send({ ok: false, error: "ha_proxy_failed" });
  }
});

app.get("/api/states/:entityId", async (request, reply) => {
  const { entityId } = request.params as { entityId: string };
  const actionIdRaw = `states.${entityId}`;
  const ip = request.ip ?? null;

  const authorization = Array.isArray(request.headers.authorization)
    ? request.headers.authorization[0]
    : request.headers.authorization;
  const apiKey = getBearerToken(authorization);

  if (!apiKey) {
    await logAudit({
      clientId: null,
      permissionId: null,
      actionIdRaw,
      ip,
      success: false,
      error: "missing_bearer_token"
    });
    return reply.status(401).send({ ok: false, error: "missing_bearer_token" });
  }

  const client = await findClientByApiKey(apiKey);

  if (!client) {
    await logAudit({
      clientId: null,
      permissionId: null,
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
      permissionId: null,
      actionIdRaw,
      ip,
      success: false,
      error: "client_disabled"
    });
    return reply.status(403).send({ ok: false, error: "client_disabled" });
  }

  const matchedPermission = findAllowedStatePermission(client.permissions, entityId);
  if (!matchedPermission.ok) {
    await logAudit({
      clientId: client.id,
      permissionId: null,
      actionIdRaw,
      ip,
      success: false,
      error: matchedPermission.error
    });
    return reply.status(403).send({ ok: false, error: matchedPermission.error });
  }

  try {
    const haResponse = await proxyHaState(entityId);

    await logAudit({
      clientId: client.id,
      permissionId: matchedPermission.permission.id,
      actionIdRaw,
      ip,
      success: haResponse.ok,
      error: haResponse.ok ? null : `ha_request_failed:${haResponse.status}`
    });

    if (haResponse.contentType) {
      reply.header("content-type", haResponse.contentType);
    }
    return reply.status(haResponse.status).send(haResponse.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await logAudit({
      clientId: client.id,
      permissionId: matchedPermission.permission.id,
      actionIdRaw,
      ip,
      success: false,
      error: message
    });

    request.log.error({ err }, "ha_state_proxy_failed");
    return reply.status(502).send({ ok: false, error: "ha_state_proxy_failed" });
  }
});

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

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
