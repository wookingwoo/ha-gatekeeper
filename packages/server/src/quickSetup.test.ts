import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQuickSetupPlan,
  getQuickSetupDefinition,
  makeTokenName
} from "./quickSetup.js";

test("maps light setup to light services", () => {
  const definition = getQuickSetupDefinition("control_lights");
  assert.equal(definition.domain, "light");
  assert.deepEqual(definition.services, ["turn_on", "turn_off", "toggle"]);
});

test("maps switch setup to switch services", () => {
  const definition = getQuickSetupDefinition("control_switches");
  assert.equal(definition.domain, "switch");
  assert.deepEqual(definition.services, ["turn_on", "turn_off"]);
});

test("maps script setup to script.turn_on", () => {
  const definition = getQuickSetupDefinition("run_scripts");
  assert.equal(definition.domain, "script");
  assert.deepEqual(definition.services, ["turn_on"]);
});

test("rejects target entity outside selected domain", () => {
  assert.throws(
    () =>
      buildQuickSetupPlan({
        useCase: "control_lights",
        targetEntityIds: ["switch.kitchen"],
        tokenName: "Kitchen"
      }),
    /target_domain_mismatch/
  );
});

test("builds one policy per allowed service", () => {
  const plan = buildQuickSetupPlan({
    useCase: "control_lights",
    targetEntityIds: ["light.desk", "light.sofa"],
    tokenName: "Living room lights"
  });

  assert.equal(plan.roleName, "quick-living-room-lights");
  assert.equal(plan.clientName, "Living room lights");
  assert.deepEqual(
    plan.actions.map((action) => action.haCall.service),
    ["turn_on", "turn_off", "toggle"]
  );
  assert.deepEqual(plan.actions[0].haCall.entityIds, ["light.desk", "light.sofa"]);
});

test("generates a readable default token name", () => {
  assert.equal(makeTokenName("control_lights", ["light.living_room"]), "Control lights token");
});
