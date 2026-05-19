type EntityExtractResult =
  | { ok: true; entityIds: string[] }
  | { ok: false; error: "invalid_body" | "invalid_target" | "invalid_entity_id" | "unsupported_target" };

const UNSUPPORTED_TARGET_KEYS = ["area_id", "device_id", "floor_id", "label_id"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStringList(value: unknown): string[] | null {
  if (value === undefined) {
    return [];
  }

  const split = (raw: string) =>
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  if (typeof value === "string") {
    return split(value);
  }

  if (Array.isArray(value)) {
    const ids: string[] = [];
    for (const item of value) {
      if (typeof item !== "string") {
        return null;
      }
      ids.push(...split(item));
    }
    return ids;
  }

  return null;
}

function hasUnsupportedTarget(value: Record<string, unknown>): boolean {
  return UNSUPPORTED_TARGET_KEYS.some((key) => value[key] !== undefined);
}

export function asServiceRequestBody(body: unknown): Record<string, unknown> | null {
  if (body === undefined || body === null) {
    return {};
  }
  return isRecord(body) ? body : null;
}

export function extractRequestedEntityIds(body: Record<string, unknown>): EntityExtractResult {
  if (hasUnsupportedTarget(body)) {
    return { ok: false, error: "unsupported_target" };
  }

  const entityIds = new Set<string>();
  const topLevelEntityIds = normalizeStringList(body.entity_id);
  if (topLevelEntityIds === null) {
    return { ok: false, error: "invalid_entity_id" };
  }
  topLevelEntityIds.forEach((entityId) => entityIds.add(entityId));

  if (body.target !== undefined) {
    if (!isRecord(body.target)) {
      return { ok: false, error: "invalid_target" };
    }
    if (hasUnsupportedTarget(body.target)) {
      return { ok: false, error: "unsupported_target" };
    }

    const targetEntityIds = normalizeStringList(body.target.entity_id);
    if (targetEntityIds === null) {
      return { ok: false, error: "invalid_entity_id" };
    }
    targetEntityIds.forEach((entityId) => entityIds.add(entityId));
  }

  return { ok: true, entityIds: [...entityIds] };
}
