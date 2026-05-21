import assert from "node:assert/strict";
import test from "node:test";
import { projectCapabilities } from "./capabilities.js";
import type { TokenPermissionRecord } from "./permissions.js";

test("projects service and state permissions into agent capabilities", () => {
  const records: TokenPermissionRecord[] = [
    {
      id: "perm_light",
      kind: "service",
      domain: "light",
      services: JSON.stringify(["turn_off", "turn_on", "turn_on"]),
      entityIds: JSON.stringify(["light.kitchen", "light.entry", "light.entry"]),
      allowNoEntity: false
    },
    {
      id: "perm_script",
      kind: "service",
      domain: "script",
      services: JSON.stringify(["turn_on"]),
      entityIds: JSON.stringify([]),
      allowNoEntity: true
    },
    {
      id: "perm_state",
      kind: "state",
      domain: null,
      services: JSON.stringify([]),
      entityIds: JSON.stringify(["sensor.outdoor_temperature", "sensor.outdoor_temperature"]),
      allowNoEntity: false
    }
  ];

  assert.deepEqual(projectCapabilities(records), {
    serviceActions: [
      {
        domain: "light",
        service: "turn_off",
        entityIds: ["light.entry", "light.kitchen"],
        allowNoEntity: false
      },
      {
        domain: "light",
        service: "turn_on",
        entityIds: ["light.entry", "light.kitchen"],
        allowNoEntity: false
      },
      {
        domain: "script",
        service: "turn_on",
        entityIds: [],
        allowNoEntity: true
      }
    ],
    stateReads: ["sensor.outdoor_temperature"],
    unsupportedTargets: ["area_id", "device_id", "floor_id", "label_id"]
  });
});

test("merges duplicate service actions by domain and service", () => {
  const records: TokenPermissionRecord[] = [
    {
      id: "perm_light_kitchen",
      kind: "service",
      domain: "light",
      services: JSON.stringify(["turn_on"]),
      entityIds: JSON.stringify(["light.kitchen"]),
      allowNoEntity: false
    },
    {
      id: "perm_light_hallway",
      kind: "service",
      domain: "light",
      services: JSON.stringify(["turn_on"]),
      entityIds: JSON.stringify(["light.hallway"]),
      allowNoEntity: true
    }
  ];

  assert.deepEqual(projectCapabilities(records).serviceActions, [
    {
      domain: "light",
      service: "turn_on",
      entityIds: ["light.hallway", "light.kitchen"],
      allowNoEntity: true
    }
  ]);
});

test("ignores malformed permission records instead of widening capabilities", () => {
  const records: TokenPermissionRecord[] = [
    {
      id: "perm_malformed",
      kind: "service",
      domain: "light",
      services: "not-json",
      entityIds: JSON.stringify(["light.kitchen"]),
      allowNoEntity: true
    },
    {
      id: "perm_safe",
      kind: "state",
      domain: null,
      services: JSON.stringify([]),
      entityIds: JSON.stringify(["sensor.safe"]),
      allowNoEntity: false
    }
  ];

  assert.deepEqual(projectCapabilities(records), {
    serviceActions: [],
    stateReads: ["sensor.safe"],
    unsupportedTargets: ["area_id", "device_id", "floor_id", "label_id"]
  });
});
