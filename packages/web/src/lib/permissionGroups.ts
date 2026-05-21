import type { TokenPermission } from "../api";

export type ServicePermissionGroup = {
  id: string;
  kind: "service";
  domain: string;
  services: string[];
  entityIds: string[];
  allowNoEntity: boolean;
};

export type StatePermissionGroup = {
  id: "state";
  kind: "state";
  entityIds: string[];
};

export type PermissionGroup = ServicePermissionGroup | StatePermissionGroup;

export type AccessSummary = {
  domainCount: number;
  serviceCount: number;
  entityCount: number;
  lines: string[];
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function joinWords(values: string[]): string {
  if (values.length === 0) {
    return "";
  }
  if (values.length === 1) {
    return values[0];
  }
  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}

export function createDefaultGroups(): PermissionGroup[] {
  return [
    {
      id: "light",
      kind: "service",
      domain: "light",
      services: ["turn_on", "turn_off"],
      entityIds: [],
      allowNoEntity: false
    }
  ];
}

export function permissionsToGroups(permissions: TokenPermission[]): PermissionGroup[] {
  const serviceGroups = new Map<string, ServicePermissionGroup>();
  const stateEntityIds: string[] = [];

  for (const permission of permissions) {
    if (permission.kind === "state") {
      stateEntityIds.push(...permission.entityIds);
      continue;
    }

    const existing = serviceGroups.get(permission.domain);
    if (existing) {
      existing.services = unique([...existing.services, ...permission.services]);
      existing.entityIds = unique([...existing.entityIds, ...permission.entityIds]);
      existing.allowNoEntity = existing.allowNoEntity || Boolean(permission.allowNoEntity);
      continue;
    }

    serviceGroups.set(permission.domain, {
      id: permission.domain,
      kind: "service",
      domain: permission.domain,
      services: unique(permission.services),
      entityIds: unique(permission.entityIds),
      allowNoEntity: Boolean(permission.allowNoEntity)
    });
  }

  const groups: PermissionGroup[] = Array.from(serviceGroups.values()).sort((a, b) =>
    a.domain.localeCompare(b.domain)
  );

  const uniqueStateEntityIds = unique(stateEntityIds);
  if (uniqueStateEntityIds.length > 0) {
    groups.push({ id: "state", kind: "state", entityIds: uniqueStateEntityIds });
  }

  return groups.length > 0 ? groups : createDefaultGroups();
}

export function groupsToPermissions(groups: PermissionGroup[]): TokenPermission[] {
  return groups.flatMap((group): TokenPermission[] => {
    if (group.kind === "state") {
      return group.entityIds.length > 0 ? [{ kind: "state", entityIds: unique(group.entityIds) }] : [];
    }

    const hasTarget = group.allowNoEntity || group.entityIds.length > 0;
    if (!group.domain || group.services.length === 0 || !hasTarget) {
      return [];
    }

    return [
      {
        kind: "service",
        domain: group.domain,
        services: unique(group.services),
        entityIds: unique(group.entityIds),
        allowNoEntity: group.allowNoEntity
      }
    ];
  });
}

export function groupIsComplete(group: PermissionGroup): boolean {
  if (group.kind === "state") {
    return group.entityIds.length > 0;
  }

  return (
    Boolean(group.domain) &&
    group.services.length > 0 &&
    (group.allowNoEntity || group.entityIds.length > 0)
  );
}

export function groupsAreComplete(groups: PermissionGroup[]): boolean {
  return groups.length > 0 && groups.every(groupIsComplete);
}

export function buildAccessSummary(groups: PermissionGroup[]): AccessSummary {
  const serviceGroups = groups.filter(
    (group): group is ServicePermissionGroup => group.kind === "service"
  );
  const stateGroup = groups.find((group): group is StatePermissionGroup => group.kind === "state");
  const entityIds = unique(groups.flatMap((group) => group.entityIds));
  const lines: string[] = [];

  for (const group of serviceGroups) {
    if (group.services.length > 0) {
      lines.push(`Control selected ${group.domain} entities with ${joinWords(group.services)}.`);
    }
  }

  if (stateGroup && stateGroup.entityIds.length > 0) {
    lines.push("Read selected entity states.");
  }

  return {
    domainCount: serviceGroups.length,
    serviceCount: serviceGroups.reduce((total, group) => total + group.services.length, 0),
    entityCount: entityIds.length,
    lines
  };
}
