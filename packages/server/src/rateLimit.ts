import type { FastifyRequest } from "fastify";
import type { errorResponseBuilderContext } from "@fastify/rate-limit";

// @fastify/rate-limit throws whatever this returns (see its defaultErrorResponse), so the
// returned object must carry `statusCode` itself — Fastify's error handler reads it from
// there to set the actual HTTP response code, it isn't set for us. `context.ban` mirrors how
// the plugin's own default builder picks 403 vs 429; this app never configures `ban`, so it's
// always 429 in practice, but this stays correct if that ever changes.
export function rateLimitErrorResponseBuilder(
  _request: FastifyRequest,
  context: errorResponseBuilderContext
) {
  return { statusCode: context.ban ? 403 : 429, ok: false, error: "rate_limited" };
}
