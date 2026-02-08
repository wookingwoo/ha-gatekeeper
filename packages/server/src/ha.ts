import { fetch } from "undici";
import { env } from "./env.js";
import { HaCall } from "./schemas.js";

export type HaCallResult = {
  domain: string;
  service: string;
  ok: boolean;
  status?: number;
};

const baseUrl = env.HA_BASE_URL.replace(/\/$/, "");

export type HaServiceCatalog = {
  domain: string;
  services: string[];
};

export type HaEntity = {
  entityId: string;
  domain: string;
  name: string;
};

export async function callHaServices(calls: HaCall[]): Promise<HaCallResult[]> {
  const results: HaCallResult[] = [];

  for (const call of calls) {
    const payload: Record<string, unknown> = {
      ...(call.data ?? {})
    };
    if (call.entityIds && call.entityIds.length > 0) {
      payload.entity_id = call.entityIds;
    }

    const url = `${baseUrl}/api/services/${call.domain}/${call.service}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.HA_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      results.push({
        domain: call.domain,
        service: call.service,
        ok: false,
        status: res.status
      });
      throw new Error(`ha_request_failed:${res.status}`);
    }

    results.push({
      domain: call.domain,
      service: call.service,
      ok: true,
      status: res.status
    });
  }

  return results;
}

export async function fetchHaServices(): Promise<HaServiceCatalog[]> {
  const url = `${baseUrl}/api/services`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.HA_TOKEN}`,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`ha_services_failed:${res.status}`);
  }

  const data = (await res.json()) as Array<{ domain: string; services: Record<string, unknown> }>;
  return data.map((entry) => ({
    domain: entry.domain,
    services: Object.keys(entry.services ?? {})
  }));
}

export async function fetchHaEntities(): Promise<HaEntity[]> {
  const url = `${baseUrl}/api/states`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.HA_TOKEN}`,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`ha_entities_failed:${res.status}`);
  }

  const data = (await res.json()) as Array<{
    entity_id: string;
    attributes?: { friendly_name?: string };
  }>;

  return data.map((entry) => {
    const entityId = entry.entity_id;
    const domain = entityId.split(".")[0] ?? "unknown";
    const name = entry.attributes?.friendly_name ?? entityId;
    return { entityId, domain, name };
  });
}
