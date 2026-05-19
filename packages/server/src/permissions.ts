export type PermissionKind = "service" | "state";

export type TokenPermissionRecord = {
  id: string;
  kind: string;
  domain: string | null;
  services: string;
  entityIds: string;
  allowNoEntity: boolean;
};

export type TokenPermissionRule =
  | {
      id: string;
      kind: "service";
      domain: string;
      services: string[];
      entityIds: string[];
      allowNoEntity: boolean;
    }
  | {
      id: string;
      kind: "state";
      domain: null;
      services: [];
      entityIds: string[];
      allowNoEntity: false;
    };

export type TokenPermissionInput =
  | {
      kind: "service";
      domain: string;
      services: string[];
      entityIds: string[];
      allowNoEntity?: boolean;
    }
  | {
      kind: "state";
      entityIds: string[];
    };

type ServicePermissionResult =
  | { ok: true; permission: Extract<TokenPermissionRule, { kind: "service" }> }
  | { ok: false; error: "forbidden" | "missing_entity_id" | "entity_not_allowed" };

type StatePermissionResult =
  | { ok: true; permission: Extract<TokenPermissionRule, { kind: "state" }> }
  | { ok: false; error: "entity_not_allowed" };

function parseStringArray(value: string): string[] | null {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed.every((item) => typeof item === "string") ? parsed : null;
  } catch {
    return null;
  }
}

export function serializePermission(input: TokenPermissionInput): Omit<TokenPermissionRecord, "id"> {
  if (input.kind === "state") {
    return {
      kind: "state",
      domain: null,
      services: JSON.stringify([]),
      entityIds: JSON.stringify(input.entityIds),
      allowNoEntity: false
    };
  }

  return {
    kind: "service",
    domain: input.domain,
    services: JSON.stringify(input.services),
    entityIds: JSON.stringify(input.entityIds),
    allowNoEntity: input.allowNoEntity ?? false
  };
}

export function parsePermission(record: TokenPermissionRecord): TokenPermissionRule | null {
  const entityIds = parseStringArray(record.entityIds);
  if (!entityIds) {
    return null;
  }

  if (record.kind === "state") {
    return {
      id: record.id,
      kind: "state",
      domain: null,
      services: [],
      entityIds,
      allowNoEntity: false
    };
  }

  if (record.kind === "service" && record.domain) {
    const services = parseStringArray(record.services);
    if (!services || services.length === 0) {
      return null;
    }

    return {
      id: record.id,
      kind: "service",
      domain: record.domain,
      services,
      entityIds,
      allowNoEntity: record.allowNoEntity
    };
  }

  return null;
}

function allowsEntities(
  permission: Pick<TokenPermissionRule, "entityIds" | "allowNoEntity">,
  requestedEntityIds: string[]
): { ok: true } | { ok: false; error: "missing_entity_id" | "entity_not_allowed" } {
  if (requestedEntityIds.length === 0) {
    return permission.allowNoEntity ? { ok: true } : { ok: false, error: "missing_entity_id" };
  }

  const allowed = new Set(permission.entityIds);
  return requestedEntityIds.every((entityId) => allowed.has(entityId))
    ? { ok: true }
    : { ok: false, error: "entity_not_allowed" };
}

export function findAllowedServicePermission(
  records: TokenPermissionRecord[],
  domain: string,
  service: string,
  requestedEntityIds: string[]
): ServicePermissionResult {
  let serviceMatched = false;
  let entityDenial: "missing_entity_id" | "entity_not_allowed" | null = null;

  for (const record of records) {
    const permission = parsePermission(record);
    if (
      !permission ||
      permission.kind !== "service" ||
      permission.domain !== domain ||
      !permission.services.includes(service)
    ) {
      continue;
    }

    serviceMatched = true;
    const entityResult = allowsEntities(permission, requestedEntityIds);
    if (entityResult.ok) {
      return { ok: true, permission };
    }
    entityDenial = entityResult.error;
  }

  if (serviceMatched && entityDenial) {
    return { ok: false, error: entityDenial };
  }
  return { ok: false, error: "forbidden" };
}

export function findAllowedStatePermission(
  records: TokenPermissionRecord[],
  entityId: string
): StatePermissionResult {
  let sawStatePermission = false;

  for (const record of records) {
    const permission = parsePermission(record);
    if (!permission || permission.kind !== "state") {
      continue;
    }

    sawStatePermission = true;
    if (permission.entityIds.includes(entityId)) {
      return { ok: true, permission };
    }
  }

  return { ok: false, error: sawStatePermission ? "entity_not_allowed" : "entity_not_allowed" };
}
