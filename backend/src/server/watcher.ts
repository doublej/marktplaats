import { search } from "../index.js";
import type { ListingItem } from "../types.js";
import type { StorageManager } from "./storage.js";
import type { NotificationEvent, TrackedListing, WatchConfig } from "./types.js";

function isPriceDrop(oldPrice: number | null, newPrice: number | null): boolean {
	if (oldPrice === null || newPrice === null) return false;
	return newPrice < oldPrice;
}

function createTrackedListing(listing: ListingItem, now: string): TrackedListing {
	return {
		sourceListingId: listing.sourceListingId,
		url: listing.url,
		firstSeenAt: now,
		lastSeenAt: now,
		priceHistory: [{ priceCents: listing.priceCents, seenAt: now }],
	};
}

function createEvent(
	type: "new_listing" | "price_drop",
	watch: WatchConfig,
	listing: ListingItem,
	previousPrice?: number | null,
): NotificationEvent {
	return {
		type,
		watchId: watch.id,
		watchName: watch.name,
		listing: {
			sourceListingId: listing.sourceListingId,
			title: listing.title,
			url: listing.url,
			priceCents: listing.priceCents,
			previousPriceCents: previousPrice ?? undefined,
		},
		timestamp: new Date().toISOString(),
	};
}

export class Watcher {
	constructor(private readonly storage: StorageManager) {}

	async poll(watch: WatchConfig): Promise<NotificationEvent[]> {
		const listings = await search(watch.searchOptions);
		const state = this.storage.getState(watch.id);
		const events: NotificationEvent[] = [];
		const now = new Date().toISOString();

		for (const listing of listings) {
			const existing = state.listings[listing.sourceListingId];

			if (!existing) {
				events.push(createEvent("new_listing", watch, listing));
				state.listings[listing.sourceListingId] = createTrackedListing(listing, now);
				continue;
			}

			const lastPrice = existing.priceHistory.at(-1)?.priceCents ?? null;
			if (isPriceDrop(lastPrice, listing.priceCents)) {
				events.push(createEvent("price_drop", watch, listing, lastPrice));
			}

			existing.lastSeenAt = now;
			existing.url = listing.url;
			if (existing.priceHistory.at(-1)?.priceCents !== listing.priceCents) {
				existing.priceHistory.push({ priceCents: listing.priceCents, seenAt: now });
			}
		}

		state.lastPolledAt = now;
		this.storage.saveState(state);
		return events;
	}
}
