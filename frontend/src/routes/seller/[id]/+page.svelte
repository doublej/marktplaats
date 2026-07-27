<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getSellerListings } from '$lib/api/client';
	import ListingCard from '$lib/components/results/ListingCard.svelte';
	import { onMount } from 'svelte';
	import type { ListingItem } from '$lib/types';

	const sellerId = $derived($page.params.id ?? '');
	const pageNum = $derived(parseInt($page.url.searchParams.get('page') ?? '1', 10));

	let listings = $state<ListingItem[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function loadListings() {
		loading = true;
		error = null;
		try {
			listings = await getSellerListings(sellerId, pageNum);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Laden mislukt';
		} finally {
			loading = false;
		}
	}

	onMount(loadListings);

	$effect(() => {
		if (sellerId && pageNum) loadListings();
	});
</script>

<svelte:head>
	<title>Verkoper {sellerId} - Marktplaats</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
	<a
		href="/"
		class="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-6 transition-colors"
	>
		<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
		</svg>
		Terug naar zoeken
	</a>

	<h1 class="font-display text-3xl text-gray-900 dark:text-gray-100 mb-8">
		Advertenties van verkoper
	</h1>

	{#if error}
		<div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
			{error}
		</div>
	{:else if loading}
		<div class="space-y-3">
			{#each Array(6) as _, i}
				<div class="flex gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 animate-pulse" style="animation-delay: {i * 50}ms">
					<div class="w-28 h-28 bg-gray-100 dark:bg-gray-800 flex-shrink-0"></div>
					<div class="flex-1 py-1 space-y-3">
						<div class="h-5 bg-gray-100 dark:bg-gray-800 w-3/4"></div>
						<div class="h-4 bg-gray-50 dark:bg-gray-800/50 w-full"></div>
						<div class="h-4 bg-gray-50 dark:bg-gray-800/50 w-1/3"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if listings.length > 0}
		<div>
			{#each listings as listing, i (listing.sourceListingId)}
				<div style="animation: fadeSlideIn 0.25s ease-out {i * 20}ms both">
					<ListingCard {listing} />
				</div>
			{/each}
		</div>

		<!-- Pagination -->
		<div class="flex justify-center items-center gap-6 mt-10 pt-6 border-t border-gray-100 dark:border-gray-800">
			{#if pageNum > 1}
				<button
					onclick={() => goto(`/seller/${sellerId}?page=${pageNum - 1}`)}
					class="text-sm text-gray-500 hover:text-[var(--accent)] transition-colors"
				>
					← Vorige
				</button>
			{/if}
			<span class="text-sm text-gray-400">Pagina {pageNum}</span>
			{#if listings.length >= 30}
				<button
					onclick={() => goto(`/seller/${sellerId}?page=${pageNum + 1}`)}
					class="text-sm text-gray-500 hover:text-[var(--accent)] transition-colors"
				>
					Volgende →
				</button>
			{/if}
		</div>
	{:else}
		<p class="text-gray-400 dark:text-gray-500">Geen advertenties gevonden</p>
	{/if}
</div>

<style>
	@keyframes fadeSlideIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
