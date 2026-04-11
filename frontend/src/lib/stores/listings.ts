import type { ListingItem } from '$lib/types';

// Simple in-memory store for listing results
// Allows detail page to look up listings without re-fetching
let cache: Map<string, ListingItem> = new Map();

export function cacheListings(listings: ListingItem[]) {
	for (const listing of listings) {
		cache.set(listing.sourceListingId, listing);
	}
}

export function getCachedListing(id: string): ListingItem | undefined {
	return cache.get(id);
}

export function clearCache() {
	cache.clear();
}
