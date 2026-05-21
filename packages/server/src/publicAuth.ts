import type { TokenPermissionRecord } from "./permissions.js";

export type PublicApiClient = {
  id: string;
  name: string;
  status: string;
  permissions: TokenPermissionRecord[];
};

export type PublicApiAuthResult =
  | { ok: true; client: PublicApiClient }
  | {
      ok: false;
      status: 401 | 403;
      error: "missing_bearer_token" | "invalid_api_key" | "client_disabled";
      clientId: string | null;
    };

type FindClientByApiKey = (apiKey: string) => Promise<PublicApiClient | null>;

export function readBearerToken(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function resolvePublicApiClient(
  authorization: string | undefined,
  findClientByApiKey: FindClientByApiKey
): Promise<PublicApiAuthResult> {
  const apiKey = readBearerToken(authorization);
  if (!apiKey) {
    return {
      ok: false,
      status: 401,
      error: "missing_bearer_token",
      clientId: null
    };
  }

  const client = await findClientByApiKey(apiKey);
  if (!client) {
    return {
      ok: false,
      status: 401,
      error: "invalid_api_key",
      clientId: null
    };
  }

  if (client.status !== "active") {
    return {
      ok: false,
      status: 403,
      error: "client_disabled",
      clientId: client.id
    };
  }

  return { ok: true, client };
}
