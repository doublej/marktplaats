<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { getCachedListing } from '$lib/stores/listings';
	import { fetchDetail } from '$lib/api/client';
	import type { ListingItem, ListingDetail } from '$lib/types';

	let cached = $state<ListingItem | null>(null);
	let detail = $state<ListingDetail | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let activeImage = $state(0);

	// Get URL from query params or cache
	const listingUrl = $derived($page.url.searchParams.get('url'));
	const listingId = $derived($page.params.id ?? '');

	onMount(async () => {
		// Try to get cached listing for display while loading
		cached = getCachedListing(listingId) ?? null;

		// Determine which URL to use
		const urlToFetch = listingUrl || cached?.url;

		if (!urlToFetch) {
			error = 'Geen listing URL beschikbaar. Ga terug en zoek opnieuw.';
			loading = false;
			return;
		}

		try {
			detail = await fetchDetail(urlToFetch);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Laden mislukt';
		} finally {
			loading = false;
		}
	});

	function formatDate(date: Date | string | null): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
	}

	const title = $derived(detail?.title ?? cached?.title ?? 'Laden...');
	const price = $derived(detail?.price ?? cached?.price ?? '');
	const images = $derived(detail?.images ?? (cached?.imageUrl ? [cached.imageUrl] : []));

	// Build back URL preserving search state
	const backUrl = $derived(() => {
		if (typeof window === 'undefined') return '/';
		const referrer = document.referrer;
		if (referrer && referrer.includes(window.location.origin)) {
			const url = new URL(referrer);
			if (url.pathname === '/' && url.search) {
				return url.pathname + url.search;
			}
		}
		return '/';
	});
</script>

<svelte:head>
	<title>{title} - Marktplaats</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
	<a
		href={backUrl()}
		class="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-6 transition-colors"
	>
		<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
		</svg>
		Terug naar resultaten
	</a>

	{#if error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-300 text-sm">
			{error}
		</div>
	{:else if loading}
		<div class="space-y-6 animate-pulse">
			<div class="bg-gray-100 dark:bg-gray-800 h-[400px]"></div>
			<div class="space-y-3">
				<div class="h-8 bg-gray-100 dark:bg-gray-800 w-3/4"></div>
				<div class="h-10 bg-gray-100 dark:bg-gray-800 w-1/4"></div>
			</div>
		</div>
	{:else}
		<article class="space-y-6">
			<!-- Images -->
			{#if images.length > 0}
				<div class="space-y-3">
					<div class="overflow-hidden">
						<img
							src={images[activeImage]}
							alt={title}
							class="w-full max-h-[500px] object-contain"
						/>
					</div>
					{#if images.length > 1}
						<div class="flex gap-2 overflow-x-auto">
							{#each images as img, i}
								<button
									onclick={() => activeImage = i}
									class="flex-shrink-0 w-14 h-14 opacity-50 hover:opacity-75 transition-opacity {i === activeImage ? 'opacity-100' : ''}"
								>
									<img src={img} alt="" class="w-full h-full object-cover" />
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Header -->
			<header class="space-y-3">
				<h1 class="font-display text-3xl text-gray-900 dark:text-gray-100">{title}</h1>
				<p class="text-3xl font-bold text-[var(--accent-dark)] dark:text-[var(--accent)]">{price}</p>
			</header>

			<!-- Meta -->
			<div class="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-400 dark:text-gray-500 py-6">
				{#if detail?.location ?? cached?.location}
					<span>{detail?.location ?? cached?.location}</span>
				{/if}
				{#if detail?.datePosted ?? cached?.datePosted}
					<span>{formatDate(detail?.datePosted ?? cached?.datePosted ?? null)}</span>
				{/if}
				{#if detail?.views ?? cached?.views}
					<span>{detail?.views ?? cached?.views}× bekeken</span>
				{/if}
				{#if detail?.favorites}
					<span>{detail.favorites}× favoriet</span>
				{/if}
				{#if detail?.condition ?? cached?.condition}
					<span class="uppercase tracking-wider text-xs">{detail?.condition ?? cached?.condition}</span>
				{/if}
			</div>

			<!-- Attributes -->
			{#if detail?.attributes && Object.keys(detail.attributes).length > 0}
				<div class="grid grid-cols-2 gap-x-12 gap-y-1 text-sm py-4 border-t border-gray-100 dark:border-gray-800">
					{#each Object.entries(detail.attributes) as [key, value]}
						<div class="flex justify-between py-2">
							<span class="text-gray-400 dark:text-gray-500">{key}</span>
							<span class="text-gray-700 dark:text-gray-300">{value}</span>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Description -->
			{#if detail?.description}
				<div class="prose prose-gray dark:prose-invert max-w-none">
					<p class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{detail.description}</p>
				</div>
			{:else if cached?.descriptionSnippet}
				<div class="prose prose-gray dark:prose-invert max-w-none">
					<p class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{cached.descriptionSnippet}</p>
				</div>
			{/if}

			<!-- Seller -->
			{#if detail?.seller}
				<div class="py-6 border-t border-gray-100 dark:border-gray-800">
					<p class="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Verkoper</p>
					<div class="space-y-1 text-sm">
						{#if detail.seller.name}
							<p class="text-gray-900 dark:text-gray-100">{detail.seller.name}</p>
						{/if}
						{#if detail.seller.memberSince}
							<p class="text-gray-400 dark:text-gray-500">Lid sinds {detail.seller.memberSince}</p>
						{/if}
						{#if detail.seller.responseTime}
							<p class="text-gray-400 dark:text-gray-500">{detail.seller.responseTime}</p>
						{/if}
					</div>
					{#if detail.seller.id}
						<a
							href="/seller/{detail.seller.id}"
							class="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:text-[var(--accent-dark)] transition-colors"
						>
							Bekijk alle advertenties
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
							</svg>
						</a>
					{/if}
				</div>
			{/if}

			<!-- Actions -->
			<div class="pt-8">
				<a
					href={detail?.url ?? cached?.url ?? listingUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-2 text-[var(--accent)] hover:text-[var(--accent-dark)] font-medium transition-colors"
				>
					Bekijk op Marktplaats →
				</a>
			</div>
		</article>
	{/if}
</div>
