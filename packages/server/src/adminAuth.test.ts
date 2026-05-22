import assert from "node:assert/strict";
import test from "node:test";
import {
  isAdminAuthenticated,
  isPublicApiAllowed,
  isTrustedIngressRequest
} from "./adminAuth.js";

test("standalone admin authentication follows the session admin flag", () => {
  assert.equal(
    isAdminAuthenticated({
      addonMode: false,
      sessionAdmin: false,
      ip: "172.30.32.2",
      headers: { "x-ingress-path": "/api/hassio_ingress/token" }
    }),
    false
  );

  assert.equal(
    isAdminAuthenticated({
      addonMode: false,
      sessionAdmin: true,
      ip: null,
      headers: {}
    }),
    true
  );
});

test("trusted ingress requires addon mode, the supervisor IP, and an ingress header", () => {
  assert.equal(
    isTrustedIngressRequest({
      addonMode: true,
      ip: "172.30.32.2",
      headers: { "x-ingress-path": "/api/hassio_ingress/token" }
    }),
    true
  );

  assert.equal(
    isTrustedIngressRequest({
      addonMode: true,
      ip: "::ffff:172.30.32.2",
      headers: { "x-remote-user-id": ["user-id"] }
    }),
    true
  );

  assert.equal(
    isTrustedIngressRequest({
      addonMode: false,
      ip: "172.30.32.2",
      headers: { "x-ingress-path": "/api/hassio_ingress/token" }
    }),
    false
  );

  assert.equal(
    isTrustedIngressRequest({
      addonMode: true,
      ip: "172.30.32.3",
      headers: { "x-ingress-path": "/api/hassio_ingress/token" }
    }),
    false
  );

  assert.equal(
    isTrustedIngressRequest({
      addonMode: true,
      ip: "172.30.32.2",
      headers: {}
    }),
    false
  );
});

test("addon admin authentication allows an existing session or trusted ingress", () => {
  assert.equal(
    isAdminAuthenticated({
      addonMode: true,
      sessionAdmin: true,
      ip: "192.0.2.1",
      headers: {}
    }),
    true
  );

  assert.equal(
    isAdminAuthenticated({
      addonMode: true,
      sessionAdmin: false,
      ip: "172.30.32.2",
      headers: { "x-remote-user-id": "user-id" }
    }),
    true
  );

  assert.equal(
    isAdminAuthenticated({
      addonMode: true,
      sessionAdmin: false,
      ip: "192.0.2.1",
      headers: { "x-remote-user-id": "user-id" }
    }),
    false
  );
});

test("public API is blocked by default in addon mode and allowed otherwise", () => {
  assert.equal(isPublicApiAllowed({ addonMode: false, exposeApi: false }), true);
  assert.equal(isPublicApiAllowed({ addonMode: true, exposeApi: false }), false);
  assert.equal(isPublicApiAllowed({ addonMode: true, exposeApi: true }), true);
});
