import assert from "node:assert/strict";
import test from "node:test";
import {
  findAllowedServicePermission,
  findAllowedStatePermission,
  parsePermission,
  serializePermission
} from "./permissions.js";

const livingRoomControl = {
  id: "perm_living_room",
  kind: "service",
  domain: "light",
  services: JSON.stringify(["turn_on", "turn_off"]),
  entityIds: JSON.stringify(["light.living_room"]),
  allowNoEntity: false
};

const windowState = {
  id: "perm_window",
  kind: "state",
  domain: null,
  services: JSON.stringify([]),
  entityIds: JSON.stringify(["binary_sensor.window_contact"]),
  allowNoEntity: false
};

test("parses a service permission rule", () => {
  const parsed = parsePermission(livingRoomControl);

  assert.deepEqual(parsed, {
    id: "perm_living_room",
    kind: "service",
    domain: "light",
    services: ["turn_on", "turn_off"],
    entityIds: ["light.living_room"],
    allowNoEntity: false
  });
});

test("allows a matching service and entity", () => {
  const match = findAllowedServicePermission(
    [livingRoomControl],
    "light",
    "turn_on",
    ["light.living_room"]
  );

  assert.equal(match.ok, true);
  assert.equal(match.ok ? match.permission.id : "", "perm_living_room");
});

test("blocks a service call for an entity outside the permission", () => {
  const match = findAllowedServicePermission(
    [livingRoomControl],
    "light",
    "turn_on",
    ["light.bedroom"]
  );

  assert.deepEqual(match, { ok: false, error: "entity_not_allowed" });
});

test("blocks a service that is not listed in the permission", () => {
  const match = findAllowedServicePermission(
    [livingRoomControl],
    "light",
    "toggle",
    ["light.living_room"]
  );

  assert.deepEqual(match, { ok: false, error: "forbidden" });
});

test("allows state reads for explicitly listed entities", () => {
  const match = findAllowedStatePermission([windowState], "binary_sensor.window_contact");

  assert.equal(match.ok, true);
  assert.equal(match.ok ? match.permission.id : "", "perm_window");
});

test("blocks state reads outside the permission", () => {
  const match = findAllowedStatePermission([windowState], "binary_sensor.front_door");

  assert.deepEqual(match, { ok: false, error: "entity_not_allowed" });
});

test("blocks state reads when the client has no state permission at all", () => {
  const match = findAllowedStatePermission([livingRoomControl], "binary_sensor.front_door");

  assert.deepEqual(match, { ok: false, error: "forbidden" });
});

test("serializes a service permission for storage", () => {
  assert.deepEqual(
    serializePermission({
      kind: "service",
      domain: "switch",
      services: ["turn_on", "turn_off"],
      entityIds: ["switch.bathroom_fan"]
    }),
    {
      kind: "service",
      domain: "switch",
      services: JSON.stringify(["turn_on", "turn_off"]),
      entityIds: JSON.stringify(["switch.bathroom_fan"]),
      allowNoEntity: false
    }
  );
});

test("serializes a state permission for storage", () => {
  assert.deepEqual(
    serializePermission({
      kind: "state",
      entityIds: ["binary_sensor.window_contact"]
    }),
    {
      kind: "state",
      domain: null,
      services: JSON.stringify([]),
      entityIds: JSON.stringify(["binary_sensor.window_contact"]),
      allowNoEntity: false
    }
  );
});
