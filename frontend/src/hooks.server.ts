import { createHash, timingSafeEqual } from "node:crypto";
import type { Session } from "@auth/sveltekit";
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { building } from "$app/environment";
import { env } from "$env/dynamic/private";
import { startScheduler } from "$lib/server/watches";
import { handle as authHandle } from "./auth";

function matchesToken(candidate: string, expected: string): boolean {
	const a = createHash("sha256").update(candidate).digest();
	const b = createHash("sha256").update(expected).digest();
	return timingSafeEqual(a, b);
}

const tokenHandle: Handle = async ({ event, resolve }) => {
	const expected = env.MP_API_TOKEN;
	const header = event.request.headers.get("authorization");

	if (expected && header?.startsWith("Bearer ") && matchesToken(header.slice(7), expected)) {
		const session: Session = {
			user: { id: env.MP_API_USER_ID || "api:token", name: "API token" },
			expires: new Date(Date.now() + 60 * 60_000).toISOString(),
		};
		event.locals.auth = async () => session;
	}

	return resolve(event);
};

export const handle = sequence(authHandle, tokenHandle);

if (!building && env.WATCH_SCHEDULER !== "0" && env.WATCH_SCHEDULER !== "false") {
	try {
		startScheduler();
		console.log("[watches] background scheduler started (set WATCH_SCHEDULER=0 to disable)");
	} catch (error) {
		console.error("[watches] scheduler failed to start, watch routes may be broken:", error);
	}
}
