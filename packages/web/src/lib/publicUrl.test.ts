import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuickStartPage } from "../pages/QuickStartPage.js";
import { TokensPage } from "../pages/TokensPage.js";
import type { Client, TokenPermission } from "../api.js";

const publicApiBaseUrl = "https://gatekeeper.example.com";
const client: Client = {
  id: "client-fixture", name: "Remote agent", status: "active", apiKeyPrefix: "fixture",
  createdAt: "2026-10-12T00:00:00Z",
  permissions: [{ kind: "service", domain: "light", services: ["turn_on"], entityIds: ["light.living_room"] }]
};

function issuedPage(permissions: TokenPermission[]) {
  return renderToStaticMarkup(createElement(QuickStartPage, {
    entities: [], services: [], isLoadingEntities: false, hasEntityError: false,
    onRetryEntities() {}, onCreate() {}, onClearResult() {}, isSubmitting: false,
    hasSubmitError: false,
    result: { client: { ...client, permissions }, apiKey: "scoped-fixture" }, publicApiBaseUrl
  }));
}

test("issued service token displays an absolute public API example and bundle URL", () => {
  const html = issuedPage(client.permissions);
  assert.ok(html.includes(`${publicApiBaseUrl}/api/services/light/turn_on`));
  assert.ok(html.includes(`value="${publicApiBaseUrl}"`));
});

test("issued state token displays an absolute public API example", () => {
  const html = issuedPage([{ kind: "state", entityIds: ["sensor.temperature"] }]);
  assert.ok(html.includes(`${publicApiBaseUrl}/api/states/sensor.temperature`));
});

test("existing tokens default their editable bundle URL to the configured public origin", () => {
  const html = renderToStaticMarkup(createElement(TokensPage, {
    clients: [client], entities: [], services: [], issuedKey: null,
    isLoading: false, hasError: false, onRetry() {}, onCreate() {},
    isMutating: false, mutationError: null, canEditPermissions: true,
    onRotate() {}, onDelete() {}, async onSavePermissions() {}, publicApiBaseUrl
  }));
  assert.ok(html.includes(`value="${publicApiBaseUrl}"`));
});
