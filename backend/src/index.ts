// Types
export type {
	ListingItem,
	ListingDetail,
	SearchContext,
	SearchOptions,
	ProviderResult,
	ProviderConfig,
	ProviderStatus,
	ProviderType,
	SortBy,
	SortOrder,
} from "./types.js";

export {
	ListingItemSchema,
	ListingStatus,
	MarktplaatsError,
	RateLimitError,
	ScrapingError,
	DEFAULT_PROVIDER_CONFIG,
} from "./types.js";

// Core scraper
export { fetchListings, fetchSellerListings } from "./scraper.js";
export type { SellerListingsOptions } from "./scraper.js";

// Detail scraper
export { fetchListingDetail, buildListingUrl } from "./detail.js";

// Categories
export {
	fetchCategories,
	fetchCategoryTree,
	fetchSubcategories,
	buildCategoryUrl,
} from "./categories.js";
export type { Category, CategoryTree } from "./categories.js";

// Provider system
export { MarktplaatsProvider, createSearchContext } from "./providers/base.js";
export { HtmlScraperProvider } from "./providers/html-scraper.js";
export { ProviderManager } from "./providers/manager.js";

// Utilities
export {
	parsePrice,
	formatEuros,
	eurosToCents,
	centsToEuros,
} from "./utils/price.js";

export {
	cleanText,
	cleanTitle,
	cleanDescription,
	escapeHtml,
	normalizeWhitespace,
	extractLocation,
	parseDutchDate,
	parseRelativeDate,
	DUTCH_MONTHS,
} from "./utils/text.js";

// Convenience function using singleton manager
import { ProviderManager } from "./providers/manager.js";
import type { ListingItem, SearchOptions } from "./types.js";

/**
 * Fetch listings from Marktplaats (convenience wrapper)
 *
 * @example
 * ```ts
 * const listings = await search({
 *   query: "iphone",
 *   zipCode: "1012AB",
 *   distance: 10, // km
 *   priceFromCents: 10000, // €100
 *   priceToCents: 50000,   // €500
 *   limit: 20,
 *   sortBy: "price",
 *   sortOrder: "asc"
 * });
 * // All prices in cents: listing.priceCents, priceFromCents, priceToCents
 * ```
 */
export async function search(options: SearchOptions): Promise<ListingItem[]> {
	const manager = ProviderManager.getInstance();
	return manager.fetchListings(options);
}

/**
 * Get provider status information
 */
export function getProviderStatus() {
	return ProviderManager.getInstance().getStatus();
}

// Server exports
export { StorageManager } from "./server/storage.js";
export { Watcher } from "./server/watcher.js";
export { Scheduler } from "./server/scheduler.js";
export { Notifier } from "./server/notifier.js";
export {
	CreateWatchSchema,
	UpdateWatchSchema,
	WatchConfigSchema,
	WatchStateSchema,
	type WatchConfig,
	type WatchState,
	type TrackedListing,
	type NotificationEvent,
	type ServerConfig,
} from "./server/types.js";
