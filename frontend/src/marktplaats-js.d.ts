declare module 'marktplaats-js' {
	export interface ListingItem {
		sourceListingId: string;
		title: string;
		price: string;
		priceCents: number | null;
		url: string;
		descriptionSnippet: string | null;
		imageUrl: string | null;
		location: string | null;
		seller: string | null;
		views: number | null;
		condition: string | null;
		datePosted: Date | null;
	}

	export interface ListingDetail {
		id: string;
		title: string;
		description: string;
		price: string;
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

	export interface SearchOptions {
		query: string;
		zipCode?: string;
		distance?: number;
		priceFromCents?: number;
		priceToCents?: number;
		limit?: number;
		sortBy?: 'price' | 'date';
		sortOrder?: 'asc' | 'desc';
		timeout?: number;
	}

	export class MarktplaatsError extends Error {
		code?: string;
	}

	export class RateLimitError extends MarktplaatsError {
		retryAfter?: number;
	}

	export class ScrapingError extends MarktplaatsError {}

	export function search(options: SearchOptions): Promise<ListingItem[]>;
	export function fetchListingDetail(urlOrId: string): Promise<ListingDetail>;
	export function centsToEuros(cents: number | null): number | null;
	export function formatEuros(euros: number | null): string;
}
