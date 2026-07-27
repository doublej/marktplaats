#!/usr/bin/env bun
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

// stdout is the MCP transport — anything written there that is not a protocol
// frame corrupts the session, so diagnostics go to stderr.
const server = createServer();
await server.connect(new StdioServerTransport());
console.error("marktplaats mcp server ready (stdio)");
