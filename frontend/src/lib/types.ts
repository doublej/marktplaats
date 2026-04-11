// Types matching marktplaats-js

export type ListingStatus = 'active' | 'sold' | 'reserved' | 'expired';

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
	status: ListingStatus | null;
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
	/** Price in cents */
	priceFromCents?: number;
	/** Price in cents */
	priceToCents?: number;
	limit?: number;
	sortBy?: 'price' | 'date';
	sortOrder?: 'asc' | 'desc';
	timeout?: number;
	page?: number;
	categorySlug?: string;
}

export interface Category {
	id: number;
	name: string;
	slug: string;
	parentId: number | null;
}

// Watch types
export interface WatchConfig {
	id: string;
	name: string;
	searchOptions: SearchOptions;
	webhookUrl?: string;
	intervalMinutes: number;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface PricePoint {
	priceCents: number | null;
	seenAt: string;
}

export interface TrackedListing {
	sourceListingId: string;
	url?: string;
	firstSeenAt: string;
	lastSeenAt: string;
	priceHistory: PricePoint[];
}

export interface WatchState {
	watchId: string;
	lastPolledAt: string | null;
	listings: Record<string, TrackedListing>;
}

export interface CreateWatchInput {
	name: string;
	searchOptions: SearchOptions;
	webhookUrl?: string;
	intervalMinutes?: number;
}

export interface UpdateWatchInput {
	name?: string;
	searchOptions?: Partial<SearchOptions>;
	webhookUrl?: string | null;
	intervalMinutes?: number;
	enabled?: boolean;
}

// Price utilities
export function centsToEuros(cents: number | null): number | null {
	return cents === null ? null : cents / 100;
}

export function formatEuros(euros: number | null): string {
	if (euros === null) return '';
	return `€ ${euros.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
