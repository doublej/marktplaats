import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { pollWatchByUser } from "$lib/server/watches";

export const POST: RequestHandler = async ({ params, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) return error(401, "Unauthorized");

	const eventsCount = await pollWatchByUser(params.id, session.user.id);

	if (eventsCount === null) {
		return json({ error: "Watch not found" }, { status: 404 });
	}

	return json({ polled: true, eventsCount });
};
