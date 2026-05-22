export type McpEnv = { baseUrl: string; token: string };
export type GatekeeperClientOptions = McpEnv & { fetchImpl?: typeof fetch };
export type ServiceCallInput = {
  domain: string;
  service: string;
  entity_id?: string;
  data?: Record<string, unknown>;
};
export type StateReadInput = { entity_id: string };

export function readMcpEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>): McpEnv {
  const rawBaseUrl = env.GATEKEEPER_BASE_URL;
  if (!rawBaseUrl) {
    throw new Error("GATEKEEPER_BASE_URL is required");
  }

  let url: URL;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    throw new Error("GATEKEEPER_BASE_URL must be a valid URL");
  }

  const token = env.GATEKEEPER_TOKEN;
  if (!token) {
    throw new Error("GATEKEEPER_TOKEN is required");
  }

  return {
    baseUrl: url.toString().replace(/\/+$/, ""),
    token,
  };
}

export function redactToken(value: string, token: string): string {
  if (!token) {
    return value;
  }

  return value.split(token).join("[REDACTED]");
}

export function createGatekeeperClient(options: GatekeeperClientOptions): {
  listCapabilities(): Promise<unknown>;
  callService(input: ServiceCallInput): Promise<unknown>;
  readState(input: StateReadInput): Promise<unknown>;
} {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${options.token}`,
        ...init.headers,
      },
    });
    const body = await parseResponseBody(response);

    if (!response.ok) {
      const message = `Gatekeeper request failed with status ${response.status}: ${formatBody(body)}`;
      throw new Error(redactToken(message, options.token));
    }

    return body;
  }

  return {
    listCapabilities() {
      return request("/api/capabilities", {
        method: "GET",
      });
    },
    callService(input: ServiceCallInput) {
      return request(
        `/api/services/${encodeURIComponent(input.domain)}/${encodeURIComponent(input.service)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...(input.data ?? {}),
            ...(input.entity_id ? { entity_id: input.entity_id } : {}),
          }),
        },
      );
    },
    readState(input: StateReadInput) {
      return request(`/api/states/${encodeURIComponent(input.entity_id)}`, {
        method: "GET",
      });
    },
  };
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

function formatBody(body: unknown): string {
  if (typeof body === "string") {
    return body;
  }

  return JSON.stringify(body);
}
