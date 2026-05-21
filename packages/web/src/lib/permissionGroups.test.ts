import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAccessSummary,
  createDefaultGroups,
  groupsAreComplete,
  groupsToPermissions,
  permissionsToGroups
} from "./permissionGroups.js";
import type { TokenPermission } from "../api.js";

test("groups service permissions by domain and keeps state reads separate", () => {
  const permissions: TokenPermission[] = [
    {
      kind: "service",
      domain: "light",
      services: ["turn_on", "turn_off"],
      entityIds: ["light.kitchen", "light.hallway"]
    },
    {
      kind: "service",
      domain: "switch",
      services: ["turn_on"],
      entityIds: ["switch.fan"]
    },
    {
      kind: "state",
      entityIds: ["sensor.temperature"]
    }
  ];

  const groups = permissionsToGroups(permissions);

  assert.deepEqual(groups.map((group) => group.id), ["light", "switch", "state"]);
  assert.deepEqual(groups[0], {
    id: "light",
    kind: "service",
    domain: "light",
    services: ["turn_on", "turn_off"],
    entityIds: ["light.kitchen", "light.hallway"],
    allowNoEntity: false
  });
  assert.deepEqual(groups[2], {
    id: "state",
    kind: "state",
    entityIds: ["sensor.temperature"]
  });
});

test("serializes grouped permissions back to the API payload shape", () => {
  const permissions = groupsToPermissions([
    {
      id: "light",
      kind: "service",
      domain: "light",
      services: ["turn_on"],
      entityIds: ["light.kitchen"],
      allowNoEntity: false
    },
    {
      id: "state",
      kind: "state",
      entityIds: ["sensor.temperature"]
    }
  ]);

  assert.deepEqual(permissions, [
    {
      kind: "service",
      domain: "light",
      services: ["turn_on"],
      entityIds: ["light.kitchen"],
      allowNoEntity: false
    },
    {
      kind: "state",
      entityIds: ["sensor.temperature"]
    }
  ]);
});

test("drops incomplete service groups that cannot be submitted", () => {
  const permissions = groupsToPermissions([
    {
      id: "light",
      kind: "service",
      domain: "light",
      services: [],
      entityIds: ["light.kitchen"],
      allowNoEntity: false
    },
    {
      id: "switch",
      kind: "service",
      domain: "switch",
      services: ["turn_on"],
      entityIds: [],
      allowNoEntity: false
    }
  ]);

  assert.deepEqual(permissions, []);
});

test("creates a useful default light-control group", () => {
  assert.deepEqual(createDefaultGroups(), [
    {
      id: "light",
      kind: "service",
      domain: "light",
      services: ["turn_on", "turn_off"],
      entityIds: [],
      allowNoEntity: false
    }
  ]);
});

test("summarizes selected access in plain English", () => {
  const summary = buildAccessSummary([
    {
      id: "light",
      kind: "service",
      domain: "light",
      services: ["turn_on", "turn_off"],
      entityIds: ["light.kitchen", "light.hallway"],
      allowNoEntity: false
    },
    {
      id: "state",
      kind: "state",
      entityIds: ["sensor.temperature"]
    }
  ]);

  assert.equal(summary.domainCount, 1);
  assert.equal(summary.serviceCount, 2);
  assert.equal(summary.entityCount, 3);
  assert.deepEqual(summary.lines, [
    "Control selected light entities with turn_on and turn_off.",
    "Read selected entity states."
  ]);
});

test("detects incomplete draft groups before submission", () => {
  assert.equal(
    groupsAreComplete([
      {
        id: "light",
        kind: "service",
        domain: "light",
        services: ["turn_on"],
        entityIds: ["light.kitchen"],
        allowNoEntity: false
      },
      {
        id: "switch",
        kind: "service",
        domain: "switch",
        services: ["turn_on"],
        entityIds: [],
        allowNoEntity: false
      }
    ]),
    false
  );

  assert.equal(
    groupsAreComplete([
      {
        id: "light",
        kind: "service",
        domain: "light",
        services: ["turn_on"],
        entityIds: ["light.kitchen"],
        allowNoEntity: false
      },
      {
        id: "state",
        kind: "state",
        entityIds: ["sensor.temperature"]
      }
    ]),
    true
  );
});
