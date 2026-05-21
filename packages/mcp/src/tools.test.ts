import assert from "node:assert/strict";
import test from "node:test";

import { createToolHandlers } from "./tools.ts";
import type { ServiceCallInput, StateReadInput } from "./gatekeeperClient.ts";

test("ha_list_capabilities returns readable capability text", async () => {
  const handlers = createToolHandlers({
    async listCapabilities() {
      return {
        ok: true,
        client: { name: "Living Room Agent" },
        capabilities: {
          serviceActions: [
            {
              domain: "light",
              service: "turn_on",
              entityIds: ["light.living_room"],
              allowNoEntity: false,
            },
          ],
          stateReads: ["sensor.living_room_temperature"],
          unsupportedTargets: ["area_id", "device_id", "floor_id", "label_id"],
        },
      };
    },
    async callService() {
      throw new Error("unexpected call");
    },
    async readState() {
      throw new Error("unexpected call");
    },
  });

  const result = await handlers.ha_list_capabilities({});

  assert.equal(result.isError, false);
  assert.equal(result.content[0]?.type, "text");
  assert.match(result.content[0]?.text ?? "", /Living Room Agent/);
  assert.match(result.content[0]?.text ?? "", /light\.turn_on/);
  assert.match(result.content[0]?.text ?? "", /sensor\.living_room_temperature/);
});

test("ha_call_service rejects unsupported target selectors before HTTP", async () => {
  let calls = 0;
  const handlers = createToolHandlers({
    async listCapabilities() {
      return {};
    },
    async callService() {
      calls += 1;
      return {};
    },
    async readState() {
      return {};
    },
  });

  const result = await handlers.ha_call_service({
    domain: "light",
    service: "turn_on",
    data: { area_id: "kitchen" },
  });

  assert.equal(calls, 0);
  assert.equal(result.isError, true);
  assert.match(result.content[0]?.text ?? "", /Unsupported target selector/);
});

test("ha_call_service rejects top-level unsupported target selectors before HTTP", async () => {
  let calls = 0;
  const handlers = createToolHandlers({
    async listCapabilities() {
      return {};
    },
    async callService() {
      calls += 1;
      return {};
    },
    async readState() {
      return {};
    },
  });

  const result = await handlers.ha_call_service({
    domain: "light",
    service: "turn_on",
    area_id: "kitchen",
  } as ServiceCallInput);

  assert.equal(calls, 0);
  assert.equal(result.isError, true);
  assert.match(result.content[0]?.text ?? "", /Unsupported target selector/);
  assert.match(result.content[0]?.text ?? "", /area_id/);
});

test("ha_call_service rejects nested target selectors before HTTP", async () => {
  let calls = 0;
  const handlers = createToolHandlers({
    async listCapabilities() {
      return {};
    },
    async callService() {
      calls += 1;
      return {};
    },
    async readState() {
      return {};
    },
  });

  const result = await handlers.ha_call_service({
    domain: "light",
    service: "turn_on",
    data: {
      target: {
        area_id: "kitchen",
      },
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.isError, true);
  assert.match(result.content[0]?.text ?? "", /Unsupported target selector/);
  assert.match(result.content[0]?.text ?? "", /area_id/);
});

test("ha_call_service forwards service calls to client", async () => {
  let captured: ServiceCallInput | undefined;
  const handlers = createToolHandlers({
    async listCapabilities() {
      return {};
    },
    async callService(input) {
      captured = input;
      return { ok: true };
    },
    async readState() {
      return {};
    },
  });

  const input = {
    domain: "light",
    service: "turn_on",
    entity_id: "light.living_room",
    data: { brightness: 120 },
  };
  const result = await handlers.ha_call_service(input);

  assert.deepEqual(captured, input);
  assert.equal(result.isError, false);
  assert.match(result.content[0]?.text ?? "", /ok/);
});

test("ha_read_state forwards state reads and formats errors", async () => {
  let captured: StateReadInput | undefined;
  const handlers = createToolHandlers({
    async listCapabilities() {
      return {};
    },
    async callService() {
      return {};
    },
    async readState(input) {
      captured = input;
      throw new Error('{"status":403,"body":{"error":"entity_not_allowed"}}');
    },
  });

  const result = await handlers.ha_read_state({ entity_id: "sensor.denied" });

  assert.deepEqual(captured, { entity_id: "sensor.denied" });
  assert.equal(result.isError, true);
  assert.match(result.content[0]?.text ?? "", /entity_not_allowed/);
  assert.match(result.content[0]?.text ?? "", /sensor\.denied/);
});

test("ha_read_state rejects top-level unsupported target selectors before HTTP", async () => {
  let calls = 0;
  const handlers = createToolHandlers({
    async listCapabilities() {
      return {};
    },
    async callService() {
      return {};
    },
    async readState() {
      calls += 1;
      return {};
    },
  });

  const result = await handlers.ha_read_state({
    entity_id: "sensor.x",
    area_id: "kitchen",
  } as StateReadInput);

  assert.equal(calls, 0);
  assert.equal(result.isError, true);
  assert.match(result.content[0]?.text ?? "", /Unsupported target selector/);
  assert.match(result.content[0]?.text ?? "", /area_id/);
});
