import { fetch } from "undici";
import { env } from "./env.js";

export type HaServiceProxyResult = {
  ok: boolean;
  status: number;
  contentType?: string;
  body: string;
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

export async function proxyHaServiceCall(
  domain: string,
  service: string,
  body: Record<string, unknown>,
  queryString = ""
): Promise<HaServiceProxyResult> {
  const url = `${baseUrl}/api/services/${encodeURIComponent(domain)}/${encodeURIComponent(
    service
  )}${queryString}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.HA_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  return {
    ok: res.ok,
    status: res.status,
    contentType: res.headers.get("content-type") ?? undefined,
    body: await res.text()
  };
}

export async function proxyHaState(entityId: string): Promise<HaServiceProxyResult> {
  const url = `${baseUrl}/api/states/${encodeURIComponent(entityId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.HA_TOKEN}`,
      "Content-Type": "application/json"
    }
  });

  return {
    ok: res.ok,
    status: res.status,
    contentType: res.headers.get("content-type") ?? undefined,
    body: await res.text()
  };
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
