<script lang="ts">
	const INSTALL = 'bun install github:doublej/marktplaats#main';

	const features = [
		{
			title: 'Search + Detail + Categories',
			description:
				'One library, three entry points. Fetch listings with filters, pull full detail pages, walk the category tree — all Zod-validated.'
		},
		{
			title: 'Provider pattern with failover',
			description:
				'ProviderManager tries providers in order. Built-in circuit breaker + rate limiter. Drop-in alternative backends when marktplaats ships an API.'
		},
		{
			title: 'Cents all the way down',
			description:
				'No float drift. Prices are integer cents in, integer cents out. Dutch locale parsing handled, euro formatting helpers included.'
		},
		{
			title: 'Watch server + notifier',
			description:
				'Ship a saved-search daemon without writing one. /server subpath exports Watcher, Scheduler, StorageManager, and an HTTP API.'
		},
		{
			title: 'Typed errors',
			description:
				'RateLimitError (with retryAfter), ScrapingError, MarktplaatsError. Catch what you need; let the rest surface.'
		},
		{
			title: 'Bun-native',
			description:
				'Runs on Bun ≥1.0, tests with bun test, formats with Biome. TypeScript strict, no transpile step in dev.'
		}
	];

	const steps = [
		{
			title: 'Install',
			description: 'Add to your Bun project directly from GitHub.',
			code: INSTALL
		},
		{
			title: 'Run a search',
			description: 'Filter by category, distance, price range, and sort order.',
			code: `import { search } from "marktplaats-js";

const listings = await search({
  query: "macbook pro",
  categorySlug: "computers-en-software",
  priceFromCents: 50000,
  priceToCents: 150000,
  sortBy: "price",
  sortOrder: "asc",
  limit: 20
});`
		},
		{
			title: 'Fetch detail + categories',
			description: 'Pull the full listing page or walk the category tree.',
			code: `import { fetchListingDetail, fetchCategories } from "marktplaats-js";

const detail = await fetchListingDetail(listings[0].url);
const cats = await fetchCategories();`
		},
		{
			title: 'Run the watch server',
			description: 'The /server subpath exposes the watch daemon + HTTP API.',
			code: `bun run server       # one-shot
bun run server:dev   # watch mode`
		}
	];

	let copied = $state(false);

	function copyInstall() {
		navigator.clipboard.writeText(INSTALL);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<main>
	<section class="hero">
		<div class="container">
			<div class="eyebrow">marktplaats-js</div>
			<h1>A TypeScript scraper for marktplaats.nl</h1>
			<p class="description">
				Library, watch server, and CLI for the Dutch classifieds. Built on Bun, validated with Zod,
				shipped with a provider layer that fails over before you notice.
			</p>
		</div>
	</section>

	<section class="install">
		<div class="container">
			<div class="install-box">
				<code>{INSTALL}</code>
				<button type="button" onclick={copyInstall} aria-label="Copy install command">
					{copied ? 'Copied' : 'Copy'}
				</button>
			</div>
		</div>
	</section>

	<section class="features">
		<div class="container">
			<h2>Features</h2>
			<div class="grid">
				{#each features as feature, i}
					<div class="feature-card" style="animation-delay: {400 + i * 100}ms">
						<h3>{feature.title}</h3>
						<p>{feature.description}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section class="getting-started">
		<div class="container">
			<h2>Getting Started</h2>
			<div class="steps">
				{#each steps as step, i}
					<div class="step" style="animation-delay: {600 + i * 150}ms">
						<div class="step-number">{i + 1}</div>
						<div class="step-content">
							<h3>{step.title}</h3>
							<p>{step.description}</p>
							{#if step.code}
								<pre><code>{step.code}</code></pre>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section class="architecture">
		<div class="container">
			<h2>Architecture</h2>
			<div class="arch-grid">
				<div class="arch-card">
					<h3>Data flow</h3>
					<pre><code>search(opts)
  ↓
ProviderManager
  ↓
HtmlScraperProvider
  ↓
scraper.ts (cheerio)
  ↓
ListingItem[] (Zod)</code></pre>
				</div>
				<div class="arch-card">
					<h3>Rate limits</h3>
					<p>
						Marktplaats allows ~30 req/min with bursts of 5. The circuit breaker opens after 5
						consecutive failures — cache aggressively and debounce on top.
					</p>
				</div>
				<div class="arch-card">
					<h3>Price model</h3>
					<p>
						<code>"€ 500"</code> → <code>50000</code>. <code>"€ 0"</code> → <code>0</code>.
						<code>"Bieden"</code> → <code>null</code>. Use <code>centsToEuros</code> /
						<code>formatEuros</code> for display.
					</p>
				</div>
			</div>
		</div>
	</section>

	<footer>
		<div class="container">
			<p>
				<a href="https://github.com/doublej/marktplaats" target="_blank" rel="noreferrer"
					>GitHub</a
				>
				· <a href="https://marktplaats.jurrejan.com" target="_blank" rel="noreferrer">Live UI</a> ·
				MIT
			</p>
		</div>
	</footer>
</main>

<style>
	section {
		padding: var(--section-padding) 0;
	}

	.hero {
		text-align: center;
		padding-top: 100px;
		animation: fadeSlideUp 0.5s ease-out forwards;
	}

	.eyebrow {
		font-family: 'DM Mono', monospace;
		font-size: 0.85rem;
		color: var(--text-tertiary);
		letter-spacing: 0.02em;
		margin-bottom: 1.5rem;
		text-transform: uppercase;
	}

	.hero h1 {
		font-size: 3rem;
		font-weight: 600;
		letter-spacing: -0.03em;
		margin-bottom: 1.25rem;
		line-height: 1.1;
		max-width: 800px;
		margin-left: auto;
		margin-right: auto;
	}

	.hero .description {
		font-size: 1.2rem;
		color: var(--text-secondary);
		max-width: 680px;
		margin: 0 auto;
	}

	.install {
		padding-top: 20px;
		padding-bottom: 40px;
		animation: fadeSlideUp 0.5s ease-out 200ms both;
	}

	.install-box {
		max-width: 680px;
		margin: 0 auto;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 18px 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.install-box code {
		font-size: 0.95rem;
		color: var(--text-primary);
		white-space: nowrap;
		overflow-x: auto;
	}

	.install-box button {
		font-family: 'Instrument Sans', sans-serif;
		font-size: 0.9rem;
		font-weight: 500;
		padding: 8px 16px;
		min-height: 44px;
		background: var(--accent);
		color: #fff;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		flex-shrink: 0;
		transition: opacity 150ms ease-out;
	}

	.install-box button:hover {
		opacity: 0.85;
	}

	h2 {
		font-size: 2rem;
		font-weight: 600;
		margin-bottom: 40px;
		letter-spacing: -0.025em;
	}

	.features {
		animation: fadeSlideUp 0.5s ease-out 400ms both;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--grid-gap);
	}

	.feature-card {
		background: var(--bg-secondary);
		padding: 28px;
		border: 1px solid var(--border);
		border-radius: 8px;
		animation: fadeSlideUp 0.5s ease-out forwards;
		opacity: 0;
	}

	.feature-card h3 {
		font-size: 1.15rem;
		font-weight: 600;
		margin-bottom: 10px;
	}

	.feature-card p {
		color: var(--text-secondary);
		font-size: 1rem;
		line-height: 1.55;
	}

	.getting-started {
		animation: fadeSlideUp 0.5s ease-out 600ms both;
	}

	.steps {
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	.step {
		display: flex;
		gap: 24px;
		opacity: 0;
		animation: fadeSlideUp 0.5s ease-out forwards;
	}

	.step-number {
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--accent);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 1.1rem;
	}

	.step-content {
		flex: 1;
		min-width: 0;
	}

	.step-content h3 {
		font-size: 1.2rem;
		font-weight: 600;
		margin-bottom: 6px;
	}

	.step-content p {
		color: var(--text-secondary);
		margin-bottom: 14px;
	}

	.step-content pre {
		background: var(--bg-code);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 16px 18px;
		overflow-x: auto;
		font-size: 0.9rem;
		line-height: 1.55;
	}

	.architecture {
		animation: fadeSlideUp 0.5s ease-out 800ms both;
	}

	.arch-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--grid-gap);
	}

	.arch-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 28px;
	}

	.arch-card h3 {
		font-size: 1.1rem;
		font-weight: 600;
		margin-bottom: 12px;
	}

	.arch-card p {
		color: var(--text-secondary);
		font-size: 0.98rem;
	}

	.arch-card code {
		background: var(--bg-code);
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 0.88rem;
	}

	.arch-card pre {
		background: var(--bg-code);
		border-radius: 6px;
		padding: 14px 16px;
		font-size: 0.85rem;
		line-height: 1.7;
		overflow-x: auto;
	}

	.arch-card pre code {
		background: transparent;
		padding: 0;
	}

	footer {
		padding: 40px 0 60px;
		border-top: 1px solid var(--border);
		margin-top: 20px;
		animation: fadeSlideUp 0.5s ease-out 1000ms both;
	}

	footer p {
		color: var(--text-tertiary);
		font-size: 0.95rem;
		text-align: center;
	}

	@media (max-width: 1000px) {
		.grid,
		.arch-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 700px) {
		:root {
			--section-padding: 50px;
		}
		.hero h1 {
			font-size: 2.1rem;
		}
		.hero .description {
			font-size: 1.05rem;
		}
		.grid,
		.arch-grid {
			grid-template-columns: 1fr;
		}
		.install-box {
			flex-direction: column;
			align-items: stretch;
		}
		.install-box code {
			font-size: 0.85rem;
		}
		.install-box button {
			width: 100%;
		}
	}
</style>
