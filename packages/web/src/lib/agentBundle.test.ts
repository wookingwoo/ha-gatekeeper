import assert from "node:assert/strict";
import test from "node:test";
import type { TokenPermission } from "../api.js";
import {
  TOKEN_PLACEHOLDER,
  agentBundleFilename,
  buildAgentBundleFiles,
  buildAgentBundleZip,
  downloadAgentBundle,
  getDefaultGatekeeperBaseUrl,
  isAddonIngressPath,
  projectAgentCapabilities
} from "./agentBundle.js";
import { createZip } from "./zip.js";

const samplePermissions: TokenPermission[] = [
  {
    kind: "service",
    domain: "light",
    services: ["turn_off", "turn_on", "turn_on"],
    entityIds: ["light.kitchen", "light.entry", "light.entry"]
  },
  {
    kind: "service",
    domain: "script",
    services: ["turn_on"],
    entityIds: [],
    allowNoEntity: true
  },
  {
    kind: "state",
    entityIds: ["sensor.outdoor_temperature", "sensor.outdoor_temperature"]
  }
];

test("projects exact service and state capabilities from permissions", () => {
  assert.deepEqual(projectAgentCapabilities(samplePermissions), {
    serviceActions: [
      {
        domain: "light",
        service: "turn_off",
        entityIds: ["light.entry", "light.kitchen"],
        allowNoEntity: false
      },
      {
        domain: "light",
        service: "turn_on",
        entityIds: ["light.entry", "light.kitchen"],
        allowNoEntity: false
      },
      {
        domain: "script",
        service: "turn_on",
        entityIds: [],
        allowNoEntity: true
      }
    ],
    stateReads: ["sensor.outdoor_temperature"],
    unsupportedTargets: ["area_id", "device_id", "floor_id", "label_id"]
  });
});

test("merges duplicate service capabilities by domain and service", () => {
  const permissions: TokenPermission[] = [
    {
      kind: "service",
      domain: "light",
      services: ["turn_on"],
      entityIds: ["light.kitchen"],
      allowNoEntity: false
    },
    {
      kind: "service",
      domain: "light",
      services: ["turn_on"],
      entityIds: ["light.hallway", "light.kitchen"],
      allowNoEntity: true
    }
  ];

  assert.deepEqual(projectAgentCapabilities(permissions).serviceActions, [
    {
      domain: "light",
      service: "turn_on",
      entityIds: ["light.hallway", "light.kitchen"],
      allowNoEntity: true
    }
  ]);
});

test("renders AGENT_USAGE service calls from merged capabilities", () => {
  const files = buildAgentBundleFiles({
    clientName: "Merged Light Agent",
    baseUrl: "https://gatekeeper.example.test",
    permissions: [
      {
        kind: "service",
        domain: "light",
        services: ["turn_on"],
        entityIds: ["light.kitchen"],
        allowNoEntity: false
      },
      {
        kind: "service",
        domain: "light",
        services: ["turn_on"],
        entityIds: ["light.hallway", "light.kitchen"],
        allowNoEntity: true
      }
    ],
    tokenMode: "placeholder",
    generatedAt: "2026-05-22T12:00:00.000Z"
  });
  const usage = files[0].content;

  assert.equal(usage.match(/light\.turn_on/g)?.length, 1);
  assert.match(usage, /light\.hallway/);
  assert.match(usage, /light\.kitchen/);
  assert.match(usage, /allowNoEntity=true/);
});

test("generates placeholder bundle files in the exact path order", () => {
  const files = buildAgentBundleFiles({
    clientName: "Kitchen Agent",
    baseUrl: "https://gatekeeper.example.test",
    permissions: samplePermissions,
    tokenMode: "placeholder",
    liveToken: "gk_live_should_not_be_included",
    generatedAt: "2026-05-22T12:00:00.000Z"
  });

  assert.deepEqual(files.map((file) => file.path), [
    "ha-gatekeeper-agent-bundle/AGENT_USAGE.md",
    "ha-gatekeeper-agent-bundle/openapi.json",
    "ha-gatekeeper-agent-bundle/.env.example",
    "ha-gatekeeper-agent-bundle/openclaw-skill/SKILL.md",
    "ha-gatekeeper-agent-bundle/examples/call-service.sh",
    "ha-gatekeeper-agent-bundle/examples/read-state.sh",
    "ha-gatekeeper-agent-bundle/mcp/README.md",
    "ha-gatekeeper-agent-bundle/mcp/mcp-config.example.json",
    "ha-gatekeeper-agent-bundle/mcp/env.example"
  ]);

  const usage = files[0].content;
  assert.match(usage, /Kitchen Agent/);
  assert.match(usage, /light\.turn_off/);
  assert.match(usage, /sensor\.outdoor_temperature/);
  assert.match(usage, /Security notes/);
  assert.doesNotMatch(usage, /gk_live_should_not_be_included/);

  assert.equal(
    files.find((file) => file.path.endsWith("/.env.example"))?.content,
    `GATEKEEPER_BASE_URL=https://gatekeeper.example.test\nGATEKEEPER_TOKEN=${TOKEN_PLACEHOLDER}\n`
  );
});

test("generates MCP setup files with placeholder token by default", () => {
  const files = buildAgentBundleFiles({
    clientName: "MCP Placeholder Agent",
    baseUrl: "https://gatekeeper.example.test",
    permissions: samplePermissions,
    tokenMode: "placeholder",
    liveToken: "gk_live_should_not_be_included",
    generatedAt: "2026-05-22T12:00:00.000Z"
  });

  const mcpReadme = files.find((file) => file.path.endsWith("/mcp/README.md"))?.content ?? "";
  const mcpConfig = files.find((file) => file.path.endsWith("/mcp/mcp-config.example.json"))?.content ?? "";
  const mcpEnv = files.find((file) => file.path.endsWith("/mcp/env.example"))?.content ?? "";
  const parsedMcpConfig = JSON.parse(mcpConfig);
  const allContent = files.map((file) => file.content).join("\n");

  assert.match(mcpReadme, /npm run build:mcp/);
  assert.match(mcpReadme, /<PATH_TO_HA_GATEKEEPER>/);
  assert.equal(parsedMcpConfig.mcpServers["ha-gatekeeper"].command, "node");
  assert.deepEqual(parsedMcpConfig.mcpServers["ha-gatekeeper"].args, [
    "<PATH_TO_HA_GATEKEEPER>/packages/mcp/dist/index.js"
  ]);
  assert.match(mcpEnv, /GATEKEEPER_TOKEN=<GATEKEEPER_TOKEN>/);
  assert.doesNotMatch(allContent, /gk_live_should_not_be_included/);
});

test("MCP setup files honor live-token bundle opt-in", () => {
  const files = buildAgentBundleFiles({
    clientName: "MCP Live Agent",
    baseUrl: "https://gatekeeper.example.test",
    permissions: samplePermissions,
    tokenMode: "included",
    liveToken: "gk_live_secret",
    generatedAt: "2026-05-22T12:00:00.000Z"
  });

  const mcpConfig = files.find((file) => file.path.endsWith("/mcp/mcp-config.example.json"))?.content ?? "";
  const mcpEnv = files.find((file) => file.path.endsWith("/mcp/env.example"))?.content ?? "";
  const parsedMcpConfig = JSON.parse(mcpConfig);

  assert.match(mcpEnv, /GATEKEEPER_TOKEN=gk_live_secret/);
  assert.match(mcpConfig, /gk_live_secret/);
  assert.equal(parsedMcpConfig.mcpServers["ha-gatekeeper"].command, "node");
  assert.deepEqual(parsedMcpConfig.mcpServers["ha-gatekeeper"].args, [
    "<PATH_TO_HA_GATEKEEPER>/packages/mcp/dist/index.js"
  ]);
  assert.doesNotMatch(mcpEnv, /HA_TOKEN/);
  assert.doesNotMatch(mcpConfig, /HA_TOKEN/);
});

test("includes a live Gatekeeper token only when explicitly requested", () => {
  const placeholderFiles = buildAgentBundleFiles({
    clientName: "No Token Agent",
    baseUrl: "https://gatekeeper.example.test",
    permissions: samplePermissions,
    tokenMode: "placeholder",
    liveToken: "gk_live_secret"
  });
  assert.doesNotMatch(placeholderFiles.map((file) => file.content).join("\n"), /gk_live_secret/);

  const includedFiles = buildAgentBundleFiles({
    clientName: "Live Token Agent",
    baseUrl: "https://gatekeeper.example.test",
    permissions: samplePermissions,
    tokenMode: "included",
    liveToken: "gk_live_secret",
    generatedAt: "2026-05-22T12:00:00.000Z"
  });
  const allContent = includedFiles.map((file) => file.content).join("\n");

  assert.match(allContent, /gk_live_secret/);
  assert.match(allContent, /live Gatekeeper bearer token/);
  assert.doesNotMatch(allContent, /Home Assistant token exposure/);
  assert.doesNotMatch(allContent, /Home Assistant long-lived token.*gk_live_secret/);
});

test("OpenAPI describes only Gatekeeper service and state endpoints with capabilities", () => {
  const files = buildAgentBundleFiles({
    clientName: "Kitchen Agent",
    baseUrl: "https://gatekeeper.example.test",
    permissions: samplePermissions,
    tokenMode: "placeholder",
    generatedAt: "2026-05-22T12:00:00.000Z"
  });
  const openapi = JSON.parse(files[1].content);

  assert.equal(openapi.openapi, "3.1.0");
  assert.deepEqual(Object.keys(openapi.paths), [
    "/api/services/{domain}/{service}",
    "/api/states/{entityId}"
  ]);
  assert.equal(openapi.components.securitySchemes.bearerAuth.type, "http");
  assert.deepEqual(openapi["x-ha-gatekeeper-capabilities"], projectAgentCapabilities(samplePermissions));
});

test("buildAgentBundleZip returns ZIP bytes with expected filenames", () => {
  const zip = buildAgentBundleZip({
    clientName: "Kitchen Agent",
    baseUrl: "https://gatekeeper.example.test",
    permissions: samplePermissions,
    tokenMode: "placeholder",
    generatedAt: "2026-05-22T12:00:00.000Z"
  });
  const text = new TextDecoder().decode(zip);

  assert.equal(String.fromCharCode(zip[0], zip[1]), "PK");
  assert.match(text, /ha-gatekeeper-agent-bundle\/AGENT_USAGE\.md/);
  assert.match(text, /ha-gatekeeper-agent-bundle\/openapi\.json/);
  assert.match(text, /ha-gatekeeper-agent-bundle\/examples\/call-service\.sh/);
});

test("createZip writes stored UTF-8 entries with CRC32, sizes, and ZIP directories", () => {
  const path = "fixtures/상태.txt";
  const content = "hello\n";
  const zip = createZip([{ path, content }], new Date("2026-05-22T12:00:00.000Z"));
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const pathBytes = new TextEncoder().encode(path);
  const contentBytes = new TextEncoder().encode(content);
  const centralDirectoryOffset = 30 + pathBytes.length + contentBytes.length;
  const eocdOffset = centralDirectoryOffset + 46 + pathBytes.length;

  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint16(6, true), 0x0800);
  assert.equal(view.getUint16(8, true), 0);
  assert.equal(view.getUint32(14, true), 0x363a3020);
  assert.equal(view.getUint32(18, true), contentBytes.length);
  assert.equal(view.getUint32(22, true), contentBytes.length);
  assert.equal(new TextDecoder().decode(zip.slice(30, 30 + pathBytes.length)), path);

  assert.equal(view.getUint32(centralDirectoryOffset, true), 0x02014b50);
  assert.equal(view.getUint16(centralDirectoryOffset + 8, true), 0x0800);
  assert.equal(view.getUint16(centralDirectoryOffset + 10, true), 0);
  assert.equal(view.getUint32(centralDirectoryOffset + 16, true), 0x363a3020);
  assert.equal(view.getUint32(centralDirectoryOffset + 20, true), contentBytes.length);
  assert.equal(view.getUint32(centralDirectoryOffset + 24, true), contentBytes.length);

  assert.equal(view.getUint32(eocdOffset, true), 0x06054b50);
  assert.equal(view.getUint32(eocdOffset + 12, true), 46 + pathBytes.length);
  assert.equal(view.getUint32(eocdOffset + 16, true), centralDirectoryOffset);
});

test("agentBundleFilename slugifies names and falls back to agent", () => {
  assert.equal(
    agentBundleFilename("Kitchen Lights Agent"),
    "ha-gatekeeper-agent-bundle-kitchen-lights-agent.zip"
  );
  assert.equal(agentBundleFilename("!!!"), "ha-gatekeeper-agent-bundle-agent.zip");
});

test("downloadAgentBundle creates and clicks a ZIP download anchor", () => {
  const appended: unknown[] = [];
  const removed: unknown[] = [];
  let clicked = false;
  const anchor = {
    href: "",
    download: "",
    style: { display: "" },
    click: () => {
      clicked = true;
    },
    remove: () => {
      removed.push(anchor);
    }
  };
  const documentMock = {
    createElement: (tagName: string) => {
      assert.equal(tagName, "a");
      return anchor;
    },
    body: {
      append: (node: unknown) => {
        appended.push(node);
      }
    }
  };
  const objectUrls: Blob[] = [];
  const revokedUrls: string[] = [];
  const urlMock = {
    createObjectURL: (blob: Blob) => {
      objectUrls.push(blob);
      return "blob:gatekeeper-agent-bundle";
    },
    revokeObjectURL: (url: string) => {
      revokedUrls.push(url);
    }
  };
  const originalDocument = globalThis.document;
  const originalUrl = globalThis.URL;

  Object.defineProperty(globalThis, "document", {
    value: documentMock,
    configurable: true
  });
  Object.defineProperty(globalThis, "URL", {
    value: urlMock,
    configurable: true
  });

  try {
    downloadAgentBundle({
      clientName: "Kitchen Lights Agent",
      baseUrl: "https://gatekeeper.example.test",
      permissions: samplePermissions,
      tokenMode: "placeholder",
      generatedAt: "2026-05-22T12:00:00.000Z"
    });
  } finally {
    Object.defineProperty(globalThis, "document", {
      value: originalDocument,
      configurable: true
    });
    Object.defineProperty(globalThis, "URL", {
      value: originalUrl,
      configurable: true
    });
  }

  assert.equal(objectUrls.length, 1);
  assert.equal(objectUrls[0].type, "application/zip");
  assert.equal(anchor.href, "blob:gatekeeper-agent-bundle");
  assert.equal(anchor.download, "ha-gatekeeper-agent-bundle-kitchen-lights-agent.zip");
  assert.deepEqual(appended, [anchor]);
  assert.equal(clicked, true);
  assert.deepEqual(removed, [anchor]);
  assert.deepEqual(revokedUrls, ["blob:gatekeeper-agent-bundle"]);
});

test("getDefaultGatekeeperBaseUrl maps local Vite origins and keeps production origins", () => {
  assert.equal(
    getDefaultGatekeeperBaseUrl({
      protocol: "http:",
      hostname: "localhost",
      port: "5173",
      origin: "http://localhost:5173"
    }),
    "http://localhost:8080"
  );
  assert.equal(
    getDefaultGatekeeperBaseUrl({
      protocol: "http:",
      hostname: "127.0.0.1",
      port: "5175",
      origin: "http://127.0.0.1:5175"
    }),
    "http://127.0.0.1:8080"
  );
  assert.equal(
    getDefaultGatekeeperBaseUrl({
      protocol: "https:",
      hostname: "gatekeeper.example.test",
      port: "",
      origin: "https://gatekeeper.example.test"
    }),
    "https://gatekeeper.example.test"
  );
});

test("isAddonIngressPath detects Home Assistant ingress paths", () => {
  assert.equal(isAddonIngressPath("/api/hassio_ingress/abcdef"), true);
  assert.equal(isAddonIngressPath("/api/hassio_ingress/abcdef/admin"), true);
  assert.equal(isAddonIngressPath("/api/hassio_ingress"), false);
  assert.equal(isAddonIngressPath("/admin"), false);
});

test("getDefaultGatekeeperBaseUrl suggests the mapped addon API URL for ingress", () => {
  assert.equal(
    getDefaultGatekeeperBaseUrl({
      protocol: "http:",
      hostname: "homeassistant.local",
      port: "",
      origin: "http://homeassistant.local",
      pathname: "/api/hassio_ingress/abcdef"
    }),
    "http://homeassistant.local:8080"
  );

  assert.equal(
    getDefaultGatekeeperBaseUrl({
      protocol: "https:",
      hostname: "ha.example.test",
      port: "",
      origin: "https://ha.example.test",
      pathname: "/api/hassio_ingress/abcdef/admin"
    }),
    "https://ha.example.test:8080"
  );
});
