import assert from "node:assert/strict";
import test from "node:test";
import { buildTokenAccessPlan } from "./tokenAccess.js";

test("builds a token plan with multiple service and state permissions", () => {
  const plan = buildTokenAccessPlan({
    name: "Mom access",
    permissions: [
      {
        kind: "service",
        domain: "light",
        services: ["turn_on", "turn_off"],
        entityIds: ["light.living_room"]
      },
      {
        kind: "service",
        domain: "switch",
        services: ["turn_on", "turn_off"],
        entityIds: ["switch.bathroom_fan"]
      },
      {
        kind: "state",
        entityIds: ["binary_sensor.window_contact"]
      }
    ]
  });

  assert.equal(plan.clientName, "Mom access");
  assert.equal(plan.permissions.length, 3);
  assert.deepEqual(plan.permissions[0], {
    kind: "service",
    domain: "light",
    services: JSON.stringify(["turn_on", "turn_off"]),
    entityIds: JSON.stringify(["light.living_room"]),
    allowNoEntity: false
  });
  assert.deepEqual(plan.permissions[2], {
    kind: "state",
    domain: null,
    services: JSON.stringify([]),
    entityIds: JSON.stringify(["binary_sensor.window_contact"]),
    allowNoEntity: false
  });
});

test("uses a readable default token name", () => {
  const plan = buildTokenAccessPlan({
    permissions: [
      {
        kind: "state",
        entityIds: ["binary_sensor.window_contact"]
      }
    ]
  });

  assert.equal(plan.clientName, "Home Assistant access token");
});
