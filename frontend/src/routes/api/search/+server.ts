import { json } from '@sveltejs/kit';
import { search } from 'marktplaats-js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();

	const result = await search({
		query: body.query,
		zipCode: body.zipCode,
		distance: body.distance,
		priceFromCents: body.priceFromCents,
		priceToCents: body.priceToCents,
		limit: body.limit ?? 20,
		sortBy: body.sortBy,
		sortOrder: body.sortOrder,
		timeout: body.timeout ?? 30000,
		page: body.page ?? 1,
		categorySlug: body.categorySlug
	});

	return json(result);
};
