import type { ServiceCallInput, StateReadInput } from "./gatekeeperClient.js";

export type GatekeeperToolClient = {
  listCapabilities(): Promise<unknown>;
  callService(input: ServiceCallInput): Promise<unknown>;
  readState(input: StateReadInput): Promise<unknown>;
};

export type ToolResult = {
  isError: boolean;
  content: [{ type: "text"; text: string }];
};

export function createToolHandlers(client: GatekeeperToolClient): {
  ha_list_capabilities(input: Record<string, never>): Promise<ToolResult>;
  ha_call_service(input: ServiceCallInput): Promise<ToolResult>;
  ha_read_state(input: StateReadInput): Promise<ToolResult>;
} {
  return {
    async ha_list_capabilities() {
      try {
        const capabilities = await client.listCapabilities();
        return textResult(false, formatCapabilities(capabilities));
      } catch (error) {
        return textResult(true, `Failed to list Gatekeeper capabilities: ${formatError(error)}`);
      }
    },

    async ha_call_service(input) {
      const unsupportedSelector =
        findUnsupportedTargetSelector(input) ?? findUnsupportedTargetSelector(input.data);
      if (unsupportedSelector) {
        return textResult(
          true,
          `Unsupported target selector: ${unsupportedSelector}. Use entity_id for MCP service calls.`,
        );
      }

      try {
        const response = await client.callService(input);
        return textResult(false, `Service call succeeded: ${formatUnknown(response)}`);
      } catch (error) {
        return textResult(
          true,
          `Failed to call service ${input.domain}.${input.service}: ${formatError(error)}`,
        );
      }
    },

    async ha_read_state(input) {
      const unsupportedSelector = findUnsupportedTargetSelector(input);
      if (unsupportedSelector) {
        return textResult(
          true,
          `Unsupported target selector: ${unsupportedSelector}. Use entity_id for MCP state reads.`,
        );
      }

      try {
        const response = await client.readState(input);
        return textResult(false, `State for ${input.entity_id}: ${formatUnknown(response)}`);
      } catch (error) {
        return textResult(
          true,
          `Failed to read state for ${input.entity_id}: ${formatError(error)}`,
        );
      }
    },
  };
}

function textResult(isError: boolean, text: string): ToolResult {
  return {
    isError,
    content: [{ type: "text", text }],
  };
}

function findUnsupportedTargetSelector(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const directSelector = ["area_id", "device_id", "floor_id", "label_id"].find((selector) =>
    Object.prototype.hasOwnProperty.call(value, selector),
  );
  if (directSelector) {
    return directSelector;
  }

  return findUnsupportedTargetSelector(value.target);
}

function formatCapabilities(capabilities: unknown): string {
  if (!isRecord(capabilities)) {
    return formatUnknown(capabilities);
  }

  const lines = ["Gatekeeper capabilities:"];
  const client = capabilities.client;
  if (isRecord(client) && typeof client.name === "string") {
    lines.push(`Client: ${client.name}`);
  }

  const capabilitySet = capabilities.capabilities;
  if (isRecord(capabilitySet)) {
    if (Array.isArray(capabilitySet.serviceActions) && capabilitySet.serviceActions.length > 0) {
      lines.push("Service actions:");
      for (const action of capabilitySet.serviceActions) {
        if (!isRecord(action)) {
          continue;
        }

        const domain = typeof action.domain === "string" ? action.domain : undefined;
        const service = typeof action.service === "string" ? action.service : undefined;
        if (!domain || !service) {
          continue;
        }

        const entityIds = Array.isArray(action.entityIds)
          ? action.entityIds.filter((entityId): entityId is string => typeof entityId === "string")
          : [];
        const suffix = entityIds.length > 0 ? ` (${entityIds.join(", ")})` : "";
        lines.push(`- ${domain}.${service}${suffix}`);
      }
    }

    if (Array.isArray(capabilitySet.stateReads) && capabilitySet.stateReads.length > 0) {
      lines.push("State reads:");
      for (const entityId of capabilitySet.stateReads) {
        if (typeof entityId === "string") {
          lines.push(`- ${entityId}`);
        }
      }
    }
  }

  lines.push("Raw response:");
  lines.push(formatUnknown(capabilities));
  return lines.join("\n");
}

function formatUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : formatUnknown(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
