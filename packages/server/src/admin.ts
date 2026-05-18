import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import crypto from "node:crypto";
import { prisma } from "./db.js";
import { env } from "./env.js";
import { fetchHaEntities, fetchHaServices } from "./ha.js";
import {
  auditQuerySchema,
  createActionSchema,
  createClientSchema,
  createRoleSchema,
  loginSchema,
  quickSetupSchema,
  updateActionSchema,
  updateClientSchema
} from "./schemas.js";
import { createQuickSetupAccess } from "./quickSetup.js";
import { generateApiKey } from "./security.js";

function sendUnauthorized(reply: FastifyReply) {
  return reply.status(401).send({ ok: false, error: "unauthorized" });
}

function ensureAdmin(request: FastifyRequest, reply: FastifyReply) {
  const isAuthed = request.session.get("admin") === true;
  if (!isAuthed) {
    sendUnauthorized(reply);
    return false;
  }
  return true;
}

function createPolicyId(domain: string, service: string): string {
  return `${domain}.${service}.${crypto.randomBytes(4).toString("hex")}`;
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
    authenticated: request.session.get("admin") === true
  }));

  app.get("/roles", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
    }
    const roles = await prisma.role.findMany({ orderBy: { createdAt: "desc" } });
    return reply.send({ ok: true, roles });
  });

  app.post("/roles", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
    }
    const parsed = createRoleSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "invalid_body" });
    }
    const role = await prisma.role.create({ data: { name: parsed.data.name } });
    return reply.send({ ok: true, role });
  });

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

  app.get("/actions", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
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

  app.post("/actions", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
    }
    const parsed = createActionSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "invalid_body" });
    }

    const action = await prisma.action.create({
      data: {
        id:
          parsed.data.id ??
          createPolicyId(parsed.data.haCalls[0].domain, parsed.data.haCalls[0].service),
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

  app.patch("/actions/:id", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
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

  app.get("/clients", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
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

  app.post("/clients", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
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

  app.post("/quick-setup", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
    }

    const parsed = quickSetupSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "invalid_body" });
    }

    try {
      const result = await createQuickSetupAccess(prisma, parsed.data);
      return reply.send({
        ok: true,
        role: result.role,
        actions: result.actions,
        client: result.client,
        apiKey: result.apiKey
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "quick_setup_failed";
      request.log.error({ err }, "quick_setup_failed");
      if (message.startsWith("target_domain_mismatch")) {
        return reply.status(400).send({ ok: false, error: "target_domain_mismatch" });
      }
      return reply.status(500).send({ ok: false, error: "quick_setup_failed" });
    }
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
        roleId: parsed.data.roleId,
        status: parsed.data.status
      }
    });

    return reply.send({ ok: true, client });
  });

  app.post("/clients/:id/rotate-key", async (request, reply) => {
    if (!ensureAdmin(request, reply)) {
      return;
    }

    const clientId = (request.params as { id: string }).id;
    const { apiKey, apiKeyHash, apiKeyPrefix } = generateApiKey();

    const client = await prisma.client.update({
      where: { id: clientId },
      data: { apiKeyHash, apiKeyPrefix }
    });

    return reply.send({ ok: true, client, apiKey });
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
};
