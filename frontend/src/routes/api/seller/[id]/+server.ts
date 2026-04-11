import { json, error } from '@sveltejs/kit';
import { fetchSellerListings } from 'marktplaats-js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const page = parseInt(url.searchParams.get('page') ?? '1', 10);
	const limit = parseInt(url.searchParams.get('limit') ?? '30', 10);

	try {
		const listings = await fetchSellerListings({
			sellerId: params.id,
			limit,
			page
		});
		return json(listings);
	} catch (e) {
		if (e instanceof Error && e.message.includes('not found')) {
			throw error(404, 'Verkoper niet gevonden');
		}
		throw error(500, 'Laden mislukt');
	}
};
