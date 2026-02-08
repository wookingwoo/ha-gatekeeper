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
