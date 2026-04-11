import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { storage } from "$lib/server/watches";
// @ts-expect-error - Bun bundled package, types resolve at runtime
import { CreateWatchSchema } from "marktplaats-js";

export const GET: RequestHandler = async ({ locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) return error(401, "Unauthorized");

	return json(storage.getWatchesByUser(session.user.id));
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) return error(401, "Unauthorized");

	const body = await request.json();
	const input = { ...body, userId: session.user.id };
	const parsed = CreateWatchSchema.safeParse(input);

	if (!parsed.success) {
		return json({ error: parsed.error.message }, { status: 400 });
	}

	const now = new Date().toISOString();
	const watch = {
		id: crypto.randomUUID(),
		...parsed.data,
		enabled: true,
		createdAt: now,
		updatedAt: now,
	};

	storage.addWatch(watch);
	return json(watch, { status: 201 });
};
