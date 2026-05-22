import assert from "node:assert/strict";
import test from "node:test";
import { resolveRuntimeConfig } from "./runtimeConfig.js";

const validStandaloneEnv = {
  HA_BASE_URL: "http://homeassistant.local:8123",
  HA_TOKEN: "ha-token",
  ADMIN_PASSWORD: "admin-password",
  ADMIN_SESSION_SECRET: "session-secret",
  API_KEY_HASH_SECRET: "api-key-hash-secret"
};

test("standalone mode resolves HA config, admin secrets, CORS origin, and port", () => {
  const env = resolveRuntimeConfig({
    ...validStandaloneEnv,
    NODE_ENV: "production",
    PORT: "9090",
    DATABASE_URL: "file:./custom.db",
    CORS_ORIGIN: "https://gatekeeper.example",
    LOG_LEVEL: "debug"
  });

  assert.deepEqual(env, {
    NODE_ENV: "production",
    PORT: 9090,
    DATABASE_URL: "file:./custom.db",
    HA_BASE_URL: "http://homeassistant.local:8123",
    HA_TOKEN: "ha-token",
    ADMIN_PASSWORD: "admin-password",
    ADMIN_SESSION_SECRET: "session-secret",
    API_KEY_HASH_SECRET: "api-key-hash-secret",
    CORS_ORIGIN: "https://gatekeeper.example",
    HA_GATEKEEPER_ADDON: false,
    ADDON_EXPOSE_API: false,
    LOG_LEVEL: "debug"
  });
});

test("add-on mode uses supervisor core API and SUPERVISOR_TOKEN", () => {
  const env = resolveRuntimeConfig({
    HA_GATEKEEPER_ADDON: "true",
    SUPERVISOR_TOKEN: "supervisor-token",
    ADMIN_SESSION_SECRET: "session-secret",
    API_KEY_HASH_SECRET: "api-key-hash-secret"
  });

  assert.equal(env.HA_BASE_URL, "http://supervisor/core/api");
  assert.equal(env.HA_TOKEN, "supervisor-token");
  assert.equal(env.HA_GATEKEEPER_ADDON, true);
});

test("add-on mode defaults ADMIN_PASSWORD to ingress-authenticated sentinel", () => {
  const env = resolveRuntimeConfig({
    HA_GATEKEEPER_ADDON: "1",
    SUPERVISOR_TOKEN: "supervisor-token",
    ADMIN_SESSION_SECRET: "session-secret",
    API_KEY_HASH_SECRET: "api-key-hash-secret"
  });

  assert.equal(env.ADMIN_PASSWORD, "addon-ingress-authenticated");
});

test("add-on mode rejects short explicit ADMIN_PASSWORD while allowing omission", () => {
  const addonBaseEnv = {
    HA_GATEKEEPER_ADDON: "1",
    SUPERVISOR_TOKEN: "supervisor-token",
    ADMIN_SESSION_SECRET: "session-secret",
    API_KEY_HASH_SECRET: "api-key-hash-secret"
  };

  assert.equal(resolveRuntimeConfig(addonBaseEnv).ADMIN_PASSWORD, "addon-ingress-authenticated");
  assert.throws(() => resolveRuntimeConfig({ ...addonBaseEnv, ADMIN_PASSWORD: "short" }), /ADMIN_PASSWORD/);
});

test("ADDON_EXPOSE_API is false by default and true when explicitly enabled", () => {
  const addonBaseEnv = {
    HA_GATEKEEPER_ADDON: "on",
    SUPERVISOR_TOKEN: "supervisor-token",
    ADMIN_SESSION_SECRET: "session-secret",
    API_KEY_HASH_SECRET: "api-key-hash-secret"
  };

  assert.equal(resolveRuntimeConfig(addonBaseEnv).ADDON_EXPOSE_API, false);
  assert.equal(resolveRuntimeConfig({ ...addonBaseEnv, ADDON_EXPOSE_API: "yes" }).ADDON_EXPOSE_API, true);
});

test("standalone mode throws if HA_BASE_URL is missing", () => {
  assert.throws(
    () =>
      resolveRuntimeConfig({
        HA_TOKEN: "ha-token",
        ADMIN_PASSWORD: "admin-password",
        ADMIN_SESSION_SECRET: "session-secret",
        API_KEY_HASH_SECRET: "api-key-hash-secret"
      }),
    /HA_BASE_URL/
  );
});

test("add-on mode throws if SUPERVISOR_TOKEN is missing", () => {
  assert.throws(
    () =>
      resolveRuntimeConfig({
        HA_GATEKEEPER_ADDON: "true",
        ADMIN_SESSION_SECRET: "session-secret",
        API_KEY_HASH_SECRET: "api-key-hash-secret"
      }),
    /SUPERVISOR_TOKEN/
  );
});
