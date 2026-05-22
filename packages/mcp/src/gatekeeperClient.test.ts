import assert from "node:assert/strict";
import test from "node:test";

import {
  createGatekeeperClient,
  readMcpEnv,
  redactToken,
  type GatekeeperClientOptions,
} from "./gatekeeperClient.ts";

type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

function textResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    ...init,
    headers: {
      "content-type": "text/plain",
      ...init.headers,
    },
  });
}

function createFetchStub(response: Response): {
  calls: FetchCall[];
  fetchImpl: typeof fetch;
} {
  const calls: FetchCall[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return response;
  }) as typeof fetch;

  return { calls, fetchImpl };
}

function createClient(fetchImpl: typeof fetch): ReturnType<typeof createGatekeeperClient> {
  const options: GatekeeperClientOptions = {
    baseUrl: "https://gatekeeper.example.test/",
    token: "secret-token",
    fetchImpl,
  };

  return createGatekeeperClient(options);
}

test("validates MCP environment", () => {
  assert.deepEqual(
    readMcpEnv({
      GATEKEEPER_BASE_URL: "https://gatekeeper.example.test/",
      GATEKEEPER_TOKEN: "secret-token",
    }),
    {
      baseUrl: "https://gatekeeper.example.test",
      token: "secret-token",
    },
  );

  assert.throws(
    () =>
      readMcpEnv({
        GATEKEEPER_BASE_URL: "not a url",
        GATEKEEPER_TOKEN: "secret-token",
      }),
    /GATEKEEPER_BASE_URL/,
  );
  assert.throws(
    () =>
      readMcpEnv({
        GATEKEEPER_BASE_URL: "https://gatekeeper.example.test",
      }),
    /GATEKEEPER_TOKEN/,
  );
});

test("redacts token values from error text", () => {
  assert.equal(
    redactToken("request failed for secret-token in body", "secret-token"),
    "request failed for [REDACTED] in body",
  );
});

test("capabilities endpoint uses bearer auth and trims trailing base URL slash", async () => {
  const { calls, fetchImpl } = createFetchStub(jsonResponse({ services: [] }));
  const client = createClient(fetchImpl);

  await client.listCapabilities();

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://gatekeeper.example.test/api/capabilities");
  assert.equal((calls[0]?.init?.headers as Record<string, string>).Authorization, "Bearer secret-token");
});

test("non-JSON responses are returned as text", async () => {
  const { fetchImpl } = createFetchStub(textResponse("plain text"));
  const client = createClient(fetchImpl);

  assert.equal(await client.listCapabilities(), "plain text");
});

test("service call maps JSON body with data and entity_id", async () => {
  const { calls, fetchImpl } = createFetchStub(jsonResponse({ ok: true }));
  const client = createClient(fetchImpl);

  await client.callService({
    domain: "light domain",
    service: "turn/on",
    entity_id: "light.kitchen",
    data: {
      brightness: 80,
    },
  });

  assert.equal(
    calls[0]?.url,
    "https://gatekeeper.example.test/api/services/light%20domain/turn%2Fon",
  );
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal((calls[0]?.init?.headers as Record<string, string>).Authorization, "Bearer secret-token");
  assert.equal((calls[0]?.init?.headers as Record<string, string>)["Content-Type"], "application/json");
  assert.equal(
    calls[0]?.init?.body,
    JSON.stringify({
      brightness: 80,
      entity_id: "light.kitchen",
    }),
  );
});

test("state entity IDs are URL-encoded", async () => {
  const { calls, fetchImpl } = createFetchStub(jsonResponse({ state: "on" }));
  const client = createClient(fetchImpl);

  await client.readState({ entity_id: "sensor.room/temp" });

  assert.equal(
    calls[0]?.url,
    "https://gatekeeper.example.test/api/states/sensor.room%2Ftemp",
  );
  assert.equal(calls[0]?.init?.method, "GET");
  assert.equal((calls[0]?.init?.headers as Record<string, string>).Authorization, "Bearer secret-token");
});

test("HTTP errors do not leak bearer token", async () => {
  const { fetchImpl } = createFetchStub(
    jsonResponse(
      {
        error: "Bearer secret-token failed for secret-token",
      },
      {
        status: 403,
      },
    ),
  );
  const client = createClient(fetchImpl);

  await assert.rejects(client.listCapabilities(), (error) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /403/);
    assert.doesNotMatch(error.message, /secret-token/);
    assert.match(error.message, /\[REDACTED\]/);
    return true;
  });
});
