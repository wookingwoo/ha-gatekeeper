import assert from "node:assert/strict";
import test from "node:test";
import { resolveApiPath } from "../api.js";

test("keeps root API paths unchanged for local development", () => {
  assert.equal(resolveApiPath("/admin/me", "/"), "/admin/me");
  assert.equal(resolveApiPath("/api/capabilities", "/"), "/api/capabilities");
});

test("prefixes API paths with the Home Assistant ingress base path", () => {
  assert.equal(
    resolveApiPath("/admin/me", "/api/hassio_ingress/abc123/"),
    "/api/hassio_ingress/abc123/admin/me"
  );
  assert.equal(
    resolveApiPath("/api/capabilities", "/api/hassio_ingress/abc123"),
    "/api/hassio_ingress/abc123/api/capabilities"
  );
});

test("leaves non-root-relative paths untouched", () => {
  assert.equal(
    resolveApiPath("https://example.test/admin/me", "/api/hassio_ingress/abc123/"),
    "https://example.test/admin/me"
  );
  assert.equal(resolveApiPath("admin/me", "/api/hassio_ingress/abc123/"), "admin/me");
});
