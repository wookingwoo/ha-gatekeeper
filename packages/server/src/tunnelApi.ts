import Fastify, { type FastifyBaseLogger, type FastifyPluginAsync } from "fastify";
import type { PublicApiOptions } from "./publicApi.js";

export const TUNNEL_API_PORT = 8081;

// A separate loopback listener gives cloudflared only the scoped API. Neither
// Ingress authentication nor admin/static routes are installed on this server.
export function createTunnelApi(
  publicRoutes: FastifyPluginAsync<PublicApiOptions>,
  logger?: FastifyBaseLogger
) {
  const app = Fastify({ logger: logger ?? false, exposeHeadRoutes: false });
  app.addHook("onRequest", async (request, reply) => {
    const route = request.routeOptions.url;
    const allowed =
      (request.method === "GET" &&
        (route === "/api/capabilities" || route === "/api/states/:entityId")) ||
      (request.method === "POST" && route === "/api/services/:domain/:service");
    if (!allowed) {
      return reply.status(404).send({ ok: false, error: "not_found" });
    }
  });
  app.register(publicRoutes, { prefix: "/api", exposeApi: true, tunnelListener: true });
  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ ok: false, error: "not_found" })
  );
  return app;
}
