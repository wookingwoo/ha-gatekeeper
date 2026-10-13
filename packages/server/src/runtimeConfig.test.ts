import assert from "node:assert/strict";
import test from "node:test";
import { resolveRuntimeConfig } from "./runtimeConfig.js";

const tunnelAddonConfig = {
  HA_GATEKEEPER_ADDON: "true",
  SUPERVISOR_TOKEN: "supervisor-token",
  ADMIN_SESSION_SECRET: "session-secret",
  API_KEY_HASH_SECRET: "api-key-hash-secret"
};

test("Cloudflare Tunnel is disabled by default without changing LAN exposure", () => {
  const config = resolveRuntimeConfig(tunnelAddonConfig);
  assert.equal(config.CLOUDFLARE_TUNNEL_ENABLED, false);
  assert.equal(config.CLOUDFLARE_PUBLIC_URL, "");
  assert.equal(config.ADDON_EXPOSE_API, false);
});

test("enabled tunnel validates credentials and normalizes the public HTTPS origin", () => {
  const config = resolveRuntimeConfig({
    ...tunnelAddonConfig,
    CLOUDFLARE_TUNNEL_ENABLED: "true",
    CLOUDFLARE_TUNNEL_TOKEN: " tunnel-token ",
    CLOUDFLARE_PUBLIC_URL: " https://gatekeeper.example.com/ "
  });
  assert.equal(config.CLOUDFLARE_TUNNEL_TOKEN, "tunnel-token");
  assert.equal(config.CLOUDFLARE_PUBLIC_URL, "https://gatekeeper.example.com");
  assert.equal(config.ADDON_EXPOSE_API, false);
});

test("enabled tunnel rejects missing credentials and unsafe public origins", () => {
  const enabled = { ...tunnelAddonConfig, CLOUDFLARE_TUNNEL_ENABLED: "true" };
  assert.throws(() => resolveRuntimeConfig(enabled), /CLOUDFLARE_TUNNEL_TOKEN/);
  for (const origin of ["", "http://gatekeeper.example.com", "https://user:pass@example.com", "https://example.com/api", "https://example.com?token=x", "https://example.com#fragment"]) {
    assert.throws(() => resolveRuntimeConfig({
      ...enabled,
      CLOUDFLARE_TUNNEL_TOKEN: "tunnel-token",
      CLOUDFLARE_PUBLIC_URL: origin
    }), /CLOUDFLARE_PUBLIC_URL/);
  }
  assert.throws(() => resolveRuntimeConfig({
    ...enabled,
    CLOUDFLARE_TUNNEL_TOKEN: "secret\nsecond-line",
    CLOUDFLARE_PUBLIC_URL: "https://gatekeeper.example.com"
  }), /CLOUDFLARE_TUNNEL_TOKEN/);
});

test("disabled tunnel ignores stale Cloudflare settings", () => {
  const config = resolveRuntimeConfig({
    ...tunnelAddonConfig,
    CLOUDFLARE_TUNNEL_TOKEN: "unused-secret",
    CLOUDFLARE_PUBLIC_URL: "http://unused.invalid"
  });
  assert.equal(config.CLOUDFLARE_TUNNEL_TOKEN, "");
  assert.equal(config.CLOUDFLARE_PUBLIC_URL, "");
});

test("standalone mode rejects enabling the Add-on tunnel", () => {
  assert.throws(() => resolveRuntimeConfig({
    HA_BASE_URL: "http://127.0.0.1:8123",
    HA_TOKEN: "ha-token",
    ADMIN_PASSWORD: "admin-password",
    ADMIN_SESSION_SECRET: "session-secret",
    API_KEY_HASH_SECRET: "api-key-hash-secret",
    CLOUDFLARE_TUNNEL_ENABLED: "true",
    CLOUDFLARE_TUNNEL_TOKEN: "tunnel-token",
    CLOUDFLARE_PUBLIC_URL: "https://gatekeeper.example.com"
  }), /[Aa]dd-on/);
});

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
    LOG_LEVEL: "debug",
    AUDIT_LOG_RETENTION_DAYS: 90,
    PUBLIC_API_IP_RATE_LIMIT: 300,
    CLOUDFLARE_TUNNEL_ENABLED: false,
    CLOUDFLARE_TUNNEL_TOKEN: "",
    CLOUDFLARE_PUBLIC_URL: ""
  });
});

test("AUDIT_LOG_RETENTION_DAYS defaults to 90 and accepts an explicit override", () => {
  assert.equal(resolveRuntimeConfig(validStandaloneEnv).AUDIT_LOG_RETENTION_DAYS, 90);
  assert.equal(
    resolveRuntimeConfig({ ...validStandaloneEnv, AUDIT_LOG_RETENTION_DAYS: "30" }).AUDIT_LOG_RETENTION_DAYS,
    30
  );
  assert.equal(
    resolveRuntimeConfig({ ...validStandaloneEnv, AUDIT_LOG_RETENTION_DAYS: "0" }).AUDIT_LOG_RETENTION_DAYS,
    0
  );
});

test("add-on mode uses supervisor core API and SUPERVISOR_TOKEN", () => {
  const env = resolveRuntimeConfig({
    HA_GATEKEEPER_ADDON: "true",
    SUPERVISOR_TOKEN: "supervisor-token",
    ADMIN_SESSION_SECRET: "session-secret",
    API_KEY_HASH_SECRET: "api-key-hash-secret"
  });

  assert.equal(env.HA_BASE_URL, "http://supervisor/core");
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

 test("public IP budget defaults to 300 and validates positive integers", () => {
  assert.equal(resolveRuntimeConfig(validStandaloneEnv).PUBLIC_API_IP_RATE_LIMIT, 300);
  assert.equal(resolveRuntimeConfig({...validStandaloneEnv, PUBLIC_API_IP_RATE_LIMIT: "7"}).PUBLIC_API_IP_RATE_LIMIT, 7);
  for (const value of ["0", "-1", "1.5", "NaN", ""]) {
    assert.throws(() => resolveRuntimeConfig({...validStandaloneEnv, PUBLIC_API_IP_RATE_LIMIT: value}), /PUBLIC_API_IP_RATE_LIMIT/);
  }
});
