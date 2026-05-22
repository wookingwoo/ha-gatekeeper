import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./db.js";
import { env } from "./env.js";
import { fetchHaEntities, fetchHaServices } from "./ha.js";
import {
  auditQuerySchema,
  createClientSchema,
  loginSchema,
  quickSetupSchema,
  updateClientPermissionsSchema,
  updateClientSchema
} from "./schemas.js";
import { parsePermission } from "./permissions.js";
import { createTokenAccess, replaceTokenPermissions } from "./tokenAccess.js";
import { generateApiKey } from "./security.js";
import { isAdminAuthenticated } from "./adminAuth.js";

function sendUnauthorized(reply: FastifyReply) {
  return reply.status(401).send({ ok: false, error: "unauthorized" });
}

function ensureAdmin(request: FastifyRequest, reply: FastifyReply) {
  const isAuthed = getAdminAuthenticated(request);
  if (!isAuthed) {
    sendUnauthorized(reply);
    return false;
  }
  return true;
}

function getAdminAuthenticated(request: FastifyRequest): boolean {
  return isAdminAuthenticated({
    addonMode: env.HA_GATEKEEPER_ADDON,
    sessionAdmin: request.session.get("admin") === true,
    ip: request.ip,
    headers: request.headers
  });
}

function normalizePermission(permission: any) {
  return parsePermission(permission);
}

function normalizeClient(client: any) {
  return {
    id: client.id,
    name: client.name,
    status: client.status,
    apiKeyPrefix: client.apiKeyPrefix,
    createdAt: client.createdAt,
    permissions: (client.permissions ?? []).map(normalizePermission).filter(Boolean)
  };
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  let haServiceCache: { data: Awaited<ReturnType<typeof fetchHaServices>>; expiresAt: number } | null =
    null;
  let haEntityCache: { data: Awaited<ReturnType<typeof fetchHaEntities>>; expiresAt: number } | null =
    null;

  app.post("/login", async (request, reply) => {
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

  app.post("/logout", async (request, reply) => {
    request.session.delete();
    return reply.send({ ok: true });
  });

  app.get("/me", async (request) => ({
    authenticated: getAdminAuthenticated(request),
    addonMode: env.HA_GATEKEEPER_ADDON
  }));

  app.get("/ha/services", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
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

  app.get("/ha/entities", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
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

    const domain =
      typeof request.query === "object" ? (request.query as { domain?: string }).domain : undefined;
    const payload = domain
      ? haEntityCache.data.filter((entity) => entity.domain === domain)
      : haEntityCache.data;

    return reply.send({ ok: true, entities: payload, cached: true });
  });

  app.get("/clients", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
    }

    const clients = await prisma.client.findMany({
      include: { permissions: true },
      orderBy: { createdAt: "desc" }
    });

    return reply.send({ ok: true, clients: clients.map(normalizeClient) });
  });

  app.post("/clients", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
    }

    const parsed = createClientSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "invalid_body" });
    }

    const result = await createTokenAccess(prisma, parsed.data);

    return reply.send({
      ok: true,
      client: normalizeClient(result.client),
      apiKey: result.apiKey
    });
  });

  app.post("/quick-setup", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
    }

    const parsed = quickSetupSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "invalid_body" });
    }

    const result = await createTokenAccess(prisma, {
      name: parsed.data.name,
      permissions: parsed.data.permissions
    });

    return reply.send({
      ok: true,
      client: normalizeClient(result.client),
      apiKey: result.apiKey
    });
  });

  app.patch("/clients/:id", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
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
        status: parsed.data.status
      },
      include: { permissions: true }
    });

    return reply.send({ ok: true, client: normalizeClient(client) });
  });

  app.patch("/clients/:id/permissions", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
    }

    const parsed = updateClientPermissionsSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "invalid_body" });
    }

    const clientId = (request.params as { id: string }).id;
    const client = await replaceTokenPermissions(prisma, clientId, parsed.data.permissions);
    if (!client) {
      return reply.status(404).send({ ok: false, error: "client_not_found" });
    }

    return reply.send({ ok: true, client: normalizeClient(client) });
  });

  app.post("/clients/:id/rotate-key", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
    }

    const clientId = (request.params as { id: string }).id;
    const { apiKey, apiKeyHash, apiKeyPrefix } = generateApiKey();

    const client = await prisma.client.update({
      where: { id: clientId },
      data: { apiKeyHash, apiKeyPrefix },
      include: { permissions: true }
    });

    return reply.send({ ok: true, client: normalizeClient(client), apiKey });
  });

  app.delete("/clients/:id", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
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

  app.get("/audit-logs", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
    }

    const parsed = auditQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "invalid_query" });
    }

    const logs = await prisma.auditLog.findMany({
      include: { client: true, permission: true },
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
      permissionId: log.permissionId,
      permission: log.permission ? normalizePermission(log.permission) : null,
      actionIdRaw: log.actionIdRaw
    }));

    return reply.send({ ok: true, logs: payload });
  });
};
