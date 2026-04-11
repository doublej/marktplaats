<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { searchListings, createWatch, getCategories, getWatches } from '$lib/api/client';
	import type { ListingItem, Category, WatchConfig } from '$lib/types';
	import { cacheListings } from '$lib/stores/listings';
	import ListingCard from '$lib/components/results/ListingCard.svelte';
	import { onMount } from 'svelte';

	// Derive state from URL
	const query = $derived($page.url.searchParams.get('q') ?? '');
	const zipCode = $derived($page.url.searchParams.get('zip') ?? '');
	const distance = $derived(parseNum($page.url.searchParams.get('d')));
	const priceFrom = $derived(parseNum($page.url.searchParams.get('pmin')));
	const priceTo = $derived(parseNum($page.url.searchParams.get('pmax')));
	const sortBy = $derived(parseSortBy($page.url.searchParams.get('sort')));
	const sortOrder = $derived(parseSortOrder($page.url.searchParams.get('order')));
	const limit = $derived(parseNum($page.url.searchParams.get('limit')) ?? 50);
	const pageNum = $derived(parseNum($page.url.searchParams.get('page')) ?? 1);
	const categorySlug = $derived($page.url.searchParams.get('cat') ?? '');

	// Local form state (for typing before submit)
	let queryInput = $state('');
	let zipCodeInput = $state('');
	let distanceInput = $state<number | undefined>(undefined);
	let priceFromInput = $state<number | undefined>(undefined);
	let priceToInput = $state<number | undefined>(undefined);
	let limitInput = $state(50);
	let categorySlugInput = $state('');

	// Results state
	let rawResults = $state<ListingItem[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	// Categories
	let categories = $state<Category[]>([]);

	// Watches
	let watches = $state<WatchConfig[]>([]);

	// Watch panel (inline, not modal)
	let showWatchPanel = $state(false);
	let watchName = $state('');
	let watchInterval = $state(15);
	let creatingWatch = $state(false);
	let watchError = $state<string | null>(null);

	// Client-side price filter
	const results = $derived.by(() => {
		let filtered = [...rawResults];
		if (priceFrom !== undefined) {
			filtered = filtered.filter(r => r.priceCents === null || r.priceCents >= priceFrom * 100);
		}
		if (priceTo !== undefined) {
			filtered = filtered.filter(r => r.priceCents === null || r.priceCents <= priceTo * 100);
		}
		return filtered;
	});

	// Sync inputs from URL on mount and URL changes
	$effect(() => {
		queryInput = query;
		zipCodeInput = zipCode;
		distanceInput = distance;
		priceFromInput = priceFrom;
		priceToInput = priceTo;
		limitInput = limit;
		categorySlugInput = categorySlug;
	});

	// Auto-search when URL has query or category + load categories + load watches
	onMount(async () => {
		getCategories().then((c) => (categories = c)).catch(() => {});
		getWatches().then((w) => (watches = w)).catch(() => {});
		if (query || categorySlug) executeSearch();
	});

	// Re-search when search params change
	let mounted = false;
	let lastSearchKey = '';
	$effect(() => {
		const searchKey = `${query}|${zipCode}|${distance}|${sortBy}|${sortOrder}|${limit}|${pageNum}|${categorySlug}`;
		if (mounted && (query || categorySlug) && searchKey !== lastSearchKey) {
			lastSearchKey = searchKey;
			executeSearch();
		}
		if (!mounted) {
			lastSearchKey = searchKey;
			mounted = true;
		}
	});

	function parseNum(val: string | null): number | undefined {
		if (!val) return undefined;
		const n = parseInt(val, 10);
		return isNaN(n) ? undefined : n;
	}

	function parseSortBy(val: string | null): 'price' | 'date' | undefined {
		if (val === 'price' || val === 'date') return val;
		return undefined;
	}

	function parseSortOrder(val: string | null): 'asc' | 'desc' {
		return val === 'asc' ? 'asc' : 'desc';
	}

	function buildUrl(overrides: Record<string, string | number | undefined | null> = {}): string {
		const params = new URLSearchParams();
		const values = {
			q: queryInput,
			zip: zipCodeInput,
			d: distanceInput,
			pmin: priceFromInput,
			pmax: priceToInput,
			sort: sortBy,
			order: sortOrder,
			limit: limitInput !== 50 ? limitInput : undefined,
			page: pageNum > 1 ? pageNum : undefined,
			cat: categorySlugInput || undefined,
			...overrides
		};

		for (const [key, val] of Object.entries(values)) {
			if (val !== undefined && val !== null && val !== '') {
				params.set(key, String(val));
			}
		}

		return `/?${params.toString()}`;
	}

	async function handleSearch(e?: Event) {
		e?.preventDefault();
		if (!queryInput.trim() && !categorySlugInput) return;
		await goto(buildUrl({ page: undefined }), { keepFocus: true, noScroll: true });
	}

	async function executeSearch() {
		if (!query.trim() && !categorySlug) return;
		loading = true;
		error = null;
		try {
			rawResults = await searchListings({
				query: query.trim() || '',
				zipCode: zipCode || undefined,
				distance: distance || undefined,
				limit,
				sortBy,
				sortOrder,
				page: pageNum,
				categorySlug: categorySlug || undefined
			});
			cacheListings(rawResults);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Zoeken mislukt';
			rawResults = [];
		} finally {
			loading = false;
		}
	}

	function clearFilters() {
		zipCodeInput = '';
		distanceInput = undefined;
		priceFromInput = undefined;
		priceToInput = undefined;
		categorySlugInput = '';
	}

	function setSorting(type: 'price' | 'date' | undefined) {
		let newOrder = sortOrder;
		if (sortBy === type && type !== undefined) {
			newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			newOrder = type === 'price' ? 'asc' : 'desc';
		}
		goto(buildUrl({ sort: type, order: newOrder }), { keepFocus: true, noScroll: true });
	}

	async function handleCreateWatch(e: Event) {
		e.preventDefault();
		if (!watchName.trim() || !query) return;
		creatingWatch = true;
		watchError = null;
		try {
			await createWatch({
				name: watchName.trim(),
				searchOptions: {
					query,
					zipCode: zipCode || undefined,
					distance: distance || undefined,
					priceFromCents: priceFrom ? priceFrom * 100 : undefined,
					priceToCents: priceTo ? priceTo * 100 : undefined
				},
				intervalMinutes: watchInterval
			});
			showWatchPanel = false;
			watchName = '';
			watchInterval = 15;
			goto('/watches');
		} catch (err) {
			watchError = err instanceof Error ? err.message : 'Aanmaken mislukt';
		} finally {
			creatingWatch = false;
		}
	}

	const hasFilters = $derived(zipCodeInput || distanceInput || priceFromInput !== undefined || priceToInput !== undefined || categorySlugInput);
	const searched = $derived(!!query || !!categorySlug);
	const currentCategory = $derived(categories.find(c => c.slug === categorySlug));

	const distances = [
		{ value: undefined, label: 'Heel Nederland' },
		{ value: 5, label: '5 km' },
		{ value: 10, label: '10 km' },
		{ value: 20, label: '20 km' },
		{ value: 50, label: '50 km' },
		{ value: 100, label: '100 km' }
	];
</script>

<svelte:head>
	<title>{query ? `${query} - Marktplaats` : currentCategory ? `${currentCategory.name} - Marktplaats` : 'Marktplaats Zoeken'}</title>
</svelte:head>

<div class="min-h-[calc(100vh-8rem)]">
	<!-- Search + Filters Section with tapering gradient -->
	<div class="gradient-fade">
		<!-- Search Header -->
		<div class="sticky top-14 z-40 bg-transparent">
			<div class="max-w-7xl mx-auto px-4 py-6">
				<form onsubmit={handleSearch} class="flex gap-3 items-center">
					<div class="flex-1 relative">
						<input
							type="text"
							bind:value={queryInput}
							placeholder="Zoeken..."
							class="w-full h-14 px-0 text-2xl bg-transparent border-0 border-b-2 border-gray-300/50 dark:border-gray-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[var(--accent)] transition-colors"
						/>
						{#if queryInput}
							<button
								type="button"
								onclick={() => queryInput = ''}
								aria-label="Wis zoekopdracht"
								class="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
							>
								<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						{/if}
					</div>
					<button
						type="submit"
						disabled={loading || !queryInput.trim()}
						class="h-14 px-8 text-[var(--accent)] font-semibold text-lg tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:text-[var(--accent-dark)] transition-colors"
					>
						{#if loading}
							<div class="w-6 h-6 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin"></div>
						{:else}
							Zoeken
						{/if}
					</button>
				</form>
			</div>
		</div>

		<!-- Filters (always visible when searching) -->
		{#if searched}
			<div class="max-w-7xl mx-auto px-4 pb-8 relative z-10">
				<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-8 gap-y-4">
					<div class="space-y-1">
						<label for="filter-zip" class="label-minimal">Postcode</label>
						<input
							id="filter-zip"
							type="text"
							bind:value={zipCodeInput}
							placeholder="1234AB"
							maxlength="6"
							class="input-minimal"
						/>
					</div>

					<div class="space-y-1">
						<label for="filter-distance" class="label-minimal">Afstand</label>
						<select id="filter-distance" bind:value={distanceInput} class="input-minimal bg-transparent cursor-pointer">
							{#each distances as d}
								<option value={d.value}>{d.label}</option>
							{/each}
						</select>
					</div>

					<div class="space-y-1">
						<label for="filter-price-min" class="label-minimal">Min prijs</label>
						<input
							id="filter-price-min"
							type="number"
							bind:value={priceFromInput}
							placeholder="€ 0"
							min="0"
							class="input-minimal"
						/>
					</div>

					<div class="space-y-1">
						<label for="filter-price-max" class="label-minimal">Max prijs</label>
						<input
							id="filter-price-max"
							type="number"
							bind:value={priceToInput}
							placeholder="€ ∞"
							min="0"
							class="input-minimal"
						/>
					</div>

					{#if categories.length > 0}
						<div class="space-y-1">
							<label for="filter-category" class="label-minimal">Categorie</label>
							<select id="filter-category" bind:value={categorySlugInput} class="input-minimal bg-transparent cursor-pointer">
								<option value="">Alle</option>
								{#each categories as cat}
									<option value={cat.slug}>{cat.name}</option>
								{/each}
							</select>
						</div>
					{/if}

					<div class="space-y-1">
						<label for="filter-limit" class="label-minimal">Resultaten</label>
						<select id="filter-limit" bind:value={limitInput} class="input-minimal bg-transparent cursor-pointer">
							<option value={25}>25</option>
							<option value={50}>50</option>
							<option value={100}>100</option>
						</select>
					</div>
				</div>

				<div class="flex items-center gap-6 mt-6">
					<button onclick={() => handleSearch()} class="btn-primary">
						Toepassen
					</button>
					{#if hasFilters}
						<button onclick={clearFilters} class="btn-ghost">
							Wissen
						</button>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Main Content -->
	<div class="max-w-7xl mx-auto px-4 py-8">
		{#if error}
			<div class="p-4 mb-6 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400">
				{error}
			</div>
		{:else if loading}
			<div class="space-y-3">
				{#each Array(6) as _, i}
					<div class="flex gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 animate-pulse" style="animation-delay: {i * 50}ms">
						<div class="w-36 h-28 bg-gray-100 dark:bg-gray-800 flex-shrink-0"></div>
						<div class="flex-1 py-1 space-y-3">
							<div class="h-5 bg-gray-100 dark:bg-gray-800 w-3/4"></div>
							<div class="h-4 bg-gray-50 dark:bg-gray-800/50 w-full"></div>
							<div class="h-4 bg-gray-50 dark:bg-gray-800/50 w-1/3"></div>
						</div>
						<div class="w-24 h-6 bg-gray-100 dark:bg-gray-800 flex-shrink-0"></div>
					</div>
				{/each}
			</div>
		{:else if results.length > 0}
			<!-- Category Breadcrumb -->
			{#if currentCategory && !query}
				<div class="flex items-center gap-2 mb-6">
					<a href="/" class="text-sm text-gray-400 hover:text-[var(--accent)] transition-colors">
						Alle categorieën
					</a>
					<span class="text-gray-300 dark:text-gray-600">→</span>
					<span class="text-sm font-medium text-gray-700 dark:text-gray-300">{currentCategory.name}</span>
				</div>
			{/if}

			<!-- Results Header -->
			<div class="flex flex-col gap-4 mb-8">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-4">
						<p class="text-gray-500 dark:text-gray-400">
							<span class="section-title text-gray-900 dark:text-gray-100">{results.length}</span> resultaten
						</p>
					</div>
					<button
						onclick={() => { watchName = query; showWatchPanel = !showWatchPanel; }}
						class="flex items-center gap-2 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-dark)] transition-colors"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
						</svg>
						{showWatchPanel ? 'Sluiten' : 'Watch aanmaken'}
					</button>
				</div>

				<!-- Watch Panel (inline, replaces modal) -->
				{#if showWatchPanel}
					<div class="form-panel-fade py-8 px-6 relative">
						<div class="relative z-10">
							<h3 class="section-title text-gray-900 dark:text-gray-100 mb-2">
								Watch aanmaken
							</h3>
							<p class="text-gray-500 dark:text-gray-400 mb-6">
								Ontvang meldingen voor "{query}"
							</p>

							{#if watchError}
								<div class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm border-l-4 border-red-500">
									{watchError}
								</div>
							{/if}

							<form onsubmit={handleCreateWatch} class="space-y-6">
								<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
									<div class="space-y-1">
										<label for="watchName" class="label-minimal">Naam</label>
										<input
											id="watchName"
											type="text"
											bind:value={watchName}
											placeholder="Bijv. iPhone deals"
											class="input-minimal"
											required
										/>
									</div>
									<div class="space-y-1">
										<label for="watchInterval" class="label-minimal">Check elke (minuten)</label>
										<input
											id="watchInterval"
											type="number"
											bind:value={watchInterval}
											min="5"
											class="input-minimal"
										/>
									</div>
								</div>

								<div class="flex items-center gap-4">
									<button
										type="submit"
										disabled={creatingWatch || !watchName.trim()}
										class="btn-primary"
									>
										{#if creatingWatch}
											Aanmaken...
										{:else}
											Aanmaken
										{/if}
									</button>
									<button
										type="button"
										onclick={() => showWatchPanel = false}
										class="btn-ghost"
									>
										Annuleren
									</button>
								</div>
							</form>
						</div>
					</div>
				{/if}

				<!-- Sorting -->
				<div class="flex items-center gap-6 text-sm">
					<button
						onclick={() => setSorting(undefined)}
						class="font-medium transition-colors {sortBy === undefined ? 'text-[var(--accent)]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}"
					>
						relevant
					</button>
					<button
						onclick={() => setSorting('price')}
						class="font-medium transition-colors {sortBy === 'price' ? 'text-[var(--accent)]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}"
					>
						prijs {#if sortBy === 'price'}{sortOrder === 'asc' ? '↑' : '↓'}{/if}
					</button>
					<button
						onclick={() => setSorting('date')}
						class="font-medium transition-colors {sortBy === 'date' ? 'text-[var(--accent)]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}"
					>
						datum {#if sortBy === 'date'}{sortOrder === 'desc' ? '↓' : '↑'}{/if}
					</button>
				</div>
			</div>

			<!-- Results List -->
			<div>
				{#each results as listing, i (listing.sourceListingId)}
					<div style="animation: fadeSlideIn 0.25s ease-out {i * 20}ms both">
						<ListingCard {listing} />
					</div>
				{/each}
			</div>

			<!-- Pagination -->
			<div class="flex justify-center items-center gap-8 mt-12 pt-8 border-t border-gray-100 dark:border-gray-800">
				{#if pageNum > 1}
					<button
						onclick={() => goto(buildUrl({ page: pageNum - 1 }))}
						class="text-base text-gray-500 hover:text-[var(--accent)] transition-colors"
					>
						← Vorige
					</button>
				{/if}
				<span class="font-display text-2xl text-gray-300 dark:text-gray-600">{pageNum}</span>
				{#if results.length >= limit}
					<button
						onclick={() => goto(buildUrl({ page: pageNum + 1 }))}
						class="text-base text-gray-500 hover:text-[var(--accent)] transition-colors"
					>
						Volgende →
					</button>
				{/if}
			</div>
		{:else if searched}
			<div class="py-24 text-center">
				<p class="hero-text text-gray-300 dark:text-gray-700">Geen resultaten</p>
				<p class="text-lg text-gray-400 dark:text-gray-600 mt-4">
					{#if currentCategory}
						Geen items gevonden in {currentCategory.name}
					{:else}
						Probeer andere zoektermen
					{/if}
				</p>
				{#if currentCategory}
					<a href="/" class="inline-block mt-6 text-base text-[var(--accent)] hover:text-[var(--accent-dark)] transition-colors">
						← Terug naar alle categorieën
					</a>
				{/if}
			</div>
		{:else}
			<!-- Homepage -->
			<div class="space-y-16">
				<!-- Hero -->
				<div class="-mx-4 px-4 -mt-8">
					<div class="text-center max-w-3xl mx-auto py-20">
						<h1 class="hero-text text-gray-900 dark:text-gray-100">
							Marktplaats
						</h1>
						<p class="text-xl text-gray-600 dark:text-gray-400 mt-4">
							Vind tweedehands schatten in heel Nederland
						</p>
					</div>
				</div>

				<!-- Active Watches -->
				{#if watches.length > 0}
					<section>
						<div class="flex items-center justify-between mb-6">
							<h2 class="section-title text-gray-900 dark:text-gray-100">
								Mijn Watches
							</h2>
							<a href="/watches" class="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-dark)] transition-colors">
								Beheren →
							</a>
						</div>
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{#each watches.filter(w => w.enabled).slice(0, 6) as watch}
								<a
									href="/?q={encodeURIComponent(watch.searchOptions.query)}"
									class="group flex items-center gap-4 p-5 border-b-2 border-gray-200 dark:border-gray-800 hover:border-[var(--accent)] transition-colors"
								>
									<div class="w-10 h-10 flex items-center justify-center bg-[var(--accent)]/10 text-[var(--accent)] flex-shrink-0">
										<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
											<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
										</svg>
									</div>
									<div class="flex-1 min-w-0">
										<p class="text-base font-medium text-gray-800 dark:text-gray-200 group-hover:text-[var(--accent)] transition-colors truncate">
											{watch.name}
										</p>
										<p class="text-sm text-gray-400 truncate">
											{watch.searchOptions.query}
										</p>
									</div>
									<div class="text-sm text-gray-400">
										{watch.intervalMinutes}m
									</div>
								</a>
							{/each}
						</div>
					</section>
				{/if}

				<!-- Categories -->
				{#if categories.length > 0}
					<section>
						<h2 class="section-title text-gray-900 dark:text-gray-100 mb-6">
							Categorieën
						</h2>
						<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
							{#each categories as cat}
								<a
									href="/?cat={cat.slug}"
									class="group p-5 border-b-2 border-gray-200 dark:border-gray-800 hover:border-[var(--accent)] transition-colors"
								>
									<span class="text-lg font-medium text-gray-700 dark:text-gray-300 group-hover:text-[var(--accent)] transition-colors">
										{cat.name}
									</span>
								</a>
							{/each}
						</div>
					</section>
				{/if}

				<!-- Quick Actions -->
				<section>
					<h2 class="section-title text-gray-900 dark:text-gray-100 mb-6">
						Snel zoeken
					</h2>
					<div class="flex flex-wrap gap-3">
						{#each ['iPhone', 'Fiets', 'Bank', 'Auto', 'Laptop', 'Playstation', 'Nintendo Switch', 'Tafel'] as term}
							<a
								href="/?q={encodeURIComponent(term)}"
								class="px-5 py-2.5 text-base text-gray-600 dark:text-gray-400 border-b-2 border-gray-200 dark:border-gray-800 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
							>
								{term}
							</a>
						{/each}
					</div>
				</section>
			</div>
		{/if}
	</div>
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
