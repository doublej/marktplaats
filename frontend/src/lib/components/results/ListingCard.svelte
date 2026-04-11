<script lang="ts">
	import type { ListingItem, ListingStatus } from '$lib/types';

	let { listing }: { listing: ListingItem } = $props();

	const statusLabels: Record<Exclude<ListingStatus, 'active'>, string> = {
		sold: 'Verkocht',
		reserved: 'Gereserveerd',
		expired: 'Verlopen'
	};

	function formatDate(date: Date | string | null): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		const now = new Date();
		const diff = now.getTime() - d.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days === 0) return 'Vandaag';
		if (days === 1) return 'Gisteren';
		if (days < 7) return `${days}d`;
		return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
	}

	function truncate(text: string, max: number): string {
		if (text.length <= max) return text;
		return text.slice(0, max).trimEnd() + '…';
	}
</script>

<a
	href="/listing/{listing.sourceListingId}?url={encodeURIComponent(listing.url)}"
	class="listing-card group"
>
	<!-- Image -->
	<div class="listing-image">
		{#if listing.imageUrl}
			<img
				src={listing.imageUrl}
				alt=""
				class="w-full h-full object-cover"
				loading="lazy"
			/>
			<div class="listing-image-overlay"></div>
		{:else}
			<div class="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
				<svg class="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
			</div>
		{/if}
	</div>

	<!-- Content -->
	<div class="listing-content">
		<div class="flex-1 min-w-0">
			<div class="flex items-start justify-between gap-4">
				<h3 class="listing-title">
					{listing.title}
				</h3>
				<div class="flex items-center gap-2 flex-shrink-0">
					{#if listing.status && listing.status !== 'active'}
						<span class="status-badge status-{listing.status}">
							{statusLabels[listing.status]}
						</span>
					{/if}
					<span class="listing-price">
						{listing.price}
					</span>
				</div>
			</div>

			{#if listing.descriptionSnippet}
				<p class="listing-description">
					{truncate(listing.descriptionSnippet, 120)}
				</p>
			{/if}

			<div class="listing-meta">
				{#if listing.location}
					<span>{listing.location}</span>
				{/if}
				{#if listing.datePosted}
					<span class="listing-meta-sep">·</span>
					<span>{formatDate(listing.datePosted)}</span>
				{/if}
				{#if listing.condition}
					<span class="listing-meta-sep">·</span>
					<span class="listing-condition">{listing.condition}</span>
				{/if}
			</div>
		</div>
	</div>
</a>

<style>
	.listing-card {
		display: flex;
		gap: 1.25rem;
		padding: 1.25rem 0;
		border-bottom: 1px solid #e5e7eb;
		transition: all 0.2s ease;
	}

	:global(.dark) .listing-card {
		border-color: #1e293b;
	}

	.listing-card:hover {
		background: linear-gradient(90deg, transparent, rgba(0,0,0,0.015) 50%, transparent);
	}

	:global(.dark) .listing-card:hover {
		background: linear-gradient(90deg, transparent, rgba(255,255,255,0.02) 50%, transparent);
	}

	.listing-image {
		position: relative;
		flex-shrink: 0;
		width: 7rem;
		height: 7rem;
		overflow: hidden;
		background: #f1f5f9;
	}

	:global(.dark) .listing-image {
		background: #1e293b;
	}

	.listing-image img {
		transition: transform 0.4s ease;
	}

	.listing-card:hover .listing-image img {
		transform: scale(1.05);
	}

	.listing-image-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(0,0,0,0.1) 0%, transparent 50%);
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.listing-card:hover .listing-image-overlay {
		opacity: 1;
	}

	.listing-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		padding: 0.125rem 0;
	}

	.listing-title {
		font-family: 'Instrument Serif', Georgia, serif;
		font-size: 1.0625rem;
		font-weight: 400;
		color: #111827;
		line-height: 1.4;
		margin: 0;
		transition: color 0.15s ease;
		flex: 1;
		min-width: 0;
	}

	:global(.dark) .listing-title {
		color: #f3f4f6;
	}

	.listing-card:hover .listing-title {
		color: var(--accent-dark);
	}

	:global(.dark) .listing-card:hover .listing-title {
		color: var(--accent);
	}

	.listing-description {
		margin-top: 0.625rem;
		font-size: 0.8125rem;
		line-height: 1.6;
		color: #9ca3af;
		letter-spacing: 0.01em;
	}

	:global(.dark) .listing-description {
		color: #6b7280;
	}

	.listing-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem;
		margin-top: 0.75rem;
		font-size: 0.75rem;
		color: #9ca3af;
	}

	:global(.dark) .listing-meta {
		color: #6b7280;
	}

	.listing-meta-sep {
		color: #d1d5db;
	}

	:global(.dark) .listing-meta-sep {
		color: #374151;
	}

	.listing-condition {
		text-transform: uppercase;
		letter-spacing: 0.03em;
		font-size: 0.6875rem;
	}

	.listing-price {
		font-size: 1rem;
		font-weight: 600;
		color: var(--accent-dark);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}

	:global(.dark) .listing-price {
		color: var(--accent);
	}

	.status-badge {
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.125rem 0.375rem;
		white-space: nowrap;
	}

	.status-sold {
		background: #ef4444;
		color: white;
	}

	.status-reserved {
		background: #f59e0b;
		color: white;
	}

	.status-expired {
		background: #6b7280;
		color: white;
	}

	@media (max-width: 640px) {
		.listing-card {
			gap: 1rem;
		}

		.listing-image {
			width: 5rem;
			height: 5rem;
		}

		.listing-title {
			font-size: 1rem;
		}

		.listing-description {
			display: none;
		}

		.listing-price {
			font-size: 0.9375rem;
		}
	}
</style>
