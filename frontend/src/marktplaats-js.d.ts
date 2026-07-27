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
		categorySlug?: string;
		zipCode?: string;
		distance?: number;
		priceFromCents?: number;
		priceToCents?: number;
		limit?: number;
		page?: number;
		sortBy?: 'price' | 'date';
		sortOrder?: 'asc' | 'desc';
		timeout?: number;
	}

	export interface Category {
		id: number;
		name: string;
		slug: string;
		parentId: number | null;
		children?: Category[];
	}

	export interface SellerListingsOptions {
		sellerId: string;
		limit?: number;
		page?: number;
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
	export function fetchSellerListings(options: SellerListingsOptions): Promise<ListingItem[]>;
	export function fetchCategories(timeout?: number): Promise<Category[]>;
	export function fetchSubcategories(categorySlug: string, timeout?: number): Promise<Category[]>;
	export function centsToEuros(cents: number | null): number | null;
	export function formatEuros(euros: number | null): string;
}
