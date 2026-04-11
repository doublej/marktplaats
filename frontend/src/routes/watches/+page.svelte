<script lang="ts">
	import { goto } from '$app/navigation';
	import { getWatches, deleteWatch, pollWatch, createWatch } from '$lib/api/client';
	import type { WatchConfig, SearchOptions } from '$lib/types';
	import { onMount } from 'svelte';

	let watches = $state<WatchConfig[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let polling = $state<string | null>(null);
	let deleting = $state<string | null>(null);

	// Create watch panel (inline, not modal)
	let showCreate = $state(false);
	let createName = $state('');
	let createQuery = $state('');
	let createPriceFrom = $state<number | null>(null);
	let createPriceTo = $state<number | null>(null);
	let createZipCode = $state('');
	let createDistance = $state<number | null>(null);
	let createLimit = $state(50);
	let createInterval = $state(15);
	let createWebhook = $state('');
	let creating = $state(false);

	onMount(async () => {
		await loadWatches();
	});

	async function loadWatches() {
		loading = true;
		error = null;
		try {
			watches = await getWatches();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Laden mislukt';
		} finally {
			loading = false;
		}
	}

	async function handleDelete(id: string) {
		if (!confirm('Weet je zeker dat je deze watch wilt verwijderen?')) return;
		deleting = id;
		try {
			await deleteWatch(id);
			watches = watches.filter(w => w.id !== id);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Verwijderen mislukt';
		} finally {
			deleting = null;
		}
	}

	async function handlePoll(id: string) {
		polling = id;
		try {
			const result = await pollWatch(id);
			if (result.eventsCount > 0) {
				await loadWatches();
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Pollen mislukt';
		} finally {
			polling = null;
		}
	}

	async function handleCreate(e: Event) {
		e.preventDefault();
		if (!createName.trim() || !createQuery.trim()) return;

		creating = true;
		try {
			const searchOptions: SearchOptions = {
				query: createQuery.trim(),
				...(createPriceFrom !== null && { priceFromCents: createPriceFrom * 100 }),
				...(createPriceTo !== null && { priceToCents: createPriceTo * 100 }),
				...(createZipCode.trim() && { zipCode: createZipCode.trim() }),
				...(createDistance !== null && { distance: createDistance }),
				...(createLimit !== 50 && { limit: createLimit })
			};
			const watch = await createWatch({
				name: createName.trim(),
				searchOptions,
				intervalMinutes: createInterval,
				webhookUrl: createWebhook.trim() || undefined
			});
			watches = [...watches, watch];
			showCreate = false;
			resetCreateForm();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Aanmaken mislukt';
		} finally {
			creating = false;
		}
	}

	function resetCreateForm() {
		createName = '';
		createQuery = '';
		createPriceFrom = null;
		createPriceTo = null;
		createZipCode = '';
		createDistance = null;
		createLimit = 50;
		createInterval = 15;
		createWebhook = '';
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
</script>

<svelte:head>
	<title>Watches - Marktplaats</title>
</svelte:head>

<!-- Header with tapering gradient -->
<div class="gradient-fade">
	<div class="max-w-4xl mx-auto px-4 py-10 relative z-10">
		<div class="flex items-start justify-between">
			<div>
				<h1 class="hero-text text-gray-900 dark:text-gray-100" style="font-size: clamp(2.5rem, 6vw, 4rem);">
					Watches
				</h1>
				<p class="text-lg text-gray-500 dark:text-gray-400 mt-3">
					Ontvang meldingen bij nieuwe advertenties
				</p>
			</div>
			<button
				onclick={() => showCreate = !showCreate}
				class="btn-primary"
			>
				{showCreate ? 'Sluiten' : 'Nieuwe watch'}
			</button>
		</div>
	</div>
</div>

<div class="max-w-4xl mx-auto px-4 pb-8">
	<!-- Create Watch Panel (inline, replaces modal) -->
	{#if showCreate}
		<div class="form-panel-fade py-10 px-6 mb-8 relative">
			<div class="relative z-10">
				<h2 class="section-title text-gray-900 dark:text-gray-100 mb-6">
					Nieuwe watch
				</h2>

				<form onsubmit={handleCreate} class="space-y-8">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div class="space-y-1">
							<label for="name" class="label-minimal">Naam</label>
							<input
								id="name"
								type="text"
								bind:value={createName}
								placeholder="Bijv. iPhone deals"
								class="input-minimal"
								required
							/>
						</div>
						<div class="space-y-1">
							<label for="query" class="label-minimal">Zoekterm</label>
							<input
								id="query"
								type="text"
								bind:value={createQuery}
								placeholder="Bijv. iphone 15"
								class="input-minimal"
								required
							/>
						</div>
					</div>

					<div class="grid grid-cols-2 md:grid-cols-4 gap-6">
						<div class="space-y-1">
							<label for="priceFrom" class="label-minimal">Min prijs (€)</label>
							<input
								id="priceFrom"
								type="number"
								bind:value={createPriceFrom}
								min="0"
								placeholder="0"
								class="input-minimal"
							/>
						</div>
						<div class="space-y-1">
							<label for="priceTo" class="label-minimal">Max prijs (€)</label>
							<input
								id="priceTo"
								type="number"
								bind:value={createPriceTo}
								min="0"
								placeholder="∞"
								class="input-minimal"
							/>
						</div>
						<div class="space-y-1">
							<label for="zipCode" class="label-minimal">Postcode</label>
							<input
								id="zipCode"
								type="text"
								bind:value={createZipCode}
								placeholder="1011AB"
								class="input-minimal"
							/>
						</div>
						<div class="space-y-1">
							<label for="distance" class="label-minimal">Afstand (km)</label>
							<input
								id="distance"
								type="number"
								bind:value={createDistance}
								min="0"
								placeholder="∞"
								class="input-minimal"
							/>
						</div>
					</div>

					<div class="grid grid-cols-2 md:grid-cols-3 gap-6">
						<div class="space-y-1">
							<label for="limit" class="label-minimal">Max resultaten</label>
							<input
								id="limit"
								type="number"
								bind:value={createLimit}
								min="1"
								max="100"
								class="input-minimal"
							/>
						</div>
						<div class="space-y-1">
							<label for="interval" class="label-minimal">Interval (min)</label>
							<input
								id="interval"
								type="number"
								bind:value={createInterval}
								min="5"
								class="input-minimal"
							/>
						</div>
						<div class="space-y-1 md:col-span-1 col-span-2">
							<label for="webhook" class="label-minimal">Webhook URL (optioneel)</label>
							<input
								id="webhook"
								type="url"
								bind:value={createWebhook}
								placeholder="https://..."
								class="input-minimal"
							/>
						</div>
					</div>

					<div class="flex gap-4 pt-2">
						<button
							type="submit"
							disabled={creating || !createName.trim() || !createQuery.trim()}
							class="btn-primary"
						>
							{#if creating}
								Aanmaken...
							{:else}
								Aanmaken
							{/if}
						</button>
						<button
							type="button"
							onclick={() => { showCreate = false; resetCreateForm(); }}
							class="btn-ghost"
						>
							Annuleren
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	{#if error}
		<div class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400">
			{error}
			<button onclick={() => error = null} class="ml-2 underline">sluiten</button>
		</div>
	{/if}

	{#if loading}
		<div class="space-y-4">
			{#each Array(3) as _, i}
				<div class="p-6 border-b-2 border-gray-200 dark:border-gray-800 animate-pulse" style="animation-delay: {i * 50}ms">
					<div class="flex items-start justify-between">
						<div class="space-y-3 flex-1">
							<div class="h-6 bg-gray-100 dark:bg-gray-800 w-1/3"></div>
							<div class="h-4 bg-gray-50 dark:bg-gray-800/50 w-1/4"></div>
						</div>
						<div class="h-10 w-20 bg-gray-100 dark:bg-gray-800"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if watches.length === 0}
		<div class="py-24 text-center">
			<p class="hero-text text-gray-300 dark:text-gray-700" style="font-size: clamp(2rem, 5vw, 3rem);">
				Geen watches
			</p>
			<p class="text-lg text-gray-400 dark:text-gray-600 mt-4">
				Maak een watch aan om meldingen te ontvangen
			</p>
		</div>
	{:else}
		<div class="space-y-2">
			{#each watches as watch, i (watch.id)}
				<div
					class="group p-6 border-b-2 border-gray-200 dark:border-gray-800 hover:border-[var(--accent)] transition-colors"
					style="animation: fadeSlideIn 0.25s ease-out {i * 30}ms both"
				>
					<div class="flex items-start justify-between gap-6">
						<a href="/watches/{watch.id}" class="flex-1 min-w-0">
							<div class="flex items-center gap-3">
								<h2 class="text-xl font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-[var(--accent)] transition-colors">
									{watch.name}
								</h2>
								{#if !watch.enabled}
									<span class="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
										gepauzeerd
									</span>
								{/if}
							</div>
							<p class="text-base text-gray-500 dark:text-gray-400 mt-1 truncate">
								{watch.searchOptions.query}
								{#if watch.searchOptions.priceFromCents || watch.searchOptions.priceToCents}
									<span class="text-gray-300 dark:text-gray-600 mx-1">·</span>
									€{(watch.searchOptions.priceFromCents ?? 0) / 100}–{watch.searchOptions.priceToCents ? watch.searchOptions.priceToCents / 100 : '∞'}
								{/if}
								{#if watch.searchOptions.zipCode}
									<span class="text-gray-300 dark:text-gray-600 mx-1">·</span>
									{watch.searchOptions.zipCode}{#if watch.searchOptions.distance} +{watch.searchOptions.distance}km{/if}
								{/if}
							</p>
							<p class="text-sm text-gray-400 dark:text-gray-500 mt-2">
								Elke {watch.intervalMinutes} minuten
							</p>
						</a>

						<div class="flex items-center gap-3">
							<button
								onclick={() => handlePoll(watch.id)}
								disabled={polling === watch.id}
								class="h-10 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-[var(--accent)] border-b-2 border-transparent hover:border-[var(--accent)] disabled:opacity-50 transition-all"
								title="Nu controleren"
							>
								{#if polling === watch.id}
									<span class="inline-block w-4 h-4 border-2 border-gray-300 border-t-[var(--accent)] rounded-full animate-spin"></span>
								{:else}
									Poll
								{/if}
							</button>
							<button
								onclick={() => handleDelete(watch.id)}
								disabled={deleting === watch.id}
								class="h-10 px-4 text-sm text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors"
								title="Verwijderen"
							>
								{#if deleting === watch.id}
									<span class="inline-block w-4 h-4 border-2 border-red-200 border-t-red-500 rounded-full animate-spin"></span>
								{:else}
									<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
										<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
									</svg>
								{/if}
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
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
