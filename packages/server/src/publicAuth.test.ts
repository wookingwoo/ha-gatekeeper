import assert from "node:assert/strict";
import test from "node:test";
import { resolvePublicApiClient } from "./publicAuth.js";
import type { PublicApiClient } from "./publicAuth.js";

const activeClient: PublicApiClient = {
  id: "client_1",
  name: "Living Room Agent",
  status: "active",
  permissions: []
};

test("rejects missing bearer tokens", async () => {
  const result = await resolvePublicApiClient(undefined, async () => activeClient);

  assert.deepEqual(result, {
    ok: false,
    status: 401,
    error: "missing_bearer_token",
    clientId: null
  });
});

test("rejects invalid bearer tokens", async () => {
  const result = await resolvePublicApiClient("Bearer invalid_token", async () => null);

  assert.deepEqual(result, {
    ok: false,
    status: 401,
    error: "invalid_api_key",
    clientId: null
  });
});

test("rejects disabled clients", async () => {
  const result = await resolvePublicApiClient("Bearer valid_token", async () => ({
    ...activeClient,
    status: "disabled"
  }));

  assert.deepEqual(result, {
    ok: false,
    status: 403,
    error: "client_disabled",
    clientId: "client_1"
  });
});

test("returns active clients and passes token without the Bearer prefix to the finder", async () => {
  let apiKey: string | null = null;

  const result = await resolvePublicApiClient("Bearer valid_token", async (token) => {
    apiKey = token;
    return activeClient;
  });

  assert.equal(apiKey, "valid_token");
  assert.deepEqual(result, {
    ok: true,
    client: activeClient
  });
});
