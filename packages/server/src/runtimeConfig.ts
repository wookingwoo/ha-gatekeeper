import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]).default("development");
const logLevelSchema = z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info");

export type RuntimeConfig = {
  NODE_ENV: z.infer<typeof nodeEnvSchema>;
  PORT: number;
  PUBLIC_API_IP_RATE_LIMIT: number;
  DATABASE_URL: string;
  HA_BASE_URL: string;
  HA_TOKEN: string;
  ADMIN_PASSWORD: string;
  ADMIN_SESSION_SECRET: string;
  API_KEY_HASH_SECRET: string;
  CORS_ORIGIN: string;
  HA_GATEKEEPER_ADDON: boolean;
  ADDON_EXPOSE_API: boolean;
  LOG_LEVEL: z.infer<typeof logLevelSchema>;
  AUDIT_LOG_RETENTION_DAYS: number;
  CLOUDFLARE_TUNNEL_ENABLED: boolean;
  CLOUDFLARE_TUNNEL_TOKEN: string;
  CLOUDFLARE_PUBLIC_URL: string;
};

const commonSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PUBLIC_API_IP_RATE_LIMIT: z.coerce.number().int().positive().default(300),
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().default("file:./prisma/dev.db"),
  ADMIN_SESSION_SECRET: z.string().trim().min(8),
  API_KEY_HASH_SECRET: z.string().trim().min(16),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  LOG_LEVEL: logLevelSchema,
  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().min(0).default(90)
});

const standaloneSchema = commonSchema.extend({
  HA_BASE_URL: z.string().trim().url(),
  HA_TOKEN: z.string().trim().min(1),
  ADMIN_PASSWORD: z.string().trim().min(8)
});

const addonSchema = commonSchema.extend({
  SUPERVISOR_TOKEN: z.string().trim().min(1),
  ADMIN_PASSWORD: z.string().trim().min(8).optional()
});

export function resolveRuntimeConfig(raw: Record<string, string | undefined>): RuntimeConfig {
  const HA_GATEKEEPER_ADDON = parseBooleanFlag(raw.HA_GATEKEEPER_ADDON);
  const ADDON_EXPOSE_API = parseBooleanFlag(raw.ADDON_EXPOSE_API);
  const tunnel = resolveTunnelConfig(raw, HA_GATEKEEPER_ADDON);

  if (HA_GATEKEEPER_ADDON) {
    const parsed = addonSchema.parse(raw);

    return {
      ...tunnel,
      NODE_ENV: parsed.NODE_ENV,
      PORT: parsed.PORT,
      PUBLIC_API_IP_RATE_LIMIT: parsed.PUBLIC_API_IP_RATE_LIMIT,
      DATABASE_URL: parsed.DATABASE_URL,
      HA_BASE_URL: "http://supervisor/core",
      HA_TOKEN: parsed.SUPERVISOR_TOKEN,
      ADMIN_PASSWORD: parsed.ADMIN_PASSWORD || "addon-ingress-authenticated",
      ADMIN_SESSION_SECRET: parsed.ADMIN_SESSION_SECRET,
      API_KEY_HASH_SECRET: parsed.API_KEY_HASH_SECRET,
      CORS_ORIGIN: parsed.CORS_ORIGIN,
      HA_GATEKEEPER_ADDON,
      ADDON_EXPOSE_API,
      LOG_LEVEL: parsed.LOG_LEVEL,
      AUDIT_LOG_RETENTION_DAYS: parsed.AUDIT_LOG_RETENTION_DAYS
    };
  }

  const parsed = standaloneSchema.parse(raw);

  return {
    ...tunnel,
    NODE_ENV: parsed.NODE_ENV,
    PORT: parsed.PORT,
      PUBLIC_API_IP_RATE_LIMIT: parsed.PUBLIC_API_IP_RATE_LIMIT,
    DATABASE_URL: parsed.DATABASE_URL,
    HA_BASE_URL: parsed.HA_BASE_URL,
    HA_TOKEN: parsed.HA_TOKEN,
    ADMIN_PASSWORD: parsed.ADMIN_PASSWORD,
    ADMIN_SESSION_SECRET: parsed.ADMIN_SESSION_SECRET,
    API_KEY_HASH_SECRET: parsed.API_KEY_HASH_SECRET,
    CORS_ORIGIN: parsed.CORS_ORIGIN,
    HA_GATEKEEPER_ADDON,
    ADDON_EXPOSE_API,
    LOG_LEVEL: parsed.LOG_LEVEL,
    AUDIT_LOG_RETENTION_DAYS: parsed.AUDIT_LOG_RETENTION_DAYS
  };
}

function resolveTunnelConfig(raw: Record<string, string | undefined>, addonMode: boolean) {
  const enabled = parseBooleanFlag(raw.CLOUDFLARE_TUNNEL_ENABLED);
  if (!enabled) {
    return {
      CLOUDFLARE_TUNNEL_ENABLED: false,
      CLOUDFLARE_TUNNEL_TOKEN: "",
      CLOUDFLARE_PUBLIC_URL: ""
    };
  }
  if (!addonMode) {
    throw new Error("Cloudflare Tunnel is only supported in Add-on mode");
  }

  const parsed = z.object({
    CLOUDFLARE_TUNNEL_TOKEN: z.string().trim().min(1).regex(/^[A-Za-z0-9+/=_-]+$/),
    CLOUDFLARE_PUBLIC_URL: z.string().trim().url().refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" && url.href === `${url.origin}/`;
      } catch {
        return false;
      }
    }, "Use an HTTPS origin without credentials, path, query or fragment")
  }).parse(raw);

  return {
    CLOUDFLARE_TUNNEL_ENABLED: true,
    CLOUDFLARE_TUNNEL_TOKEN: parsed.CLOUDFLARE_TUNNEL_TOKEN,
    CLOUDFLARE_PUBLIC_URL: new URL(parsed.CLOUDFLARE_PUBLIC_URL).origin
  };
}

function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
}
