import { type Cheerio, load } from "cheerio";
import type { AnyNode } from "domhandler";
import type { ListingDetail } from "./types.js";
import { ScrapingError } from "./types.js";
import { parsePrice } from "./utils/price.js";
import { normalizePreservingNewlines, parseDutchDate } from "./utils/text.js";

/**
 * Extract text from element, converting <br> and block elements to newlines
 */
function extractTextWithBreaks($el: Cheerio<AnyNode>): string {
	const html = $el.html();
	if (!html) return "";

	// Convert <br> to newlines
	let text = html.replace(/<br\s*\/?>/gi, "\n");

	// Add newlines after block elements
	text = text.replace(/<\/(p|div|li|h[1-6])>/gi, "\n");

	// Strip remaining HTML tags
	text = text.replace(/<[^>]+>/g, "");

	// Decode HTML entities
	text = text
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/&#x27;/gi, "'");

	return normalizePreservingNewlines(text);
}

const BASE_URL = "https://www.marktplaats.nl";

const USER_AGENTS = [
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function getHeaders(): Record<string, string> {
	const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] ?? USER_AGENTS[0] ?? "";
	return {
		"User-Agent": ua,
		Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
		"Accept-Language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
		"Sec-Fetch-Dest": "document",
		"Sec-Fetch-Mode": "navigate",
	};
}

function extractImages($: ReturnType<typeof load>): string[] {
	const images: string[] = [];
	const seen = new Set<string>();

	// Try image carousel/gallery
	$('[class*="Gallery"] img, [class*="carousel"] img, [class*="image"] img').each((_, el) => {
		const src = $(el).attr("src") || $(el).attr("data-src");
		if (src && !src.includes("placeholder") && !seen.has(src)) {
			seen.add(src);
			images.push(src.startsWith("//") ? `https:${src}` : src);
		}
	});

	// Try og:image meta tags
	$('meta[property="og:image"]').each((_, el) => {
		const content = $(el).attr("content");
		if (content && !seen.has(content)) {
			seen.add(content);
			images.push(content);
		}
	});

	return images;
}

function extractSeller($: ReturnType<typeof load>): ListingDetail["seller"] {
	const sellerSection = $('[class*="Seller"], [class*="seller"], [data-testid*="seller"]');

	let name: string | null = null;
	let id: string | null = null;
	let memberSince: string | null = null;
	let responseTime: string | null = null;

	// Seller name
	const nameEl = sellerSection.find('[class*="name"], a[href*="/u/"]').first();
	if (nameEl.length) {
		name = nameEl.text().trim() || null;
		const href = nameEl.attr("href");
		if (href) {
			const match = /\/u\/(\d+)/.exec(href);
			id = match?.[1] ?? null;
		}
	}

	// Member since
	const sinceText = sellerSection.text();
	const sinceMatch = /(?:lid sinds|member since)\s*:?\s*(\w+\s*\d{4})/i.exec(sinceText);
	memberSince = sinceMatch?.[1] ?? null;

	// Response time
	const responseMatch = /(?:reageert|responds?)\s*(?:binnen|within)?\s*([\w\s]+)/i.exec(sinceText);
	responseTime = responseMatch?.[1]?.trim() ?? null;

	return { name, id, memberSince, responseTime };
}

function extractAttributes($: ReturnType<typeof load>): Record<string, string> {
	const attrs: Record<string, string> = {};

	// Try attribute tables/lists
	$('[class*="Attribute"], [class*="attribute"], [class*="Specification"], dl, table').each(
		(_, container) => {
			const $container = $(container);

			// dt/dd pairs
			$container.find("dt").each((_, dt) => {
				const key = $(dt).text().trim().replace(/:$/, "");
				const value = $(dt).next("dd").text().trim();
				if (key && value) attrs[key] = value;
			});

			// th/td pairs
			$container.find("tr").each((_, row) => {
				const key = $(row).find("th").text().trim().replace(/:$/, "");
				const value = $(row).find("td").text().trim();
				if (key && value) attrs[key] = value;
			});

			// Label + value spans
			$container.find('[class*="label"], [class*="key"]').each((_, label) => {
				const key = $(label).text().trim().replace(/:$/, "");
				const value = $(label).next().text().trim();
				if (key && value) attrs[key] = value;
			});
		},
	);

	return attrs;
}

function extractBreadcrumbs($: ReturnType<typeof load>): string[] {
	const crumbs: string[] = [];
	$('[class*="Breadcrumb"] a, nav[aria-label*="bread"] a, .breadcrumb a').each((_, el) => {
		const text = $(el).text().trim();
		if (text && text !== "Home" && text !== "Marktplaats") {
			crumbs.push(text);
		}
	});
	return crumbs;
}

function extractViews($: ReturnType<typeof load>): number | null {
	const text = $("body").text();
	const match = /(\d+)\s*(?:keer\s*)?bekeken/i.exec(text);
	return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function extractFavorites($: ReturnType<typeof load>): number | null {
	const text = $("body").text();
	const match = /(\d+)\s*(?:keer\s*)?(?:opgeslagen|favoriet)/i.exec(text);
	return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function extractDate($: ReturnType<typeof load>): Date | null {
	// Try time element
	const timeEl = $("time[datetime]").first();
	if (timeEl.length) {
		const datetime = timeEl.attr("datetime");
		if (datetime) {
			const parsed = new Date(datetime);
			if (!Number.isNaN(parsed.getTime())) return parsed;
		}
	}

	// Try text patterns
	const text = $("body").text();
	const patterns = [
		/(?:geplaatst|aangeboden)\s*(?:op)?\s*:?\s*(\d{1,2}\s+\w+\s*\d{4})/i,
		/(\d{1,2}\s+\w+\s*\d{4})/,
	];

	for (const pattern of patterns) {
		const match = pattern.exec(text);
		if (match?.[1]) {
			const parsed = parseDutchDate(match[1]);
			if (parsed) return parsed;
		}
	}

	return null;
}

/**
 * Build listing URL from ID
 * Accepts: "m1234567890" or "1234567890" or full URL
 */
export function buildListingUrl(idOrUrl: string): string {
	if (idOrUrl.startsWith("http")) return idOrUrl;

	const numericId = idOrUrl.replace(/^m/, "");
	// Marktplaats redirects /a{id} to the full listing URL
	return `${BASE_URL}/a${numericId}`;
}

/**
 * Fetch and parse a listing detail page
 */
export async function fetchListingDetail(
	idOrUrl: string,
	options: { timeout?: number } = {},
): Promise<ListingDetail> {
	const url = buildListingUrl(idOrUrl);
	const timeout = options.timeout ?? 30000;

	const response = await fetch(url, {
		headers: getHeaders(),
		signal: AbortSignal.timeout(timeout),
		redirect: "follow",
	});

	if (!response.ok) {
		if (response.status === 404) {
			throw new ScrapingError(`Listing not found: ${idOrUrl}`);
		}
		if (response.status === 429) {
			throw new ScrapingError("Rate limited by Marktplaats");
		}
		throw new ScrapingError(`HTTP ${response.status}: ${response.statusText}`);
	}

	const html = await response.text();
	const finalUrl = response.url;

	// Check for blocking
	const lowerHtml = html.toLowerCase();
	if (lowerHtml.includes("blocked") || lowerHtml.includes("captcha")) {
		throw new ScrapingError("Request blocked by Marktplaats");
	}

	const $ = load(html);

	// Extract listing ID from final URL
	const idMatch = /m(\d+)/.exec(finalUrl);
	const id = idMatch ? `m${idMatch[1]}` : idOrUrl.replace(/^m/, "");

	// Title
	const title =
		$("h1").first().text().trim() ||
		$('[class*="Title"]').first().text().trim() ||
		$('meta[property="og:title"]').attr("content") ||
		"";

	// Description - preserve line breaks from <br> and block elements
	const descEl = $('[class*="Description"], [data-testid*="description"]').first();
	let description =
		(descEl.length ? extractTextWithBreaks(descEl) : null) ||
		$('meta[property="og:description"]').attr("content") ||
		"";
	// Strip leading section label
	description = description.replace(/^Beschrijving\s*/i, "");

	// Price
	const priceEl = $('[class*="Price"], [class*="price"]').first();
	const priceText =
		priceEl.text().trim() || $('meta[property="product:price:amount"]').attr("content") || "";
	const { display: price, cents: priceCents } = parsePrice(priceText);

	// Location
	const location =
		$('[class*="Location"], [class*="location"]').first().text().trim().replace(/\s+/g, " ") ||
		null;

	// Condition
	const conditionEl = $('[class*="Condition"], [class*="condition"]').first();
	const condition = conditionEl.length ? conditionEl.text().trim() : null;

	// Category from breadcrumbs
	const breadcrumbs = extractBreadcrumbs($);
	const category = breadcrumbs.length > 0 ? (breadcrumbs[breadcrumbs.length - 1] ?? null) : null;

	return {
		id,
		title,
		description,
		price,
		priceCents,
		url: finalUrl,
		images: extractImages($),
		location,
		seller: extractSeller($),
		attributes: extractAttributes($),
		views: extractViews($),
		favorites: extractFavorites($),
		condition,
		datePosted: extractDate($),
		category,
		breadcrumbs,
	};
}
