import assert from "node:assert/strict";
import test from "node:test";
import { asServiceRequestBody, extractRequestedEntityIds } from "./policy.js";

test("asServiceRequestBody treats undefined and null as an empty body", () => {
  assert.deepEqual(asServiceRequestBody(undefined), {});
  assert.deepEqual(asServiceRequestBody(null), {});
});

test("asServiceRequestBody passes through a plain object", () => {
  const body = { entity_id: "light.kitchen" };
  assert.equal(asServiceRequestBody(body), body);
});

test("asServiceRequestBody rejects non-object bodies", () => {
  assert.equal(asServiceRequestBody([1, 2, 3]), null);
  assert.equal(asServiceRequestBody("light.kitchen"), null);
  assert.equal(asServiceRequestBody(123), null);
});

test("extractRequestedEntityIds allows an empty body with no entity ids", () => {
  assert.deepEqual(extractRequestedEntityIds({}), { ok: true, entityIds: [] });
});

test("extractRequestedEntityIds reads a single entity_id string", () => {
  assert.deepEqual(extractRequestedEntityIds({ entity_id: "light.kitchen" }), {
    ok: true,
    entityIds: ["light.kitchen"]
  });
});

test("extractRequestedEntityIds splits a comma-separated entity_id string", () => {
  const result = extractRequestedEntityIds({ entity_id: "light.a, light.b" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok ? result.entityIds.sort() : [], ["light.a", "light.b"]);
});

test("extractRequestedEntityIds reads an array of entity ids", () => {
  const result = extractRequestedEntityIds({ entity_id: ["light.a", "light.b"] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok ? result.entityIds.sort() : [], ["light.a", "light.b"]);
});

test("extractRequestedEntityIds splits comma-separated values inside array items", () => {
  const result = extractRequestedEntityIds({ entity_id: ["light.a, light.b"] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok ? result.entityIds.sort() : [], ["light.a", "light.b"]);
});

test("extractRequestedEntityIds rejects a non-string array item", () => {
  assert.deepEqual(extractRequestedEntityIds({ entity_id: [123] }), {
    ok: false,
    error: "invalid_entity_id"
  });
});

test("extractRequestedEntityIds rejects a non-string, non-array entity_id", () => {
  assert.deepEqual(extractRequestedEntityIds({ entity_id: 123 }), {
    ok: false,
    error: "invalid_entity_id"
  });
});

for (const key of ["area_id", "device_id", "floor_id", "label_id"]) {
  test(`extractRequestedEntityIds rejects top-level ${key}`, () => {
    assert.deepEqual(extractRequestedEntityIds({ [key]: "some-value" }), {
      ok: false,
      error: "unsupported_target"
    });
  });

  test(`extractRequestedEntityIds rejects ${key} nested under target`, () => {
    assert.deepEqual(extractRequestedEntityIds({ target: { [key]: "some-value" } }), {
      ok: false,
      error: "unsupported_target"
    });
  });
}

test("extractRequestedEntityIds rejects a non-object target", () => {
  assert.deepEqual(extractRequestedEntityIds({ target: "light.kitchen" }), {
    ok: false,
    error: "invalid_target"
  });
});

test("extractRequestedEntityIds reads entity ids nested under target", () => {
  const result = extractRequestedEntityIds({ target: { entity_id: "light.kitchen" } });
  assert.deepEqual(result, { ok: true, entityIds: ["light.kitchen"] });
});

test("extractRequestedEntityIds rejects a non-string entity id nested under target", () => {
  assert.deepEqual(extractRequestedEntityIds({ target: { entity_id: [123] } }), {
    ok: false,
    error: "invalid_entity_id"
  });
});

test("extractRequestedEntityIds dedupes overlapping top-level and target entity ids", () => {
  const result = extractRequestedEntityIds({
    entity_id: "light.a",
    target: { entity_id: "light.a" }
  });
  assert.deepEqual(result, { ok: true, entityIds: ["light.a"] });
});

test("extractRequestedEntityIds merges distinct top-level and target entity ids", () => {
  const result = extractRequestedEntityIds({
    entity_id: "light.a",
    target: { entity_id: "light.b" }
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok ? result.entityIds.sort() : [], ["light.a", "light.b"]);
});

test("extractRequestedEntityIds checks top-level unsupported targets before entity_id validity", () => {
  const result = extractRequestedEntityIds({ area_id: "kitchen", entity_id: 123 });
  assert.deepEqual(result, { ok: false, error: "unsupported_target" });
});

test("extractRequestedEntityIds validates top-level entity_id before inspecting target", () => {
  const result = extractRequestedEntityIds({
    entity_id: 123,
    target: { area_id: "kitchen" }
  });
  assert.deepEqual(result, { ok: false, error: "invalid_entity_id" });
});
