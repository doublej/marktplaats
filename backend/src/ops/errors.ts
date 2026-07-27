import { MarktplaatsError } from "../types.js";

/**
 * Operation-level failure (bad input, missing record). Surfaces as a CLI
 * `error:` line or an MCP `isError` result — never as a process exit, so the
 * same op can run inside a long-lived server.
 */
export class OpsError extends MarktplaatsError {
	constructor(message: string, code: string) {
		super(message, code);
		this.name = "OpsError";
	}
}

export function notFound(message: string): never {
	throw new OpsError(message, "NOT_FOUND");
}

export function invalidArg(message: string): never {
	throw new OpsError(message, "MISSING_ARG");
}
