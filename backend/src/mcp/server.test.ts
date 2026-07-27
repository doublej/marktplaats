import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { COMMANDS } from "../ops/index.js";
import { createServer } from "./server.js";

async function connect(): Promise<Client> {
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	const client = new Client({ name: "test", version: "0.0.0" });
	await Promise.all([createServer().connect(serverTransport), client.connect(clientTransport)]);
	return client;
}

/** Tool results are JSON text; parse the first content block. */
function payload(result: unknown): unknown {
	const { content } = result as { content: { type: string; text: string }[] };
	const first = content[0];
	expect(first?.type).toBe("text");
	return JSON.parse(first?.text ?? "null");
}

describe("mcp server", () => {
	test("exposes a tool for every CLI command", async () => {
		const client = await connect();
		const { tools } = await client.listTools();
		const names = new Set(tools.map((t) => t.name));

		for (const cmd of COMMANDS) {
			expect(names).toContain(cmd.tool);
		}
		// COMMANDS omits `prime` (it is the catalogue itself), so add one.
		expect(names).toContain("prime");
		expect(names.size).toBe(COMMANDS.length + 1);
	});

	test("every tool carries a description and annotations", async () => {
		const client = await connect();
		const { tools } = await client.listTools();

		for (const tool of tools) {
			expect(tool.description?.length ?? 0).toBeGreaterThan(20);
			expect(tool.annotations).toBeDefined();
		}
	});

	test("prime returns the overview and command catalogue", async () => {
		const client = await connect();
		const data = payload(await client.callTool({ name: "prime", arguments: {} })) as {
			name: string;
			commands: { tool: string }[];
		};

		expect(data.name).toBe("marktplaats-js");
		expect(data.commands.length).toBe(COMMANDS.length);
	});

	test("status reports provider health without network access", async () => {
		const client = await connect();
		const data = payload(await client.callTool({ name: "status", arguments: {} })) as {
			healthyCount: number;
		};

		expect(data.healthyCount).toBeGreaterThanOrEqual(0);
	});

	test("a missing record returns a coded error, not a transport failure", async () => {
		const client = await connect();
		const result = (await client.callTool({
			name: "watch_delete",
			arguments: { id: "00000000-0000-4000-8000-000000000000" },
		})) as { content: unknown[]; isError?: boolean };

		expect(result.isError).toBe(true);
		expect(payload(result)).toMatchObject({ code: "NOT_FOUND" });
	});

	test("invalid input is rejected before the op runs", async () => {
		const client = await connect();
		const result = (await client.callTool({
			name: "search",
			arguments: { query: "" },
		})) as { content: { text: string }[]; isError?: boolean };

		expect(result.isError).toBe(true);
		expect(result.content[0]?.text).toMatch(/validation/i);
	});
});
