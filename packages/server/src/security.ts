import crypto from "crypto";
import { env } from "./env.js";

const PREFIX_LENGTH = 8;

export function hashApiKey(apiKey: string): string {
  return crypto.createHmac("sha256", env.API_KEY_HASH_SECRET).update(apiKey).digest("hex");
}

export function generateApiKey(): { apiKey: string; apiKeyHash: string; apiKeyPrefix: string } {
  const apiKey = crypto.randomBytes(32).toString("base64url");
  const apiKeyHash = hashApiKey(apiKey);
  const apiKeyPrefix = apiKey.slice(0, PREFIX_LENGTH);
  return { apiKey, apiKeyHash, apiKeyPrefix };
}

export function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function getApiKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, PREFIX_LENGTH);
}
