<script lang="ts">
	import '@unocss/reset/tailwind.css';
	import 'virtual:uno.css';
	import '../app.css';
	import { onMount } from 'svelte';
	import { signOut } from '@auth/sveltekit/client';
	import { page } from '$app/stores';

	let { children } = $props();
	let dark = $state(false);
	let mounted = $state(false);
	const session = $derived($page.data.session);

	onMount(() => {
		dark = localStorage.getItem('theme') === 'dark' ||
			(!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
		mounted = true;
		applyTheme();
	});

	function applyTheme() {
		document.documentElement.classList.toggle('dark', dark);
	}

	function toggleTheme() {
		dark = !dark;
		localStorage.setItem('theme', dark ? 'dark' : 'light');
		applyTheme();
	}
</script>

<!-- SVG filter for noise texture -->
<svg class="hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
	<filter id="noise" x="0" y="0" width="100%" height="100%">
		<feTurbulence type="fractalNoise" baseFrequency="0.15" numOctaves="2" stitchTiles="stitch" result="turb" />
		<feColorMatrix type="saturate" values="0" in="turb" result="grey" />
		<feComponentTransfer in="grey" result="thresh">
			<feFuncR type="discrete" tableValues="0 1" />
		</feComponentTransfer>
		<feComposite in="SourceGraphic" in2="thresh" operator="in" />
	</filter>
</svg>

<div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
	<header class="sticky top-0 z-50 border-b border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg">
		<div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
			<a href="/" class="flex items-center gap-3 group">
				<span class="w-8 h-8 bg-[var(--accent)] flex items-center justify-center">
					<span class="text-white font-bold text-base">M</span>
				</span>
				<span class="font-display text-2xl tracking-tight text-gray-800 dark:text-gray-200 group-hover:text-[var(--accent)] transition-colors">marktplaats</span>
			</a>

			<div class="flex items-center gap-1">
				<a
					href="/watches"
					class="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-[var(--accent)] dark:text-gray-400 dark:hover:text-[var(--accent)] transition-colors"
					aria-label="Watches"
					title="Watches"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
					</svg>
				</a>
				{#if mounted}
					<button
						onclick={toggleTheme}
						class="relative w-10 h-10 flex items-center justify-center text-gray-500 hover:text-[var(--accent)] dark:text-gray-400 dark:hover:text-[var(--accent)] transition-colors"
						aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
					>
						<div class="relative w-5 h-5">
							{#if dark}
								<svg class="w-5 h-5 animate-fade-in" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
								</svg>
							{:else}
								<svg class="w-5 h-5 animate-fade-in" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
								</svg>
							{/if}
						</div>
					</button>
				{/if}

				{#if session?.user}
					<div class="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200 dark:border-gray-700">
						{#if session.user.image}
							<img src={session.user.image} alt="" class="w-7 h-7 rounded-full" />
						{/if}
						<button
							onclick={() => signOut()}
							class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
						>
							Uitloggen
						</button>
					</div>
				{:else}
					<a
						href="/login"
						class="ml-2 pl-2 border-l border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:text-[var(--accent)] dark:text-gray-400 dark:hover:text-[var(--accent)] transition-colors"
					>
						Inloggen
					</a>
				{/if}
			</div>
		</div>
	</header>

	<main class="flex-1 relative">
		{@render children()}
	</main>

	<footer class="border-t border-gray-200/40 dark:border-gray-800/40 py-10 mt-auto">
		<div class="max-w-7xl mx-auto px-4 flex items-center justify-between text-sm text-gray-400 dark:text-gray-500">
			<span class="font-mono text-xs tracking-wider uppercase opacity-50">v0.1</span>
			<span class="text-xs">Niet officieel verbonden aan Marktplaats B.V.</span>
		</div>
	</footer>
</div>

<style>
	@keyframes fade-in {
		from { opacity: 0; transform: scale(0.95); }
		to { opacity: 1; transform: scale(1); }
	}

	.animate-fade-in {
		animation: fade-in 0.15s ease-out;
	}
</style>
