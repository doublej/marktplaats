import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { MarktplaatsError } from "../types.js";

function text(data: unknown, isError?: true): CallToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
		...(isError && { isError }),
	};
}

/**
 * Runs an op and serialises it as a tool result. Failures come back as
 * `{ error, code }` with `isError` set — the same shape the CLI prints under
 * `--json` — so the model can read the reason and fix its next call instead of
 * seeing an opaque transport failure.
 */
export async function run(fn: () => unknown): Promise<CallToolResult> {
	try {
		return text(await fn());
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		const code =
			err instanceof MarktplaatsError ? (err.code ?? "EXECUTION_ERROR") : "EXECUTION_ERROR";
		return text({ error: message, code }, true);
	}
}
