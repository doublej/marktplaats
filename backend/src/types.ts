import { z } from "zod";

// Provider types
export const ProviderType = {
	HTML_SCRAPER: "html_scraper",
	MARKTPLAATS_LIBRARY: "marktplaats_library",
} as const;
export type ProviderType = (typeof ProviderType)[keyof typeof ProviderType];

export const ProviderStatus = {
	HEALTHY: "healthy",
	DEGRADED: "degraded",
	UNAVAILABLE: "unavailable",
} as const;
export type ProviderStatus = (typeof ProviderStatus)[keyof typeof ProviderStatus];

// Sort options
export const SortBy = {
	PRICE: "PRICE",
	DATE: "DATE",
	OPTIMIZED: "OPTIMIZED",
} as const;
export type SortBy = (typeof SortBy)[keyof typeof SortBy];

export const SortOrder = {
	INCREASING: "INCREASING",
	DECREASING: "DECREASING",
} as const;
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

// Listing availability status
export const ListingStatus = {
	ACTIVE: "active",
	SOLD: "sold",
	RESERVED: "reserved",
	EXPIRED: "expired",
} as const;
export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];

// Listing item schema
export const ListingItemSchema = z.object({
	sourceListingId: z.string(),
	title: z.string(),
	/** Display price string (e.g., "€ 1.234") */
	price: z.string(),
	/** Price in cents, null if not parseable (e.g., "vraagprijs") */
	priceCents: z.number().nullable(),
	url: z.string().url(),
	descriptionSnippet: z.string().nullable(),
	imageUrl: z.string().url().nullable(),
	location: z.string().nullable(),
	seller: z.string().nullable(),
	views: z.number().nullable(),
	condition: z.string().nullable(),
	datePosted: z.date().nullable(),
	rawHtml: z.string().nullable(),
	status: z.enum(["active", "sold", "reserved", "expired"]).nullable(),
});

export type ListingItem = z.infer<typeof ListingItemSchema>;

// Listing detail (full page scrape)
export interface ListingDetail {
	id: string;
	title: string;
	description: string;
	/** Display price string (e.g., "€ 1.234") */
	price: string;
	/** Price in cents, null if not parseable */
	priceCents: number | null;
	url: string;
	images: string[];
	location: string | null;
	seller: {
		name: string | null;
		id: string | null;
		memberSince: string | null;
		responseTime: string | null;
	};
	attributes: Record<string, string>;
	views: number | null;
	favorites: number | null;
	condition: string | null;
	datePosted: Date | null;
	category: string | null;
	breadcrumbs: string[];
}

// Search context
export interface SearchContext {
	searchId: string;
	query: string;
	zipCode?: string;
	distance?: number;
	/** Minimum price filter in cents */
	priceFromCents?: number;
	/** Maximum price filter in cents */
	priceToCents?: number;
	limit: number;
	sortBy?: SortBy;
	sortOrder?: SortOrder;
	searchTimestamp: Date;
	userAgent?: string;
	timeoutSeconds: number;
	/** Fuel type filter: Benzine | Diesel | Hybride | Elektrisch | LPG */
	fuel?: string;
	/** Body type filter: Stationwagon | Hatchback | SUV | MPV | Sedan | Cabriolet */
	body?: string;
	categorySlug?: string;
}

// Provider result
export interface ProviderResult {
	listings: ListingItem[];
	providerType: ProviderType;
	success: boolean;
	errorMessage?: string;
	executionTimeMs?: number;
	rateLimitRemaining?: number;
	rateLimitReset?: Date;
	sourceMetadata: Record<string, unknown>;
}

// Search options
export interface SearchOptions {
	query: string;
	categorySlug?: string;
	zipCode?: string;
	distance?: number;
	/** Minimum price filter in cents */
	priceFromCents?: number;
	/** Maximum price filter in cents */
	priceToCents?: number;
	limit?: number;
	page?: number;
	sortBy?: "price" | "date";
	sortOrder?: "asc" | "desc";
	timeout?: number;
	/** Fuel type filter: Benzine | Diesel | Hybride | Elektrisch | LPG */
	fuel?: string;
	/** Body type filter: Stationwagon | Hatchback | Sedan | SUV | etc */
	body?: string;
}

// Provider config
export interface ProviderConfig {
	rateLimitRequestsPerMinute: number;
	rateLimitBurstSize: number;
	retryDelaySeconds: number;
	circuitBreakerThreshold: number;
	circuitBreakerTimeoutSeconds: number;
}

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
	rateLimitRequestsPerMinute: 30,
	rateLimitBurstSize: 5,
	retryDelaySeconds: 1.0,
	circuitBreakerThreshold: 5,
	circuitBreakerTimeoutSeconds: 60,
};

// Error types
export class MarktplaatsError extends Error {
	constructor(
		message: string,
		public readonly code?: string,
	) {
		super(message);
		this.name = "MarktplaatsError";
	}
}

export class RateLimitError extends MarktplaatsError {
	constructor(
		message = "Rate limit exceeded",
		public readonly retryAfter?: number,
	) {
		super(message, "RATE_LIMIT");
		this.name = "RateLimitError";
	}
}

export class ScrapingError extends MarktplaatsError {
	constructor(message: string) {
		super(message, "SCRAPING_ERROR");
		this.name = "ScrapingError";
	}
}
