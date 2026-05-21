#!/usr/bin/env node
import { readMcpEnv } from "./gatekeeperClient.js";

try {
  readMcpEnv(process.env);
  console.error("ha-gatekeeper-mcp: MCP stdio server entrypoint is not implemented yet.");
  process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Failed to read MCP environment");
  process.exitCode = 1;
}
