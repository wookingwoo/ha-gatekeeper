import { parsePermission, type TokenPermissionRecord } from "./permissions.js";

export type AgentServiceAction = {
  domain: string;
  service: string;
  entityIds: string[];
  allowNoEntity: boolean;
};

export type AgentCapabilities = {
  serviceActions: AgentServiceAction[];
  stateReads: string[];
  unsupportedTargets: string[];
};

const unsupportedTargets = ["area_id", "device_id", "floor_id", "label_id"];

type ServiceAccumulator = {
  domain: string;
  service: string;
  entityIds: Set<string>;
  allowNoEntity: boolean;
};

export function projectCapabilities(records: TokenPermissionRecord[]): AgentCapabilities {
  const serviceActions = new Map<string, ServiceAccumulator>();
  const stateReads = new Set<string>();

  for (const record of records) {
    const permission = parsePermission(record);
    if (!permission) {
      continue;
    }

    if (permission.kind === "state") {
      for (const entityId of permission.entityIds) {
        stateReads.add(entityId);
      }
      continue;
    }

    for (const service of permission.services) {
      const key = `${permission.domain}.${service}`;
      let action = serviceActions.get(key);
      if (!action) {
        action = {
          domain: permission.domain,
          service,
          entityIds: new Set<string>(),
          allowNoEntity: false
        };
        serviceActions.set(key, action);
      }

      for (const entityId of permission.entityIds) {
        action.entityIds.add(entityId);
      }
      action.allowNoEntity = action.allowNoEntity || permission.allowNoEntity;
    }
  }

  return {
    serviceActions: Array.from(serviceActions.values())
      .map((action) => ({
        domain: action.domain,
        service: action.service,
        entityIds: Array.from(action.entityIds).sort(),
        allowNoEntity: action.allowNoEntity
      }))
      .sort((left, right) =>
        `${left.domain}.${left.service}`.localeCompare(`${right.domain}.${right.service}`)
      ),
    stateReads: Array.from(stateReads).sort(),
    unsupportedTargets: [...unsupportedTargets]
  };
}
