import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().default("file:./prisma/dev.db"),
  HA_BASE_URL: z.string().url(),
  HA_TOKEN: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(8),
  ADMIN_SESSION_SECRET: z.string().min(32),
  API_KEY_HASH_SECRET: z.string().min(16),
  CORS_ORIGIN: z.string().default("http://localhost:5173")
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  HA_BASE_URL: process.env.HA_BASE_URL,
  HA_TOKEN: process.env.HA_TOKEN,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
  API_KEY_HASH_SECRET: process.env.API_KEY_HASH_SECRET,
  CORS_ORIGIN: process.env.CORS_ORIGIN
});

export const isProd = env.NODE_ENV === "production";
