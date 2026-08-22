import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.HA_GATEKEEPER_ADDON = "true";
process.env.ADDON_EXPOSE_API = "true";
process.env.SUPERVISOR_TOKEN = "supervisor-token";
process.env.ADMIN_SESSION_SECRET = "12345678901234567890123456789012";
process.env.API_KEY_HASH_SECRET = "12345678901234567890123456789012";

const { hashApiKey, generateApiKey, timingSafeEqual, getApiKeyPrefix } = await import(
  "./security.js"
);

test("hashApiKey is deterministic for the same input", () => {
  const a = hashApiKey("same-key");
  const b = hashApiKey("same-key");

  assert.equal(a, b);
});

test("hashApiKey changes when the input changes by one character", () => {
  const a = hashApiKey("same-key-a");
  const b = hashApiKey("same-key-b");

  assert.notEqual(a, b);
});

test("generateApiKey returns a key whose hash matches hashApiKey", () => {
  const { apiKey, apiKeyHash } = generateApiKey();

  assert.equal(apiKeyHash, hashApiKey(apiKey));
});

test("generateApiKey returns a prefix matching the key's first 8 characters", () => {
  const { apiKey, apiKeyPrefix } = generateApiKey();

  assert.equal(apiKeyPrefix, apiKey.slice(0, 8));
  assert.equal(apiKeyPrefix.length, 8);
});

test("generateApiKey produces distinct keys across calls", () => {
  const first = generateApiKey();
  const second = generateApiKey();

  assert.notEqual(first.apiKey, second.apiKey);
});

test("timingSafeEqual returns true for identical strings", () => {
  assert.equal(timingSafeEqual("abc123", "abc123"), true);
});

test("timingSafeEqual returns false for different strings of the same length", () => {
  assert.equal(timingSafeEqual("abc123", "abc124"), false);
});

test("timingSafeEqual returns false for strings of different lengths", () => {
  assert.equal(timingSafeEqual("short", "much-longer-string"), false);
});

test("timingSafeEqual returns false comparing against an empty string", () => {
  assert.equal(timingSafeEqual("", "non-empty"), false);
  assert.equal(timingSafeEqual("non-empty", ""), false);
});

test("timingSafeEqual returns true for two empty strings", () => {
  assert.equal(timingSafeEqual("", ""), true);
});

test("getApiKeyPrefix returns the first 8 characters", () => {
  assert.equal(getApiKeyPrefix("abcdefghijklmnop"), "abcdefgh");
});

test("getApiKeyPrefix returns the whole string when shorter than 8 characters", () => {
  assert.equal(getApiKeyPrefix("abc"), "abc");
});

test("getApiKeyPrefix returns an empty string for empty input", () => {
  assert.equal(getApiKeyPrefix(""), "");
});
