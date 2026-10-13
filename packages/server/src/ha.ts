import { Agent, fetch } from "undici";
import { env } from "./env.js";

export type HaServiceProxyResult = {
  ok: boolean;
  status: number;
  contentType?: string;
  body: string;
};

const baseUrl = env.HA_BASE_URL.replace(/\/$/, "");

// This pool belongs only to HA calls; other fetch clients keep their dispatchers.
const dispatcher = new Agent();
const activeRequests = new Set<AbortController>();
let closing: Promise<void> | undefined;

/** Permanently stops HA requests, aborts pending bodies, and destroys owned sockets. */
export function closeHaConnections(): Promise<void> {
  if (!closing) {
    // Publish shutdown state before abort handlers can attempt another request.
    closing = Promise.resolve().then(async () => {
      for (const controller of activeRequests) controller.abort(new Error("ha_shutdown"));
      await dispatcher.destroy();
    });
  }
  return closing;
}

async function requestHa(url: string, method = "GET", body?: Record<string, unknown>): Promise<HaServiceProxyResult> {
  if (closing) throw new Error("ha_shutdown");
  const controller = new AbortController();
  activeRequests.add(controller);
  const timer = setTimeout(() => controller.abort(new Error("ha_request_timeout")), env.HA_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      dispatcher,
      signal: controller.signal,
      method,
      headers: { Authorization: `Bearer ${env.HA_TOKEN}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { ok: res.ok, status: res.status, contentType: res.headers.get("content-type") ?? undefined, body: await res.text() };
  } finally {
    clearTimeout(timer);
    activeRequests.delete(controller);
  }
}

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
  return requestHa(url, "POST", body);
}

export async function proxyHaState(entityId: string): Promise<HaServiceProxyResult> {
  const url = `${baseUrl}/api/states/${encodeURIComponent(entityId)}`;
  return requestHa(url);
}

export async function fetchHaServices(): Promise<HaServiceCatalog[]> {
  const url = `${baseUrl}/api/services`;
  const res = await requestHa(url);

  if (!res.ok) {
    throw new Error(`ha_services_failed:${res.status}`);
  }

  const data = JSON.parse(res.body) as Array<{ domain: string; services: Record<string, unknown> }>;
  return data.map((entry) => ({
    domain: entry.domain,
    services: Object.keys(entry.services ?? {})
  }));
}

export async function fetchHaEntities(): Promise<HaEntity[]> {
  const url = `${baseUrl}/api/states`;
  const res = await requestHa(url);

  if (!res.ok) {
    throw new Error(`ha_entities_failed:${res.status}`);
  }

  const data = JSON.parse(res.body) as Array<{
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
