#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { createGatekeeperClient, readMcpEnv } from "./gatekeeperClient.js";
import { createToolHandlers } from "./tools.js";

const env = readMcpEnv(process.env);
const client = createGatekeeperClient(env);
const handlers = createToolHandlers(client);

const server = new McpServer({
  name: "ha-gatekeeper-mcp",
  version: "0.1.0",
});

server.registerTool(
  "ha_list_capabilities",
  {
    title: "List Gatekeeper Capabilities",
    description: "List Home Assistant service actions and state reads allowed by Gatekeeper.",
    inputSchema: {},
  },
  handlers.ha_list_capabilities,
);

server.registerTool(
  "ha_call_service",
  {
    title: "Call Home Assistant Service",
    description: "Call an allowed Home Assistant service through Gatekeeper.",
    inputSchema: z.object({
      domain: z.string().min(1),
      service: z.string().min(1),
      entity_id: z.string().min(1).optional(),
      data: z.record(z.unknown()).optional(),
    }).strict(),
  },
  handlers.ha_call_service,
);

server.registerTool(
  "ha_read_state",
  {
    title: "Read Home Assistant State",
    description: "Read an allowed Home Assistant entity state through Gatekeeper.",
    inputSchema: z.object({
      entity_id: z.string().min(1),
    }).strict(),
  },
  handlers.ha_read_state,
);

await server.connect(new StdioServerTransport());
