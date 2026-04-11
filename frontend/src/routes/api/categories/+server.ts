import { json } from '@sveltejs/kit';
import { fetchCategories } from 'marktplaats-js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const categories = await fetchCategories();
	return json(categories);
};
