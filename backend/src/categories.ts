import { load } from "cheerio";
import { ScrapingError } from "./types.js";

const BASE_URL = "https://www.marktplaats.nl";

const USER_AGENTS = [
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function getHeaders(): Record<string, string> {
	const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] ?? USER_AGENTS[0] ?? "";
	return {
		"User-Agent": ua,
		Accept: "application/json, text/html",
		"Accept-Language": "nl-NL,nl;q=0.9",
	};
}

export interface Category {
	id: number;
	name: string;
	slug: string;
	parentId: number | null;
	children?: Category[];
}

export interface CategoryTree {
	categories: Category[];
	fetchedAt: Date;
}

function slugToName(slug: string): string {
	return slug
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ")
		.replace(/\s+S$/, "'s"); // auto-s → Auto's
}

/**
 * Fetch 3-level category tree from Marktplaats homepage.
 * Parses pipe-separated names (e.g., "Antiek | Glas") into L2/L3 hierarchy.
 */
export async function fetchCategoryTree(timeout = 30000): Promise<CategoryTree> {
	const response = await fetch(`${BASE_URL}/`, {
		headers: getHeaders(),
		signal: AbortSignal.timeout(timeout),
	});

	if (!response.ok) {
		throw new ScrapingError(`Failed to fetch categories: HTTP ${response.status}`);
	}

	const html = await response.text();
	const $ = load(html);

	const parentMap = new Map<string, Category>();
	// L2 key: "parentSlug/l2Name" → L2 category with children
	const l2Map = new Map<string, Category>();

	$('a[href^="/l/"]').each((_, el) => {
		const href = $(el).attr("href");
		if (!href) return;

		const match = /^\/l\/([^/]+)(?:\/([^/]+))?/.exec(href);
		if (!match?.[1]) return;

		const parentSlug = match[1];
		const childSlug = match[2];

		if (!parentMap.has(parentSlug)) {
			parentMap.set(parentSlug, {
				id: 0,
				name: slugToName(parentSlug),
				slug: parentSlug,
				parentId: null,
				children: [],
			});
		}

		if (childSlug) {
			const rawName = $(el).text().trim();
			if (!rawName || rawName.length > 80) return;

			const parts = rawName.split("|").map((p) => p.trim());
			const l2Name = parts[0] ?? rawName;
			const l3Name = parts[1];
			const l2Key = `${parentSlug}/${l2Name}`;

			if (!l2Map.has(l2Key)) {
				l2Map.set(l2Key, {
					id: 0,
					name: l2Name,
					slug: `${parentSlug}/${childSlug}`,
					parentId: 0,
					children: [],
				});
			}

			if (l3Name) {
				const l2 = l2Map.get(l2Key)!;
				if (!l2.children?.some((c) => c.name === l3Name)) {
					l2.children = l2.children ?? [];
					l2.children.push({
						id: 0,
						name: l3Name,
						slug: `${parentSlug}/${childSlug}`,
						parentId: 0,
					});
				}
			}
		}
	});

	// Group L2s under parents
	for (const [key, l2] of l2Map) {
		const parentSlug = key.split("/")[0] ?? "";
		const parent = parentMap.get(parentSlug);
		if (parent) {
			parent.children = parent.children ?? [];
			if (!parent.children.some((c) => c.name === l2.name)) {
				parent.children.push(l2);
			}
		}
	}

	const categories = Array.from(parentMap.values());

	return { categories, fetchedAt: new Date() };
}

/**
 * Fetch all L1 categories from Marktplaats
 */
export async function fetchCategories(timeout = 30000): Promise<Category[]> {
	const tree = await fetchCategoryTree(timeout);
	return tree.categories;
}

/**
 * Fetch subcategories for a given L1 category
 */
export async function fetchSubcategories(
	categorySlug: string,
	timeout = 30000,
): Promise<Category[]> {
	const response = await fetch(`${BASE_URL}/l/${categorySlug}/`, {
		headers: getHeaders(),
		signal: AbortSignal.timeout(timeout),
	});

	if (!response.ok) {
		if (response.status === 404) {
			throw new ScrapingError(`Category not found: ${categorySlug}`);
		}
		throw new ScrapingError(`Failed to fetch subcategories: HTTP ${response.status}`);
	}

	const html = await response.text();
	const $ = load(html);

	const subcategories: Category[] = [];
	let parentId = 0;

	// Try to extract category ID from page data
	const scripts = $("script").toArray();
	for (const script of scripts) {
		const content = $(script).html() ?? "";
		const idMatch = /"categoryId"\s*:\s*(\d+)/.exec(content);
		if (idMatch?.[1]) {
			parentId = Number.parseInt(idMatch[1], 10);
			break;
		}
	}

	// Parse subcategory links
	$(`a[href^="/l/${categorySlug}/"]`).each((_, el) => {
		const href = $(el).attr("href");
		const name = $(el).text().trim();
		if (!href || !name || name.length > 50) return;

		const match = new RegExp(`^/l/${categorySlug}/([^/]+)/?$`).exec(href);
		if (!match?.[1]) return;

		const slug = match[1];
		if (subcategories.some((c) => c.slug === slug)) return;

		subcategories.push({
			id: 0,
			name,
			slug: `${categorySlug}/${slug}`,
			parentId,
		});
	});

	return subcategories;
}

/**
 * Build a category URL for browsing or searching within a category
 */
export function buildCategoryUrl(categorySlug: string, query?: string): string {
	const base = `${BASE_URL}/l/${categorySlug}/`;
	if (!query) return base;
	return `${base}?query=${encodeURIComponent(query)}`;
}
