<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { getWatch, updateWatch, deleteWatch, pollWatch } from '$lib/api/client';
	import type { WatchConfig, WatchState, TrackedListing, UpdateWatchInput } from '$lib/types';
	import { centsToEuros, formatEuros } from '$lib/types';
	import { onMount } from 'svelte';

	const id = $derived($page.params.id ?? '');

	let watch = $state<WatchConfig | null>(null);
	let watchState = $state<WatchState | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let polling = $state(false);
	let saving = $state(false);

	// Edit state
	let editName = $state('');
	let editQuery = $state('');
	let editPriceFrom = $state<number | null>(null);
	let editPriceTo = $state<number | null>(null);
	let editZipCode = $state('');
	let editDistance = $state<number | null>(null);
	let editLimit = $state(50);
	let editInterval = $state(15);
	let editWebhook = $state('');
	let editEnabled = $state(true);

	// Derived listings filtered by price range and sorted by lastSeenAt
	const listings = $derived.by((): TrackedListing[] => {
		if (!watchState || !watch) return [];
		const minCents = watch.searchOptions.priceFromCents ?? null;
		const maxCents = watch.searchOptions.priceToCents ?? null;
		return Object.values(watchState.listings)
			.filter((listing) => {
				const currentPrice = listing.priceHistory.at(-1)?.priceCents ?? null;
				if (currentPrice === null) return true; // Show listings without price
				if (minCents !== null && currentPrice < minCents) return false;
				if (maxCents !== null && currentPrice > maxCents) return false;
				return true;
			})
			.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
	});

	onMount(async () => {
		await loadWatch();
	});

	async function loadWatch() {
		loading = true;
		error = null;
		try {
			const data = await getWatch(id);
			watch = data.watch;
			watchState = data.state;
			syncEditState();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Laden mislukt';
		} finally {
			loading = false;
		}
	}

	function syncEditState() {
		if (!watch) return;
		editName = watch.name;
		editQuery = watch.searchOptions.query;
		editPriceFrom = watch.searchOptions.priceFromCents ? watch.searchOptions.priceFromCents / 100 : null;
		editPriceTo = watch.searchOptions.priceToCents ? watch.searchOptions.priceToCents / 100 : null;
		editZipCode = watch.searchOptions.zipCode ?? '';
		editDistance = watch.searchOptions.distance ?? null;
		editLimit = watch.searchOptions.limit ?? 50;
		editInterval = watch.intervalMinutes;
		editWebhook = watch.webhookUrl ?? '';
		editEnabled = watch.enabled;
	}

	async function handleSave() {
		if (!watch) return;
		saving = true;
		try {
			const input: UpdateWatchInput = {
				name: editName.trim(),
				searchOptions: {
					query: editQuery.trim(),
					priceFromCents: editPriceFrom !== null ? editPriceFrom * 100 : undefined,
					priceToCents: editPriceTo !== null ? editPriceTo * 100 : undefined,
					zipCode: editZipCode.trim() || undefined,
					distance: editDistance ?? undefined,
					limit: editLimit
				},
				intervalMinutes: editInterval,
				webhookUrl: editWebhook.trim() || null,
				enabled: editEnabled
			};
			watch = await updateWatch(id, input);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Opslaan mislukt';
		} finally {
			saving = false;
		}
	}

	async function handlePoll() {
		polling = true;
		try {
			await pollWatch(id);
			await loadWatch();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Pollen mislukt';
		} finally {
			polling = false;
		}
	}

	async function handleDelete() {
		if (!confirm('Weet je zeker dat je deze watch wilt verwijderen?')) return;
		try {
			await deleteWatch(id);
			goto('/watches');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Verwijderen mislukt';
		}
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return 'nooit';
		const date = new Date(dateStr);
		return date.toLocaleDateString('nl-NL', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatPrice(cents: number | null): string {
		if (cents === null) return '-';
		return formatEuros(centsToEuros(cents));
	}

	function getPriceChange(listing: TrackedListing): { change: number; isDropped: boolean } | null {
		if (listing.priceHistory.length < 2) return null;
		const first = listing.priceHistory[0].priceCents;
		const last = listing.priceHistory.at(-1)?.priceCents ?? null;
		if (first === null || last === null) return null;
		return { change: last - first, isDropped: last < first };
	}

	const hasChanges = $derived(
		watch && (
			editName !== watch.name ||
			editQuery !== watch.searchOptions.query ||
			editPriceFrom !== (watch.searchOptions.priceFromCents ? watch.searchOptions.priceFromCents / 100 : null) ||
			editPriceTo !== (watch.searchOptions.priceToCents ? watch.searchOptions.priceToCents / 100 : null) ||
			editZipCode !== (watch.searchOptions.zipCode ?? '') ||
			editDistance !== (watch.searchOptions.distance ?? null) ||
			editLimit !== (watch.searchOptions.limit ?? 50) ||
			editInterval !== watch.intervalMinutes ||
			editWebhook !== (watch.webhookUrl ?? '') ||
			editEnabled !== watch.enabled
		)
	);
</script>

<svelte:head>
	<title>{watch?.name ?? 'Watch'} - Marktplaats</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
	<!-- Back link -->
	<a href="/watches" class="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-6">
		<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
		</svg>
		Terug naar watches
	</a>

	{#if error}
		<div class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
			{error}
			<button onclick={() => error = null} class="ml-2 underline">sluiten</button>
		</div>
	{/if}

	{#if loading}
		<div class="animate-pulse space-y-6">
			<div class="h-8 bg-gray-100 dark:bg-gray-800 w-1/3"></div>
			<div class="h-4 bg-gray-50 dark:bg-gray-800/50 w-1/4"></div>
			<div class="h-40 bg-gray-50 dark:bg-gray-800/50"></div>
		</div>
	{:else if watch}
		<div class="space-y-8">
			<!-- Header -->
			<div class="flex items-start justify-between gap-4">
				<div>
					<h1 class="font-display text-2xl text-gray-900 dark:text-gray-100">{watch.name}</h1>
					<p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
						{watch.searchOptions.query}
						{#if watch.searchOptions.priceFromCents || watch.searchOptions.priceToCents}
							· €{(watch.searchOptions.priceFromCents ?? 0) / 100}–{watch.searchOptions.priceToCents ? watch.searchOptions.priceToCents / 100 : '∞'}
						{/if}
						{#if watch.searchOptions.zipCode}
							· {watch.searchOptions.zipCode}{#if watch.searchOptions.distance} +{watch.searchOptions.distance}km{/if}
						{/if}
					</p>
				</div>
				<div class="flex items-center gap-2">
					<button
						onclick={handlePoll}
						disabled={polling}
						class="h-9 px-4 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 disabled:opacity-50 transition-colors"
					>
						{#if polling}
							<span class="inline-block w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></span>
						{:else}
							Nu controleren
						{/if}
					</button>
					<button
						onclick={handleDelete}
						class="h-9 px-4 text-sm text-red-500 hover:text-red-600 border border-transparent hover:border-red-200 dark:hover:border-red-800 transition-colors"
					>
						Verwijderen
					</button>
				</div>
			</div>

			<!-- Status -->
			<div class="flex items-center gap-6 text-sm">
				<div class="flex items-center gap-2">
					<span class="w-2 h-2 rounded-full {watch.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}"></span>
					<span class="text-gray-500 dark:text-gray-400">{watch.enabled ? 'Actief' : 'Gepauzeerd'}</span>
				</div>
				<div class="text-gray-400 dark:text-gray-500">
					Laatst gecontroleerd: {formatDate(watchState?.lastPolledAt ?? null)}
				</div>
				<div class="text-gray-400 dark:text-gray-500">
					{listings.length} advertenties gevolgd
				</div>
			</div>

			<!-- Settings -->
			<div class="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6">
				<h2 class="font-display text-lg text-gray-900 dark:text-gray-100 mb-5">Instellingen</h2>

				<div class="grid gap-5 max-w-lg">
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<label for="name" class="block text-xs uppercase tracking-wider text-gray-400">Naam</label>
							<input
								id="name"
								type="text"
								bind:value={editName}
								class="form-input"
							/>
						</div>
						<div class="space-y-2">
							<label for="query" class="block text-xs uppercase tracking-wider text-gray-400">Zoekterm</label>
							<input
								id="query"
								type="text"
								bind:value={editQuery}
								class="form-input"
							/>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<label for="priceFrom" class="block text-xs uppercase tracking-wider text-gray-400">Min prijs (€)</label>
							<input
								id="priceFrom"
								type="number"
								bind:value={editPriceFrom}
								min="0"
								placeholder="0"
								class="form-input"
							/>
						</div>
						<div class="space-y-2">
							<label for="priceTo" class="block text-xs uppercase tracking-wider text-gray-400">Max prijs (€)</label>
							<input
								id="priceTo"
								type="number"
								bind:value={editPriceTo}
								min="0"
								placeholder="∞"
								class="form-input"
							/>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<label for="zipCode" class="block text-xs uppercase tracking-wider text-gray-400">Postcode</label>
							<input
								id="zipCode"
								type="text"
								bind:value={editZipCode}
								placeholder="1011AB"
								class="form-input"
							/>
						</div>
						<div class="space-y-2">
							<label for="distance" class="block text-xs uppercase tracking-wider text-gray-400">Afstand (km)</label>
							<input
								id="distance"
								type="number"
								bind:value={editDistance}
								min="0"
								placeholder="∞"
								class="form-input"
							/>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<label for="limit" class="block text-xs uppercase tracking-wider text-gray-400">Max resultaten</label>
							<input
								id="limit"
								type="number"
								bind:value={editLimit}
								min="1"
								max="100"
								class="form-input"
							/>
						</div>
						<div class="space-y-2">
							<label for="interval" class="block text-xs uppercase tracking-wider text-gray-400">Interval (min)</label>
							<input
								id="interval"
								type="number"
								bind:value={editInterval}
								min="5"
								class="form-input"
							/>
						</div>
					</div>

					<div class="space-y-2">
						<label for="webhook" class="block text-xs uppercase tracking-wider text-gray-400">Webhook URL</label>
						<input
							id="webhook"
							type="url"
							bind:value={editWebhook}
							placeholder="https://..."
							class="form-input"
						/>
					</div>

					<label class="flex items-center gap-3 cursor-pointer">
						<input type="checkbox" bind:checked={editEnabled} class="w-4 h-4 accent-[var(--accent)]" />
						<span class="text-sm text-gray-600 dark:text-gray-400">Watch actief</span>
					</label>

					{#if hasChanges}
						<button
							onclick={handleSave}
							disabled={saving}
							class="h-10 px-5 bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors w-fit"
						>
							{#if saving}
								Opslaan...
							{:else}
								Wijzigingen opslaan
							{/if}
						</button>
					{/if}
				</div>
			</div>

			<!-- Tracked Listings -->
			{#if listings.length > 0}
				<div>
					<h2 class="font-display text-lg text-gray-900 dark:text-gray-100 mb-4">Gevolgde advertenties</h2>

					<div class="space-y-2">
						{#each listings as listing, i (listing.sourceListingId)}
							{@const priceChange = getPriceChange(listing)}
							{@const href = listing.url ? `/listing/${listing.sourceListingId}?url=${encodeURIComponent(listing.url)}` : null}
							<svelte:element
								this={href ? 'a' : 'div'}
								href={href}
								class="flex items-center justify-between gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 {href ? 'hover:border-gray-200 dark:hover:border-gray-700 cursor-pointer' : 'opacity-60'} transition-colors"
								style="animation: fadeSlideIn 0.2s ease-out {i * 20}ms both"
							>
								<div class="flex-1 min-w-0">
									<p class="text-sm text-gray-600 dark:text-gray-400 font-mono truncate">
										{listing.sourceListingId}
									</p>
									<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
										Eerst gezien: {formatDate(listing.firstSeenAt)}
									</p>
								</div>

								<div class="text-right">
									<p class="text-sm font-medium text-gray-900 dark:text-gray-100">
										{formatPrice(listing.priceHistory.at(-1)?.priceCents ?? null)}
									</p>
									{#if priceChange}
										<p class="text-xs {priceChange.isDropped ? 'text-green-600' : 'text-red-500'}">
											{priceChange.isDropped ? '↓' : '↑'} {formatPrice(Math.abs(priceChange.change))}
										</p>
									{/if}
								</div>

								{#if href}
									<svg class="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
										<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
									</svg>
								{/if}
							</svelte:element>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.form-input {
		width: 100%;
		height: 2.5rem;
		padding: 0;
		font-size: 0.875rem;
		background: transparent;
		border: 0;
		border-bottom: 1px solid #e5e7eb;
		color: #111827;
		transition: border-color 0.15s;
	}

	:global(.dark) .form-input {
		border-color: #374151;
		color: #f3f4f6;
	}

	.form-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.form-input::placeholder {
		color: #9ca3af;
	}

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
