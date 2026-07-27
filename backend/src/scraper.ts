import { type Cheerio, load } from "cheerio";
import type { AnyNode } from "domhandler";
import type { ListingItem, SearchOptions, SortBy, SortOrder } from "./types.js";
import { ScrapingError } from "./types.js";
import { parsePrice } from "./utils/price.js";
import { cleanDescription, cleanTitle, parseDutchDate } from "./utils/text.js";

const BASE_URL = "https://www.marktplaats.nl";

const USER_AGENTS = [
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
];

function randomUserAgent(): string {
	const idx = Math.floor(Math.random() * USER_AGENTS.length);
	return USER_AGENTS[idx] ?? USER_AGENTS[0] ?? "";
}

function getHeaders(): Record<string, string> {
	return {
		"User-Agent": randomUserAgent() ?? "",
		Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
		"Accept-Language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
		"Accept-Encoding": "gzip, deflate, br",
		"Sec-Fetch-Dest": "document",
		"Sec-Fetch-Mode": "navigate",
		"Sec-Fetch-Site": "none",
		"Sec-Fetch-User": "?1",
		"Cache-Control": "no-cache",
	};
}

interface SearchParams {
	postcode?: string;
	distanceMeters?: number;
	PriceCentsFrom?: number;
	PriceCentsTo?: number;
	sortBy?: SortBy;
	sortOrder?: SortOrder;
	page?: number;
	categorySlug?: string;
	fuel?: string;
	body?: string;
}

// Body type → Marktplaats URL path segment (properly filtered by server)
const BODY_SLUG_MAP: Record<string, { slug: string; id: string }> = {
	Stationwagon: { slug: "stationwagon", id: "484" },
	Hatchback: { slug: "hatchback", id: "463" },
	SUV: { slug: "suv-of-terreinwagen", id: "465" },
	MPV: { slug: "mpv", id: "466" },
	Sedan: { slug: "sedan", id: "464" },
	Cabriolet: { slug: "cabriolet", id: "461" },
};

function buildSearchUrl(query: string, params: SearchParams): string {
	// Body type uses /l/auto-s/f/<slug>/<id>/ for proper server-side filtering
	let basePath: string;
	const bodyEntry = params.body ? BODY_SLUG_MAP[params.body] : undefined;
	if (bodyEntry) {
		basePath = `${BASE_URL}/l/auto-s/f/${bodyEntry.slug}/${bodyEntry.id}/`;
	} else if (params.categorySlug) {
		basePath = `${BASE_URL}/l/${params.categorySlug}/`;
	} else {
		basePath = `${BASE_URL}/q/${encodeURIComponent(query)}/`;
	}

	const url = new URL(basePath);

	// Add query param for category-filtered pages (not body-filtered — it confuses results)
	if (params.categorySlug && !bodyEntry && query) {
		url.searchParams.set("query", query);
	}

	if (params.postcode) url.searchParams.set("postcode", params.postcode);
	if (params.distanceMeters)
		url.searchParams.set("distanceMeters", params.distanceMeters.toString());
	if (params.PriceCentsFrom)
		url.searchParams.set("PriceCentsFrom", params.PriceCentsFrom.toString());
	if (params.PriceCentsTo) url.searchParams.set("PriceCentsTo", params.PriceCentsTo.toString());
	if (params.sortBy) url.searchParams.set("sortBy", params.sortBy);
	if (params.sortOrder) url.searchParams.set("sortOrder", params.sortOrder);
	if (params.page && params.page > 1) url.searchParams.set("currentPage", params.page.toString());

	// Fuel filter via attributesByKey[] (works on category/body-filter pages)
	if (params.fuel) {
		const base = url.toString();
		return `${base}${base.includes("?") ? "&" : "?"}attributesByKey[]=fuel:${encodeURIComponent(params.fuel)}`;
	}

	return url.toString();
}

function mapSortOptions(
	sortBy?: "price" | "date",
	sortOrder?: "asc" | "desc",
): { sortBy?: SortBy; sortOrder?: SortOrder } {
	const result: { sortBy?: SortBy; sortOrder?: SortOrder } = {};

	if (sortBy === "price") result.sortBy = "PRICE";
	else if (sortBy === "date") result.sortBy = "DATE";

	if (sortOrder === "asc") result.sortOrder = "INCREASING";
	else if (sortOrder === "desc") result.sortOrder = "DECREASING";

	return result;
}

function extractListingId(href: string): string | null {
	const match = /\/m(\d+)/.exec(href);
	return match?.[1] ? `m${match[1]}` : null;
}

function extractPrice(element: Cheerio<AnyNode>): { display: string; cents: number | null } {
	// Try various price selectors
	const priceSelectors = [
		'[class*="price"]',
		".hz-Listing-price",
		'span:contains("€")',
		'p:contains("€")',
	];

	for (const selector of priceSelectors) {
		const priceEl = element.find(selector).first();
		if (priceEl.length) {
			const text = priceEl.text().trim();
			if (text.includes("€") || /\d/.test(text)) {
				return parsePrice(text);
			}
		}
	}

	// Fallback: search all text for price pattern
	const fullText = element.text();
	const priceMatch = /€\s*[\d.,]+/.exec(fullText);
	if (priceMatch) {
		return parsePrice(priceMatch[0]);
	}

	return { display: "Prijs niet gevonden", cents: null };
}

function extractImage(element: Cheerio<AnyNode>): string | null {
	const img = element.find("img").first();
	if (!img.length) return null;

	// Try various image source attributes
	const src = img.attr("src") || img.attr("data-src") || img.attr("data-lazy-src");
	if (!src || src.includes("placeholder")) return null;

	// Convert relative URLs to absolute
	if (src.startsWith("//")) return `https:${src}`;
	if (src.startsWith("/")) return `${BASE_URL}${src}`;
	return src;
}

function extractViews(element: Cheerio<AnyNode>): number | null {
	const text = element.text();
	const match = /(\d+)\s*(?:keer\s*)?bekeken/i.exec(text);
	return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function extractDate(element: Cheerio<AnyNode>): Date | null {
	const dateSelectors = ['[class*="date"]', '[class*="time"]', "time"];

	for (const selector of dateSelectors) {
		const dateEl = element.find(selector).first();
		if (dateEl.length) {
			const datetime = dateEl.attr("datetime");
			if (datetime) {
				const parsed = new Date(datetime);
				if (!Number.isNaN(parsed.getTime())) return parsed;
			}

			const text = dateEl.text().trim();
			const parsed = parseDutchDate(text);
			if (parsed) return parsed;
		}
	}

	// Search text for date patterns
	const text = element.text();
	const patterns = [
		/(\d{1,2})\s+(jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)\.?\s*(\d{4})?/i,
		/(vandaag|gisteren)/i,
		/(\d+)\s*(dag|dagen|week|weken)\s*geleden/i,
	];

	for (const pattern of patterns) {
		const match = pattern.exec(text);
		if (match) {
			return parseDutchDate(match[0]);
		}
	}

	return null;
}

function extractLocation(element: Cheerio<AnyNode>): string | null {
	const locationSelectors = ['[class*="location"]', '[class*="seller"]', '[class*="place"]'];

	for (const selector of locationSelectors) {
		const locEl = element.find(selector).first();
		if (locEl.length) {
			const text = locEl.text().trim();
			if (text && text.length < 50) return text;
		}
	}

	return null;
}

function extractDescriptionSnippet(element: Cheerio<AnyNode>): string | null {
	// Try specific description selectors first (most to least specific)
	const selectors = [
		'[class*="Description"]:not([class*="container"]):not([class*="wrapper"])',
		'[class*="snippet"]:not([class*="container"])',
		'[class*="text"]:not([class*="price"]):not([class*="title"]):not([class*="location"])',
	];

	for (const selector of selectors) {
		const el = element.find(selector).first();
		if (el.length) {
			// Get only direct text content, not nested elements
			const directText = el
				.contents()
				.filter((_, node) => node.type === "text")
				.text()
				.trim();

			if (directText.length > 10) {
				return cleanDescription(directText);
			}

			// Fall back to full text if direct text is too short
			const fullText = el.text().trim();
			const cleaned = cleanDescription(fullText);
			if (cleaned && cleaned.length > 10) {
				return cleaned;
			}
		}
	}

	// Last resort: find a <p> that looks like description (not in header/footer areas)
	const paragraphs = element.find("p");
	for (let i = 0; i < paragraphs.length; i++) {
		const p = paragraphs.eq(i);
		const text = p.text().trim();
		// Skip if it looks like metadata or specs
		if (text.length < 15) continue;
		if (/^\d+\s*(GB|MB|keer|euro)/i.test(text)) continue;
		if (/^(nieuw|gebruikt|bieden|details)/i.test(text)) continue;

		const cleaned = cleanDescription(text);
		if (cleaned && cleaned.length > 15) {
			return cleaned;
		}
	}

	return null;
}

type ListingStatus = "active" | "sold" | "reserved" | "expired";

function extractStatus(element: Cheerio<AnyNode>): ListingStatus {
	const text = element.text().toLowerCase();
	const classes = (element.attr("class") ?? "").toLowerCase();
	const html = element.html()?.toLowerCase() ?? "";

	// Check for status badges/labels
	if (text.includes("verkocht") || classes.includes("sold") || html.includes("verkocht"))
		return "sold";
	if (text.includes("gereserveerd") || classes.includes("reserved") || html.includes("reserved"))
		return "reserved";
	if (text.includes("verlopen") || classes.includes("expired") || html.includes("expired"))
		return "expired";

	return "active";
}

function parseListingElement(element: Cheerio<AnyNode>): ListingItem | null {
	// Find the main link
	const link = element.find('a[href*="/m"]').first();
	if (!link.length) return null;

	const href = link.attr("href");
	if (!href) return null;

	const listingId = extractListingId(href);
	if (!listingId) return null;

	// Extract title - be specific to avoid grabbing all card text
	const titleSelectors = [
		".hz-Listing-title",
		"[class*='Title']:not([class*='sub'])",
		"h3",
		"h2",
		"h1",
	];
	let title = "";
	for (const sel of titleSelectors) {
		const el = element.find(sel).first();
		if (el.length) {
			// Get only direct text, not nested elements
			title = el.clone().children().remove().end().text().trim() || el.text().trim();
			if (title) break;
		}
	}
	if (!title) {
		// Fallback: get link text but limit length
		title =
			link
				.text()
				.trim()
				.split(/€|\d{2,}/)[0]
				?.trim() ?? "";
	}
	title = cleanTitle(title);
	if (!title) return null;

	// Extract price
	const { display: price, cents: priceCents } = extractPrice(element);

	// Build URL
	const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

	// Extract optional fields
	const imageUrl = extractImage(element);
	const views = extractViews(element);
	const datePosted = extractDate(element);
	const location = extractLocation(element);

	// Extract description snippet - prefer specific elements, avoid containers
	const descriptionSnippet = extractDescriptionSnippet(element);

	// Extract status
	const status = extractStatus(element);

	return {
		sourceListingId: listingId,
		title,
		price,
		priceCents,
		url,
		descriptionSnippet,
		imageUrl,
		location,
		seller: null,
		views,
		condition: null,
		datePosted,
		rawHtml: null,
		status,
	};
}

function parseNextDataListing(l: Record<string, unknown>): ListingItem | null {
	const id = String(l.itemId ?? "");
	if (!id) return null;
	const loc = l.location as Record<string, unknown> | undefined;
	if (loc?.onCountryLevel) return null;
	const priceInfo = l.priceInfo as Record<string, unknown> | undefined;
	const priceCents = typeof priceInfo?.priceCents === "number" ? priceInfo.priceCents : null;
	const imageUrls = l.imageUrls as string[] | undefined;
	const rawImage = imageUrls?.[0] ?? null;
	const imageUrl = rawImage ? (rawImage.startsWith("//") ? `https:${rawImage}` : rawImage) : null;
	const cityName = (loc?.cityName as string) ?? null;
	const title = String(l.title ?? "");
	const vipUrl = l.vipUrl as string | undefined;
	const url = vipUrl ? `${BASE_URL}${vipUrl}` : `${BASE_URL}/v/auto-s/${id}`;
	return {
		sourceListingId: id,
		title: cleanTitle(title),
		price: priceCents !== null ? `€ ${(priceCents / 100).toLocaleString("nl-NL")}` : "Bieden",
		priceCents,
		url,
		descriptionSnippet: (cleanDescription(String(l.description ?? "")) ?? "").slice(0, 200) || null,
		imageUrl,
		location: cityName,
		seller:
			((l.sellerInformation as Record<string, unknown> | undefined)?.sellerName as string | null) ??
			null,
		views: null,
		condition: null,
		datePosted: null,
		rawHtml: null,
		status: l.reserved === true ? "reserved" : "active",
	};
}

/**
 * Extract listings from Marktplaats __NEXT_DATA__ JSON
 */
function extractListingsFromNextData(data: Record<string, unknown>): ListingItem[] {
	// First try the structured path: searchRequestAndResponse.listings
	const srr = data as Record<string, unknown>;
	try {
		const pageProps = (srr as Record<string, Record<string, unknown>>).props?.pageProps as Record<
			string,
			unknown
		>;
		const searchRR = pageProps?.searchRequestAndResponse as Record<string, unknown>;
		const rawListings = searchRR?.listings as Record<string, unknown>[];
		if (Array.isArray(rawListings) && rawListings.length > 0) {
			const seen = new Set<string>();
			const result: ListingItem[] = [];
			for (const raw of rawListings) {
				const item = parseNextDataListing(raw);
				if (item && !seen.has(item.sourceListingId)) {
					seen.add(item.sourceListingId);
					result.push(item);
				}
			}
			if (result.length > 0) return result;
		}
	} catch {
		/* fall through */
	}

	// Recursively find arrays with itemId fields (the listings)
	function findListingArrays(obj: unknown, depth = 0): ListingItem[] {
		if (depth > 6 || !obj || typeof obj !== "object") return [];
		if (Array.isArray(obj)) {
			if (obj.length > 0 && typeof obj[0] === "object" && obj[0] !== null && "itemId" in obj[0]) {
				const seen = new Set<string>();
				const result: ListingItem[] = [];
				for (const raw of obj) {
					const item = parseNextDataListing(raw as Record<string, unknown>);
					if (item && !seen.has(item.sourceListingId)) {
						seen.add(item.sourceListingId);
						result.push(item);
					}
				}
				return result;
			}
			// recurse into array items
			for (const item of obj) {
				const found = findListingArrays(item, depth + 1);
				if (found.length > 0) return found;
			}
			return [];
		}
		for (const val of Object.values(obj as Record<string, unknown>)) {
			const found = findListingArrays(val, depth + 1);
			if (found.length > 0) return found;
		}
		return [];
	}
	return findListingArrays(data);
}

/**
 * Fetch and parse listings from Marktplaats
 */
export async function fetchListings(options: SearchOptions): Promise<ListingItem[]> {
	const { sortBy, sortOrder } = mapSortOptions(options.sortBy, options.sortOrder);

	const params: SearchParams = {
		postcode: options.zipCode,
		distanceMeters: options.distance ? options.distance * 1000 : undefined,
		PriceCentsFrom: options.priceFromCents,
		PriceCentsTo: options.priceToCents,
		sortBy,
		sortOrder,
		page: options.page,
		categorySlug: options.categorySlug,
		fuel: options.fuel,
		body: options.body,
	};

	const url = buildSearchUrl(options.query, params);
	const timeout = options.timeout ?? 30000;

	const response = await fetch(url, {
		headers: getHeaders(),
		signal: AbortSignal.timeout(timeout),
	});

	if (!response.ok) {
		if (response.status === 429) {
			throw new ScrapingError("Rate limited by Marktplaats");
		}
		throw new ScrapingError(`HTTP ${response.status}: ${response.statusText}`);
	}

	const html = await response.text();

	// Check for blocking
	const lowerHtml = html.toLowerCase();
	if (lowerHtml.includes("blocked") || lowerHtml.includes("captcha")) {
		throw new ScrapingError("Request blocked by Marktplaats (captcha or IP block)");
	}

	// --- Primary: parse __NEXT_DATA__ JSON (reliable, structured) ---
	const nextDataMatch = /__NEXT_DATA__[^>]*>({.*?})<\/script/s.exec(html);
	if (nextDataMatch?.[1]) {
		try {
			const nextData = JSON.parse(nextDataMatch[1]);
			const jsonListings = extractListingsFromNextData(nextData);
			if (jsonListings.length > 0) {
				const limit = options.limit ?? 10;
				return jsonListings.slice(0, limit);
			}
		} catch {
			// fall through to HTML scraping
		}
	}

	// --- Fallback: HTML scraping ---
	const $ = load(html);
	const listings: ListingItem[] = [];

	// Try multiple container selectors
	const containerSelectors = [
		".hz-Listing-item-wrapper",
		".hz-Listing-listview-content",
		'[class*="Listing"]',
		"article[data-listing-id]",
	];

	for (const selector of containerSelectors) {
		const elements = $(selector);
		if (elements.length === 0) continue;

		elements.each((_, el) => {
			const listing = parseListingElement($(el));
			if (listing) {
				listings.push(listing);
			}
		});

		if (listings.length > 0) break;
	}

	// Fallback: find all links matching listing pattern
	if (listings.length === 0) {
		const links = $('a[href*="/m"]');
		const seenIds = new Set<string>();

		links.each((_, el) => {
			const href = $(el).attr("href");
			if (!href) return;

			const listingId = extractListingId(href);
			if (!listingId || seenIds.has(listingId)) return;
			seenIds.add(listingId);

			// Find parent container
			const parent = $(el).closest("li, article, div[class*='Listing'], div[class*='item']");
			const container = parent.length ? parent : $(el).parent();

			const listing = parseListingElement(container);
			if (listing) {
				listings.push(listing);
			}
		});
	}

	// Deduplicate by listing ID
	const seen = new Set<string>();
	const deduped = listings.filter((l) => {
		if (seen.has(l.sourceListingId)) return false;
		seen.add(l.sourceListingId);
		return true;
	});

	const limit = options.limit ?? 10;
	return deduped.slice(0, limit);
}

export interface SellerListingsOptions {
	sellerId: string;
	limit?: number;
	page?: number;
	timeout?: number;
}

/**
 * Fetch listings from a specific seller
 */
export async function fetchSellerListings(options: SellerListingsOptions): Promise<ListingItem[]> {
	const { sellerId, limit = 30, page, timeout = 30000 } = options;

	const url = new URL(`${BASE_URL}/u/${encodeURIComponent(sellerId)}/`);
	if (page && page > 1) url.searchParams.set("currentPage", page.toString());

	const response = await fetch(url.toString(), {
		headers: getHeaders(),
		signal: AbortSignal.timeout(timeout),
	});

	if (!response.ok) {
		if (response.status === 404) {
			throw new ScrapingError(`Seller not found: ${sellerId}`);
		}
		if (response.status === 429) {
			throw new ScrapingError("Rate limited by Marktplaats");
		}
		throw new ScrapingError(`HTTP ${response.status}: ${response.statusText}`);
	}

	const html = await response.text();

	const lowerHtml = html.toLowerCase();
	if (lowerHtml.includes("blocked") || lowerHtml.includes("captcha")) {
		throw new ScrapingError("Request blocked by Marktplaats (captcha or IP block)");
	}

	const $ = load(html);
	const listings: ListingItem[] = [];

	// Same container selectors as search results
	const containerSelectors = [
		".hz-Listing-item-wrapper",
		".hz-Listing-listview-content",
		'[class*="Listing"]',
		"article[data-listing-id]",
	];

	for (const selector of containerSelectors) {
		const elements = $(selector);
		if (elements.length === 0) continue;

		elements.each((_, el) => {
			const listing = parseListingElement($(el));
			if (listing) listings.push(listing);
		});

		if (listings.length > 0) break;
	}

	// Fallback: find all links matching listing pattern
	if (listings.length === 0) {
		const links = $('a[href*="/m"]');
		const seenIds = new Set<string>();

		links.each((_, el) => {
			const href = $(el).attr("href");
			if (!href) return;

			const listingId = extractListingId(href);
			if (!listingId || seenIds.has(listingId)) return;
			seenIds.add(listingId);

			const parent = $(el).closest("li, article, div[class*='Listing'], div[class*='item']");
			const container = parent.length ? parent : $(el).parent();

			const listing = parseListingElement(container);
			if (listing) listings.push(listing);
		});
	}

	return listings.slice(0, limit);
}
