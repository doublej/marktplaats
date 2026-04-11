import { json } from '@sveltejs/kit';
import { fetchSubcategories } from 'marktplaats-js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const subcategories = await fetchSubcategories(params.slug);
	return json(subcategories);
};
