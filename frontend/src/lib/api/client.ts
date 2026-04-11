import type {
	ListingItem,
	ListingDetail,
	SearchOptions,
	Category,
	WatchConfig,
	WatchState,
	CreateWatchInput,
	UpdateWatchInput
} from '$lib/types';

export async function searchListings(options: SearchOptions): Promise<ListingItem[]> {
	const response = await fetch('/api/search', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(options)
	});

	if (!response.ok) {
		throw new Error(`Search failed: ${response.statusText}`);
	}

	return response.json();
}

export async function fetchDetail(listingUrl: string): Promise<ListingDetail> {
	const response = await fetch(`/api/listing/_?url=${encodeURIComponent(listingUrl)}`);

	if (response.status === 429) throw new Error('Rate limited');
	if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

	return response.json();
}

// Seller API
export async function getSellerListings(sellerId: string, page = 1): Promise<ListingItem[]> {
	const response = await fetch(`/api/seller/${encodeURIComponent(sellerId)}?page=${page}`);
	if (!response.ok) throw new Error(`Failed to fetch seller listings: ${response.statusText}`);
	return response.json();
}

// Categories API
export async function getCategories(): Promise<Category[]> {
	const response = await fetch('/api/categories');
	if (!response.ok) throw new Error(`Failed to fetch categories: ${response.statusText}`);
	return response.json();
}

// Watch API
export async function getWatches(): Promise<WatchConfig[]> {
	const response = await fetch('/api/watches');
	if (!response.ok) throw new Error(`Failed to fetch watches: ${response.statusText}`);
	return response.json();
}

export async function getWatch(id: string): Promise<{ watch: WatchConfig; state: WatchState }> {
	const response = await fetch(`/api/watches/${id}`);
	if (!response.ok) throw new Error(`Failed to fetch watch: ${response.statusText}`);
	return response.json();
}

export async function createWatch(input: CreateWatchInput): Promise<WatchConfig> {
	const response = await fetch('/api/watches', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	if (!response.ok) throw new Error(`Failed to create watch: ${response.statusText}`);
	return response.json();
}

export async function updateWatch(id: string, input: UpdateWatchInput): Promise<WatchConfig> {
	const response = await fetch(`/api/watches/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	if (!response.ok) throw new Error(`Failed to update watch: ${response.statusText}`);
	return response.json();
}

export async function deleteWatch(id: string): Promise<void> {
	const response = await fetch(`/api/watches/${id}`, { method: 'DELETE' });
	if (!response.ok) throw new Error(`Failed to delete watch: ${response.statusText}`);
}

export async function pollWatch(id: string): Promise<{ polled: boolean; eventsCount: number }> {
	const response = await fetch(`/api/watches/${id}/poll`, { method: 'POST' });
	if (!response.ok) throw new Error(`Failed to poll watch: ${response.statusText}`);
	return response.json();
}
