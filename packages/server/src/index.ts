import Fastify, { FastifyRequest } from "fastify";
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
import { callHaServices, fetchHaEntities, fetchHaServices } from "./ha.js";
import {
  auditQuerySchema,
  createActionSchema,
  createClientSchema,
  createRoleSchema,
  haCallsSchema,
  loginSchema,
  updateActionSchema,
  updateClientSchema
} from "./schemas.js";
import {
  generateApiKey,
  getApiKeyPrefix,
  hashApiKey,
  timingSafeEqual
} from "./security.js";

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

function requireAdmin(request: FastifyRequest) {
  const isAuthed = request.session.get("admin") === true;
  return isAuthed;
}

app.post("/admin/login", async (request, reply) => {
  const parsed = loginSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.status(400).send({ ok: false, error: "invalid_body" });
  }

  if (parsed.data.password !== env.ADMIN_PASSWORD) {
    return reply.status(401).send({ ok: false, error: "invalid_credentials" });
  }

  request.session.set("admin", true);
  return reply.send({ ok: true });
});

app.post("/admin/logout", async (request, reply) => {
  request.session.delete();
  return reply.send({ ok: true });
});

app.get("/admin/me", async (request) => ({
  authenticated: request.session.get("admin") === true
}));

let haServiceCache: { data: Awaited<ReturnType<typeof fetchHaServices>>; expiresAt: number } | null =
  null;
let haEntityCache: { data: Awaited<ReturnType<typeof fetchHaEntities>>; expiresAt: number } | null =
  null;

app.get("/admin/roles", async (request, reply) => {
  if (!requireAdmin(request)) {
    return reply.status(401).send({ ok: false, error: "unauthorized" });
  }
  const roles = await prisma.role.findMany({ orderBy: { createdAt: "desc" } });
  return reply.send({ ok: true, roles });
});

app.post("/admin/roles", async (request, reply) => {
  if (!requireAdmin(request)) {
    return reply.status(401).send({ ok: false, error: "unauthorized" });
  }
  const parsed = createRoleSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.status(400).send({ ok: false, error: "invalid_body" });
  }
  const role = await prisma.role.create({ data: { name: parsed.data.name } });
  return reply.send({ ok: true, role });
});

app.get("/admin/ha/services", async (request, reply) => {
  if (!requireAdmin(request)) {
    return reply.status(401).send({ ok: false, error: "unauthorized" });
  }

  const now = Date.now();
  if (haServiceCache && haServiceCache.expiresAt > now) {
    return reply.send({ ok: true, services: haServiceCache.data, cached: true });
  }

  try {
    const services = await fetchHaServices();
    haServiceCache = { data: services, expiresAt: now + 60_000 };
    return reply.send({ ok: true, services, cached: false });
  } catch (err) {
    request.log.error({ err }, "ha_services_failed");
    return reply.status(502).send({ ok: false, error: "ha_services_failed" });
  }
});

app.get("/admin/ha/entities", async (request, reply) => {
  if (!requireAdmin(request)) {
    return reply.status(401).send({ ok: false, error: "unauthorized" });
  }

  const now = Date.now();
  if (!haEntityCache || haEntityCache.expiresAt <= now) {
    try {
      const entities = await fetchHaEntities();
      haEntityCache = { data: entities, expiresAt: now + 60_000 };
    } catch (err) {
      request.log.error({ err }, "ha_entities_failed");
      return reply.status(502).send({ ok: false, error: "ha_entities_failed" });
    }
  }

  const domain = typeof request.query === "object" ? (request.query as { domain?: string }).domain : undefined;
  const payload = domain
    ? haEntityCache.data.filter((entity) => entity.domain === domain)
    : haEntityCache.data;

  return reply.send({ ok: true, entities: payload, cached: true });
});

app.get("/admin/actions", async (request, reply) => {
  if (!requireAdmin(request)) {
    return reply.status(401).send({ ok: false, error: "unauthorized" });
  }
  const actions = await prisma.action.findMany({
    include: { roleActions: true },
    orderBy: { createdAt: "desc" }
  });
  const payload = actions.map((action: any) => ({
    id: action.id,
    name: action.name,
    description: action.description,
    status: action.status as "active" | "disabled",
    haCalls: JSON.parse(action.haCalls),
    roleIds: action.roleActions.map((ra: any) => ra.roleId)
  }));
  return reply.send({ ok: true, actions: payload });
});

app.post("/admin/actions", async (request, reply) => {
  if (!requireAdmin(request)) {
    return reply.status(401).send({ ok: false, error: "unauthorized" });
  }
  const parsed = createActionSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.status(400).send({ ok: false, error: "invalid_body" });
  }

  const action = await prisma.action.create({
    data: {
      id: parsed.data.id,
      name: parsed.data.name,
      description: parsed.data.description,
      haCalls: JSON.stringify(parsed.data.haCalls),
      status: parsed.data.status,
      roleActions: {
        create: parsed.data.roleIds.map((roleId) => ({ roleId }))
      }
    }
  });

  return reply.send({ ok: true, action });
});

app.patch("/admin/actions/:id", async (request, reply) => {
  if (!requireAdmin(request)) {
    return reply.status(401).send({ ok: false, error: "unauthorized" });
  }
  const parsed = updateActionSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.status(400).send({ ok: false, error: "invalid_body" });
  }

  const actionId = (request.params as { id: string }).id;

  const action = await prisma.action.update({
    where: { id: actionId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      haCalls: parsed.data.haCalls ? JSON.stringify(parsed.data.haCalls) : undefined,
      status: parsed.data.status,
      roleActions: parsed.data.roleIds
        ? {
            deleteMany: {},
            create: parsed.data.roleIds.map((roleId) => ({ roleId }))
          }
        : undefined
    }
  });

  return reply.send({ ok: true, action });
});

app.get("/admin/clients", async (request, reply) => {
  if (!requireAdmin(request)) {
    return reply.status(401).send({ ok: false, error: "unauthorized" });
  }
  const clients = await prisma.client.findMany({
    include: { role: true },
    orderBy: { createdAt: "desc" }
  });

  const payload = clients.map((client: any) => ({
    id: client.id,
    name: client.name,
    status: client.status,
    roleId: client.roleId,
    roleName: client.role.name,
    apiKeyPrefix: client.apiKeyPrefix,
    createdAt: client.createdAt
  }));

  return reply.send({ ok: true, clients: payload });
});

app.post("/admin/clients", async (request, reply) => {
  if (!requireAdmin(request)) {
    return reply.status(401).send({ ok: false, error: "unauthorized" });
  }

  const parsed = createClientSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.status(400).send({ ok: false, error: "invalid_body" });
  }

  const roleExists = await prisma.role.findUnique({ where: { id: parsed.data.roleId } });
  if (!roleExists) {
    return reply.status(400).send({ ok: false, error: "role_not_found" });
  }

  const { apiKey, apiKeyHash, apiKeyPrefix } = generateApiKey();

  const client = await prisma.client.create({
    data: {
      name: parsed.data.name,
      roleId: parsed.data.roleId,
      status: parsed.data.status,
      apiKeyHash,
      apiKeyPrefix
    }
  });

  return reply.send({ ok: true, client, apiKey });
});

app.patch("/admin/clients/:id", async (request, reply) => {
  if (!requireAdmin(request)) {
    return reply.status(401).send({ ok: false, error: "unauthorized" });
  }

  const parsed = updateClientSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.status(400).send({ ok: false, error: "invalid_body" });
  }

  const clientId = (request.params as { id: string }).id;
  const client = await prisma.client.update({
    where: { id: clientId },
    data: {
      name: parsed.data.name,
      roleId: parsed.data.roleId,
      status: parsed.data.status
    }
  });

  return reply.send({ ok: true, client });
});

app.post("/admin/clients/:id/rotate-key", async (request, reply) => {
  if (!requireAdmin(request)) {
    return reply.status(401).send({ ok: false, error: "unauthorized" });
  }

  const clientId = (request.params as { id: string }).id;
  const { apiKey, apiKeyHash, apiKeyPrefix } = generateApiKey();

  const client = await prisma.client.update({
    where: { id: clientId },
    data: { apiKeyHash, apiKeyPrefix }
  });

  return reply.send({ ok: true, client, apiKey });
});

app.delete("/admin/clients/:id", async (request, reply) => {
  if (!requireAdmin(request)) {
    return reply.status(401).send({ ok: false, error: "unauthorized" });
  }

  const clientId = (request.params as { id: string }).id;

  try {
    await prisma.$transaction([
      prisma.auditLog.updateMany({
        where: { clientId },
        data: { clientId: null }
      }),
      prisma.client.delete({ where: { id: clientId } })
    ]);
  } catch (err) {
    request.log.error({ err }, "client_delete_failed");
    return reply.status(400).send({ ok: false, error: "client_delete_failed" });
  }

  return reply.send({ ok: true });
});

app.get("/admin/audit-logs", async (request, reply) => {
  if (!requireAdmin(request)) {
    return reply.status(401).send({ ok: false, error: "unauthorized" });
  }

  const parsed = auditQuerySchema.safeParse(request.query ?? {});
  if (!parsed.success) {
    return reply.status(400).send({ ok: false, error: "invalid_query" });
  }

  const logs = await prisma.auditLog.findMany({
    include: { client: true, action: true },
    orderBy: { timestamp: "desc" },
    take: parsed.data.limit,
    skip: parsed.data.offset
  });

  const payload = logs.map((log: any) => ({
    id: log.id,
    timestamp: log.timestamp,
    success: log.success,
    error: log.error,
    ip: log.ip,
    clientId: log.clientId,
    clientName: log.client?.name ?? null,
    actionId: log.actionId,
    actionName: log.action?.name ?? null,
    actionIdRaw: log.actionIdRaw
  }));

  return reply.send({ ok: true, logs: payload });
});

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
