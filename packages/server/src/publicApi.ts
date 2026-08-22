import type { FastifyPluginAsync } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { prisma } from "./db.js";
import { env } from "./env.js";
import { proxyHaServiceCall, proxyHaState } from "./ha.js";
import { asServiceRequestBody, extractRequestedEntityIds } from "./policy.js";
import { findAllowedServicePermission, findAllowedStatePermission } from "./permissions.js";
import { getApiKeyPrefix, hashApiKey, timingSafeEqual } from "./security.js";
import { buildCapabilitiesResponse } from "./capabilities.js";
import { resolvePublicApiClient, readBearerToken, type PublicApiClient } from "./publicAuth.js";
import { isPublicApiAllowed } from "./adminAuth.js";
import { logAudit } from "./audit.js";
import { rateLimitErrorResponseBuilder } from "./rateLimit.js";

const publicApiRateLimit = { max: 100, timeWindow: "1 minute" };

async function findClientByApiKey(apiKey: string): Promise<PublicApiClient | null> {
  const prefix = getApiKeyPrefix(apiKey);
  const candidates = await prisma.client.findMany({
    where: { apiKeyPrefix: prefix },
    include: { permissions: true }
  });
  const computedHash = hashApiKey(apiKey);

  return candidates.find((candidate: any) => timingSafeEqual(computedHash, candidate.apiKeyHash)) ?? null;
}

function getAuthorizationHeader(headers: Record<string, string | string[] | undefined>): string | undefined {
  const authorization = headers.authorization;
  return Array.isArray(authorization) ? authorization[0] : authorization;
}

export const publicApiRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    if (isPublicApiAllowed({ addonMode: env.HA_GATEKEEPER_ADDON, exposeApi: env.ADDON_EXPOSE_API })) {
      return;
    }

    return reply.status(403).send({ ok: false, error: "api_not_exposed" });
  });

  // Keyed by bearer-token prefix (not raw IP) so distinct API clients behind the same
  // NAT/router get independent buckets. Falls back to IP only when no token is present at all.
  await app.register(rateLimit, {
    global: false,
    keyGenerator: (request) => {
      const authorization = getAuthorizationHeader(request.headers);
      const token = readBearerToken(authorization);
      return token ? `token:${getApiKeyPrefix(token)}` : `ip:${request.ip}`;
    },
    errorResponseBuilder: rateLimitErrorResponseBuilder
  });

  app.get("/capabilities", { config: { rateLimit: publicApiRateLimit } }, async (request, reply) => {
    const authorization = getAuthorizationHeader(request.headers);
    const auth = await resolvePublicApiClient(authorization, findClientByApiKey);
    const ip = request.ip ?? null;

    if (!auth.ok) {
      await logAudit(request.log, {
        clientId: auth.clientId,
        permissionId: null,
        actionIdRaw: "capabilities.read",
        ip,
        success: false,
        error: auth.error
      });
      return reply.status(auth.status).send({ ok: false, error: auth.error });
    }

    await logAudit(request.log, {
      clientId: auth.client.id,
      permissionId: null,
      actionIdRaw: "capabilities.read",
      ip,
      success: true
    });

    return buildCapabilitiesResponse(auth.client);
  });

  app.post(
    "/services/:domain/:service",
    { config: { rateLimit: publicApiRateLimit } },
    async (request, reply) => {
      const { domain, service } = request.params as { domain: string; service: string };
      const actionIdRaw = `${domain}.${service}`;
      const ip = request.ip ?? null;

      const authorization = getAuthorizationHeader(request.headers);
      const auth = await resolvePublicApiClient(authorization, findClientByApiKey);

      if (!auth.ok) {
        await logAudit(request.log, {
          clientId: auth.clientId,
          permissionId: null,
          actionIdRaw,
          ip,
          success: false,
          error: auth.error
        });
        return reply.status(auth.status).send({ ok: false, error: auth.error });
      }

      const client = auth.client;

      const body = asServiceRequestBody(request.body);
      if (!body) {
        await logAudit(request.log, {
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
        await logAudit(request.log, {
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
        await logAudit(request.log, {
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

        await logAudit(request.log, {
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
        await logAudit(request.log, {
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
    }
  );

  app.get("/states/:entityId", { config: { rateLimit: publicApiRateLimit } }, async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    const actionIdRaw = `states.${entityId}`;
    const ip = request.ip ?? null;

    const authorization = getAuthorizationHeader(request.headers);
    const auth = await resolvePublicApiClient(authorization, findClientByApiKey);

    if (!auth.ok) {
      await logAudit(request.log, {
        clientId: auth.clientId,
        permissionId: null,
        actionIdRaw,
        ip,
        success: false,
        error: auth.error
      });
      return reply.status(auth.status).send({ ok: false, error: auth.error });
    }

    const client = auth.client;

    const matchedPermission = findAllowedStatePermission(client.permissions, entityId);
    if (!matchedPermission.ok) {
      await logAudit(request.log, {
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

      await logAudit(request.log, {
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
      await logAudit(request.log, {
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
};
