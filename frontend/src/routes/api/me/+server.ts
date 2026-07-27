import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) return error(401, "Unauthorized");

	return json({ userId: session.user.id, name: session.user.name ?? undefined });
};
