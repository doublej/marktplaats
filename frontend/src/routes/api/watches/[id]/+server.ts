import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { storage } from "$lib/server/watches";
// @ts-expect-error - Bun bundled package, types resolve at runtime
import { UpdateWatchSchema } from "marktplaats-js";

export const GET: RequestHandler = async ({ params, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) return error(401, "Unauthorized");

	const watch = storage.getWatchByUser(params.id, session.user.id);
	if (!watch) return json({ error: "Watch not found" }, { status: 404 });

	return json({ watch, state: storage.getState(params.id) });
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) return error(401, "Unauthorized");

	const watch = storage.getWatchByUser(params.id, session.user.id);
	if (!watch) return json({ error: "Watch not found" }, { status: 404 });

	const body = await request.json();
	const parsed = UpdateWatchSchema.safeParse(body);

	if (!parsed.success) {
		return json({ error: parsed.error.message }, { status: 400 });
	}

	const updates: Partial<typeof watch> = { updatedAt: new Date().toISOString() };
	if (parsed.data.name) updates.name = parsed.data.name;
	if (parsed.data.intervalMinutes) updates.intervalMinutes = parsed.data.intervalMinutes;
	if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;
	if (parsed.data.webhookUrl !== undefined) {
		updates.webhookUrl = parsed.data.webhookUrl ?? undefined;
	}
	if (parsed.data.searchOptions) {
		updates.searchOptions = { ...watch.searchOptions, ...parsed.data.searchOptions };
	}

	return json(storage.updateWatch(params.id, updates));
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) return error(401, "Unauthorized");

	const watch = storage.getWatchByUser(params.id, session.user.id);
	if (!watch) return json({ error: "Watch not found" }, { status: 404 });

	storage.deleteWatch(params.id);
	return json({ deleted: true });
};
