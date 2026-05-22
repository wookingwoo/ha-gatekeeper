import type { TokenPermission } from "../api.js";
import { createZip, type ZipSourceFile } from "./zip.js";

export const TOKEN_PLACEHOLDER = "<GATEKEEPER_TOKEN>";

export type AgentBundleTokenMode = "placeholder" | "included";
export type AgentBundleInput = {
  clientName: string;
  baseUrl: string;
  permissions: TokenPermission[];
  tokenMode: AgentBundleTokenMode;
  liveToken?: string;
  generatedAt?: string;
};
export type AgentServiceAction = {
  domain: string;
  service: string;
  entityIds: string[];
  allowNoEntity: boolean;
};
export type AgentCapabilities = {
  serviceActions: AgentServiceAction[];
  stateReads: string[];
  unsupportedTargets: string[];
};
export type AgentBundleFile = ZipSourceFile;

const BUNDLE_ROOT = "ha-gatekeeper-agent-bundle";
const UNSUPPORTED_TARGETS = ["area_id", "device_id", "floor_id", "label_id"];
const VITE_PORTS = new Set(["5173", "5174", "5175"]);

export function projectAgentCapabilities(permissions: TokenPermission[]): AgentCapabilities {
  const serviceActionsByKey = new Map<
    string,
    {
      domain: string;
      service: string;
      entityIds: Set<string>;
      allowNoEntity: boolean;
    }
  >();
  const stateReads = new Set<string>();

  for (const permission of permissions) {
    if (permission.kind === "service") {
      const services = uniqueSorted(permission.services);
      for (const service of services) {
        const key = `${permission.domain}.${service}`;
        const existing = serviceActionsByKey.get(key);
        if (existing) {
          for (const entityId of permission.entityIds) {
            existing.entityIds.add(entityId);
          }
          existing.allowNoEntity = existing.allowNoEntity || (permission.allowNoEntity ?? false);
        } else {
          serviceActionsByKey.set(key, {
            domain: permission.domain,
            service,
            entityIds: new Set(permission.entityIds),
            allowNoEntity: permission.allowNoEntity ?? false
          });
        }
      }
    } else {
      for (const entityId of permission.entityIds) {
        stateReads.add(entityId);
      }
    }
  }

  return {
    serviceActions: [...serviceActionsByKey.values()]
      .map((action) => ({
        domain: action.domain,
        service: action.service,
        entityIds: [...action.entityIds].sort(),
        allowNoEntity: action.allowNoEntity
      }))
      .sort((a, b) => `${a.domain}.${a.service}`.localeCompare(`${b.domain}.${b.service}`)),
    stateReads: [...stateReads].sort(),
    unsupportedTargets: [...UNSUPPORTED_TARGETS]
  };
}

export function getDefaultGatekeeperBaseUrl(
  locationLike: Pick<Location, "protocol" | "hostname" | "port" | "origin"> = window.location
): string {
  const isLocalHost = locationLike.hostname === "localhost" || locationLike.hostname === "127.0.0.1";
  if (isLocalHost && VITE_PORTS.has(locationLike.port)) {
    return `${locationLike.protocol}//${locationLike.hostname}:8080`;
  }

  return locationLike.origin;
}

export function buildAgentBundleFiles(input: AgentBundleInput): AgentBundleFile[] {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const capabilities = projectAgentCapabilities(input.permissions);
  const token = input.tokenMode === "included" && input.liveToken ? input.liveToken : TOKEN_PLACEHOLDER;

  return [
    {
      path: `${BUNDLE_ROOT}/AGENT_USAGE.md`,
      content: buildUsageMarkdown(input, capabilities, generatedAt)
    },
    {
      path: `${BUNDLE_ROOT}/openapi.json`,
      content: `${JSON.stringify(buildOpenApi(input, capabilities), null, 2)}\n`
    },
    {
      path: `${BUNDLE_ROOT}/.env.example`,
      content: `GATEKEEPER_BASE_URL=${input.baseUrl}\nGATEKEEPER_TOKEN=${token}\n`
    },
    {
      path: `${BUNDLE_ROOT}/openclaw-skill/SKILL.md`,
      content: buildSkillMarkdown(input, capabilities)
    },
    {
      path: `${BUNDLE_ROOT}/examples/call-service.sh`,
      content: buildCallServiceExample(input.baseUrl, capabilities.serviceActions[0])
    },
    {
      path: `${BUNDLE_ROOT}/examples/read-state.sh`,
      content: buildReadStateExample(input.baseUrl, capabilities.stateReads[0])
    },
    {
      path: `${BUNDLE_ROOT}/mcp/README.md`,
      content: buildMcpReadme(input)
    },
    {
      path: `${BUNDLE_ROOT}/mcp/mcp-config.example.json`,
      content: `${JSON.stringify(buildMcpConfig(input, token), null, 2)}\n`
    },
    {
      path: `${BUNDLE_ROOT}/mcp/env.example`,
      content: `GATEKEEPER_BASE_URL=${input.baseUrl}\nGATEKEEPER_TOKEN=${token}\n`
    }
  ];
}

export function buildAgentBundleZip(input: AgentBundleInput): Uint8Array {
  const generatedAt = input.generatedAt ? new Date(input.generatedAt) : new Date();
  return createZip(buildAgentBundleFiles(input), generatedAt);
}

export function agentBundleFilename(clientName: string): string {
  const slug = clientName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `ha-gatekeeper-agent-bundle-${slug || "agent"}.zip`;
}

export function downloadAgentBundle(input: AgentBundleInput): void {
  const zip = buildAgentBundleZip(input);
  const buffer = new ArrayBuffer(zip.byteLength);
  new Uint8Array(buffer).set(zip);
  const blob = new Blob([buffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = agentBundleFilename(input.clientName);
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildUsageMarkdown(
  input: AgentBundleInput,
  capabilities: AgentCapabilities,
  generatedAt: string
): string {
  const serviceLines = capabilities.serviceActions.length
    ? capabilities.serviceActions.map(formatServiceAction).join("\n")
    : "- No service calls are allowed.";
  const stateLines = capabilities.stateReads.length
    ? capabilities.stateReads.map((entityId) => `- ${entityId}`).join("\n")
    : "- No state reads are allowed.";
  const serviceExample = capabilities.serviceActions[0]
    ? serviceCurlExample(input.baseUrl, capabilities.serviceActions[0])
    : "No service permission is available for this bundle.";
  const stateExample = capabilities.stateReads[0]
    ? stateCurlExample(input.baseUrl, capabilities.stateReads[0])
    : "No state-read permission is available for this bundle.";
  const tokenMode =
    input.tokenMode === "included" && input.liveToken
      ? "included: this bundle contains a live Gatekeeper bearer token."
      : "placeholder: set GATEKEEPER_TOKEN before use.";

  return `# HA Gatekeeper Agent Bundle

Client name: ${input.clientName}
Generated: ${generatedAt}
Purpose: Configure an agent to access only the Gatekeeper endpoints and permissions listed here.
Token mode: ${tokenMode}

## Environment variables

- GATEKEEPER_BASE_URL=${input.baseUrl}
- GATEKEEPER_TOKEN=${input.tokenMode === "included" && input.liveToken ? "included in .env.example" : TOKEN_PLACEHOLDER}

## Allowed service calls

${serviceLines}

## Allowed state reads

${stateLines}

## Unsupported targets

${capabilities.unsupportedTargets.map((target) => `- ${target}`).join("\n")}

## Service curl example

\`\`\`sh
${serviceExample}
\`\`\`

## State curl example

\`\`\`sh
${stateExample}
\`\`\`

## Security notes

- Use only HA Gatekeeper endpoints from this bundle.
- Never use the raw Home Assistant API from agent workflows.
- Never ask for, store, or expose the Home Assistant long-lived token.
- Refuse actions that require unsupported target selectors or permissions not listed above.
${input.tokenMode === "included" && input.liveToken ? "- This bundle contains a live Gatekeeper bearer token; store and share it as a secret.\n" : ""}`;
}

function buildOpenApi(input: AgentBundleInput, capabilities: AgentCapabilities): object {
  return {
    openapi: "3.1.0",
    info: {
      title: `HA Gatekeeper Agent API for ${input.clientName}`,
      version: "1.0.0"
    },
    servers: [{ url: input.baseUrl }],
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/services/{domain}/{service}": {
        post: {
          operationId: "callGatekeeperService",
          summary: "Call an allowed Home Assistant service through Gatekeeper",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "domain",
              in: "path",
              required: true,
              schema: { type: "string" }
            },
            {
              name: "service",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    entity_id: {
                      oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }]
                    },
                    service_data: { type: "object", additionalProperties: true }
                  },
                  additionalProperties: true
                }
              }
            }
          },
          responses: {
            "200": { description: "Service call accepted by Gatekeeper" },
            "403": { description: "Permission denied by Gatekeeper" }
          }
        }
      },
      "/api/states/{entityId}": {
        get: {
          operationId: "readGatekeeperState",
          summary: "Read an allowed entity state through Gatekeeper",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "entityId",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          responses: {
            "200": { description: "Entity state returned by Gatekeeper" },
            "403": { description: "Permission denied by Gatekeeper" }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer"
        }
      }
    },
    "x-ha-gatekeeper-capabilities": capabilities
  };
}

function buildSkillMarkdown(input: AgentBundleInput, capabilities: AgentCapabilities): string {
  return `---
name: ha-gatekeeper-agent
description: Use HA Gatekeeper for the exact permissions granted to ${input.clientName}.
---

# HA Gatekeeper Agent Skill

Use only HA Gatekeeper at ${input.baseUrl}. Never call the raw Home Assistant API.

Allowed service calls:
${capabilities.serviceActions.length ? capabilities.serviceActions.map(formatServiceAction).join("\n") : "- None"}

Allowed state reads:
${capabilities.stateReads.length ? capabilities.stateReads.map((entityId) => `- ${entityId}`).join("\n") : "- None"}

Unsupported targets:
${capabilities.unsupportedTargets.map((target) => `- ${target}`).join("\n")}

Refuse unsupported actions, unsupported target selectors, and requests outside these permissions.
Do not ask for, store, or expose the Home Assistant long-lived token.
${input.tokenMode === "included" && input.liveToken ? "This bundle contains a live Gatekeeper bearer token; treat it as a secret.\n" : ""}`;
}

function buildMcpReadme(input: AgentBundleInput): string {
  return `# HA Gatekeeper MCP Setup

Use ha-gatekeeper-mcp to connect MCP-compatible agents to HA Gatekeeper over stdio MCP.

## Local build setup

The npm package can later be published, but this bundle uses the local build path now:

1. Clone or open the ha-gatekeeper repo.
2. Run \`npm install\`.
3. Run \`npm run build:mcp\`.
4. Replace \`<PATH_TO_HA_GATEKEEPER>\` in \`mcp-config.example.json\` with the absolute repo path.

## Server

- Entry point: <PATH_TO_HA_GATEKEEPER>/packages/mcp/dist/index.js
- Transport: stdio MCP
- Gatekeeper base URL: ${input.baseUrl}

## Environment variables

- GATEKEEPER_BASE_URL: HA Gatekeeper base URL.
- GATEKEEPER_TOKEN: Gatekeeper bearer token for this bundle.

## Tools

- ha_list_capabilities: list the service calls and state reads allowed by this token.
- ha_call_service: call an allowed Home Assistant service through Gatekeeper.
- ha_read_state: read an allowed Home Assistant entity state through Gatekeeper.

## Security notes

- The adapter only talks to HA Gatekeeper.
- The adapter never needs the Home Assistant long-lived token.
- Store any included Gatekeeper token as a secret.
`;
}

function buildMcpConfig(input: AgentBundleInput, token: string): object {
  return {
    mcpServers: {
      "ha-gatekeeper": {
        command: "node",
        args: ["<PATH_TO_HA_GATEKEEPER>/packages/mcp/dist/index.js"],
        env: {
          GATEKEEPER_BASE_URL: input.baseUrl,
          GATEKEEPER_TOKEN: token
        }
      }
    }
  };
}

function buildCallServiceExample(baseUrl: string, action: AgentServiceAction | undefined): string {
  if (!action) {
    return "#!/usr/bin/env sh\necho \"No service permission is available for this bundle.\"\n";
  }

  return `#!/usr/bin/env sh
set -eu

GATEKEEPER_BASE_URL="\${GATEKEEPER_BASE_URL:-${baseUrl}}"
curl -sS -X POST "$GATEKEEPER_BASE_URL/api/services/${action.domain}/${action.service}" \\
  -H "Authorization: Bearer $GATEKEEPER_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ entity_id: action.entityIds[0] ?? undefined })}'
`;
}

function buildReadStateExample(baseUrl: string, entityId: string | undefined): string {
  if (!entityId) {
    return "#!/usr/bin/env sh\necho \"No state-read permission is available for this bundle.\"\n";
  }

  return `#!/usr/bin/env sh
set -eu

GATEKEEPER_BASE_URL="\${GATEKEEPER_BASE_URL:-${baseUrl}}"
curl -sS "$GATEKEEPER_BASE_URL/api/states/${encodeURIComponent(entityId)}" \\
  -H "Authorization: Bearer $GATEKEEPER_TOKEN"
`;
}

function serviceCurlExample(baseUrl: string, action: AgentServiceAction): string {
  return `curl -sS -X POST "${baseUrl}/api/services/${action.domain}/${action.service}" \\
  -H "Authorization: Bearer $GATEKEEPER_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ entity_id: action.entityIds[0] ?? undefined })}'`;
}

function stateCurlExample(baseUrl: string, entityId: string): string {
  return `curl -sS "${baseUrl}/api/states/${encodeURIComponent(entityId)}" \\
  -H "Authorization: Bearer $GATEKEEPER_TOKEN"`;
}

function formatServiceAction(action: AgentServiceAction): string {
  const target = action.entityIds.length ? action.entityIds.join(", ") : "no entity required";
  return `- ${action.domain}.${action.service}: ${target}; allowNoEntity=${String(action.allowNoEntity)}`;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}
