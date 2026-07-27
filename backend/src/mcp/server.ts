import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VERSION } from "../ops/index.js";
import { registerTools } from "./tools.js";

const INSTRUCTIONS = `Scrape and post to marktplaats.nl, the Dutch classifieds site.

Call \`prime\` first — it reports provider health, the storage path, existing watches and linked accounts, and the full command catalogue.

Conventions:
- Every price is an integer in CENTS. €50 is 5000. Never pass euros.
- \`search\` and \`seller\` return listing summaries; \`detail\` fetches the full page for one ad.
- Category slugs for \`search\` come from \`categories\`; numeric category ids for \`mp_create_ad\` come from the same tool.
- Watches are saved searches polled on an interval; \`watch_poll\` runs one immediately.
- \`mp_link\` opens a browser window on the user's machine and \`mp_create_ad\` publishes a real, publicly visible ad. Confirm with the user before calling either.

The site is scraped, not an official API — roughly 30 requests per minute. Batch work and avoid tight loops.`;

export function createServer(): McpServer {
	const server = new McpServer(
		{ name: "marktplaats", version: VERSION },
		{ instructions: INSTRUCTIONS },
	);
	registerTools(server);
	return server;
}
