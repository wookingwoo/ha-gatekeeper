export type Role = {
  id: string;
  name: string;
};

export type Action = {
  id: string;
  name: string;
  description?: string | null;
  status: "active" | "disabled";
  haCalls: unknown;
  roleIds: string[];
};

export type Client = {
  id: string;
  name: string;
  status: "active" | "disabled";
  roleId: string;
  roleName: string;
  apiKeyPrefix: string;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  timestamp: string;
  success: boolean;
  error?: string | null;
  ip?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  actionId?: string | null;
  actionName?: string | null;
  actionIdRaw: string;
};

export type HaServiceCatalog = {
  domain: string;
  services: string[];
};

export type HaEntity = {
  entityId: string;
  domain: string;
  name: string;
};

type ApiResponse<T> = {
  ok: boolean;
} & T;

async function apiFetch<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const hasBody = options?.body !== undefined;
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers ?? {})
    },
    ...options
  });

  if (!res.ok) {
    throw new Error(`request_failed:${res.status}`);
  }

  return res.json();
}

export const api = {
  login: (password: string) =>
    apiFetch<{}>("/admin/login", {
      method: "POST",
      body: JSON.stringify({ password })
    }),
  logout: () => apiFetch<{}>("/admin/logout", { method: "POST" }),
  me: () => apiFetch<{ authenticated: boolean }>("/admin/me"),
  roles: () => apiFetch<{ roles: Role[] }>("/admin/roles"),
  createRole: (name: string) =>
    apiFetch<{ role: Role }>("/admin/roles", {
      method: "POST",
      body: JSON.stringify({ name })
    }),
  actions: () => apiFetch<{ actions: Action[] }>("/admin/actions"),
  createAction: (payload: {
    id: string;
    name: string;
    description?: string;
    status: "active" | "disabled";
    haCalls: unknown;
    roleIds: string[];
  }) =>
    apiFetch<{ action: Action }>("/admin/actions", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  clients: () => apiFetch<{ clients: Client[] }>("/admin/clients"),
  createClient: (payload: {
    name: string;
    roleId: string;
    status: "active" | "disabled";
  }) =>
    apiFetch<{ client: Client; apiKey: string }>("/admin/clients", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  rotateClientKey: (clientId: string) =>
    apiFetch<{ client: Client; apiKey: string }>(`/admin/clients/${clientId}/rotate-key`, {
      method: "POST"
    }),
  deleteClient: (clientId: string) =>
    apiFetch<{}>(`/admin/clients/${clientId}`, {
      method: "DELETE"
    }),
  auditLogs: () => apiFetch<{ logs: AuditLog[] }>("/admin/audit-logs"),
  haServices: () => apiFetch<{ services: HaServiceCatalog[]; cached?: boolean }>(
    "/admin/ha/services"
  ),
  haEntities: (domain?: string) =>
    apiFetch<{ entities: HaEntity[]; cached?: boolean }>(
      domain ? `/admin/ha/entities?domain=${encodeURIComponent(domain)}` : "/admin/ha/entities"
    )
};
