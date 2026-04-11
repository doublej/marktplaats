import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { pollAllWatchesByUser } from "$lib/server/watches";

export const POST: RequestHandler = async ({ locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) return error(401, "Unauthorized");

	const result = await pollAllWatchesByUser(session.user.id);
	return json(result);
};
