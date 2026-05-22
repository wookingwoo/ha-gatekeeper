export type HeaderMap = Record<string, string | string[] | undefined>;

const TRUSTED_INGRESS_IPS = new Set(["172.30.32.2", "::ffff:172.30.32.2"]);

function hasHeader(headers: HeaderMap, name: string): boolean {
  const value = headers[name];
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return typeof value === "string";
}

export function isTrustedIngressRequest(params: {
  addonMode: boolean;
  ip: string | null | undefined;
  headers: HeaderMap;
}): boolean {
  if (!params.addonMode || !params.ip || !TRUSTED_INGRESS_IPS.has(params.ip)) {
    return false;
  }

  return hasHeader(params.headers, "x-ingress-path") || hasHeader(params.headers, "x-remote-user-id");
}

export function isAdminAuthenticated(params: {
  addonMode: boolean;
  sessionAdmin: boolean;
  ip: string | null | undefined;
  headers: HeaderMap;
}): boolean {
  if (!params.addonMode) {
    return params.sessionAdmin;
  }

  return (
    params.sessionAdmin ||
    isTrustedIngressRequest({
      addonMode: params.addonMode,
      ip: params.ip,
      headers: params.headers
    })
  );
}

export function isAdminLoginAllowed(params: {
  addonMode: boolean;
  sessionAdmin: boolean;
  ip: string | null | undefined;
  headers: HeaderMap;
}): boolean {
  if (!params.addonMode) {
    return true;
  }

  return isAdminAuthenticated(params);
}

export function isPublicApiAllowed(params: { addonMode: boolean; exposeApi: boolean }): boolean {
  return !params.addonMode || params.exposeApi;
}
