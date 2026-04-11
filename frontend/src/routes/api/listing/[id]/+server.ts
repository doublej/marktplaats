import { json, error } from '@sveltejs/kit';
import { fetchListingDetail, RateLimitError, ScrapingError } from 'marktplaats-js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const listingUrl = url.searchParams.get('url');

	if (!listingUrl) {
		throw error(400, 'Missing url parameter');
	}

	try {
		const detail = await fetchListingDetail(listingUrl);
		return json(detail);
	} catch (e) {
		if (e instanceof RateLimitError) {
			throw error(429, 'Rate limited');
		}
		if (e instanceof ScrapingError) {
			throw error(502, (e as Error).message);
		}
		throw error(500, 'Failed to fetch listing');
	}
};
