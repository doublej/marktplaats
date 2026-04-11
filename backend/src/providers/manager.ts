import type { ListingItem, ProviderConfig, ProviderResult, SearchOptions } from "../types.js";
import { DEFAULT_PROVIDER_CONFIG } from "../types.js";
import { type MarktplaatsProvider, createSearchContext } from "./base.js";
import { HtmlScraperProvider } from "./html-scraper.js";

export interface ProviderMetrics {
	name: string;
	type: string;
	status: string;
	requestCount: number;
	consecutiveFailures: number;
}

/**
 * Manages multiple listing providers with failover
 */
export class ProviderManager {
	private providers: MarktplaatsProvider[] = [];
	private static instance: ProviderManager | null = null;

	constructor(config: ProviderConfig = DEFAULT_PROVIDER_CONFIG) {
		this.providers.push(new HtmlScraperProvider(config));
	}

	static getInstance(config?: ProviderConfig): ProviderManager {
		if (!ProviderManager.instance) {
			ProviderManager.instance = new ProviderManager(config);
		}
		return ProviderManager.instance;
	}

	static resetInstance(): void {
		ProviderManager.instance = null;
	}

	addProvider(provider: MarktplaatsProvider): void {
		this.providers.push(provider);
	}

	async search(options: SearchOptions): Promise<ProviderResult> {
		const context = createSearchContext(options);

		// Try providers in order until one succeeds
		for (const provider of this.providers) {
			if (!provider.isAvailable()) continue;

			const result = await provider.search(context);
			if (result.success) {
				return result;
			}

			// If rate limited, don't try other providers immediately
			if (result.rateLimitRemaining === 0) {
				return result;
			}
		}

		// All providers failed
		return {
			listings: [],
			providerType: "html_scraper",
			success: false,
			errorMessage: "All providers failed or unavailable",
			sourceMetadata: {},
		};
	}

	async fetchListings(options: SearchOptions): Promise<ListingItem[]> {
		const result = await this.search(options);
		return result.listings;
	}

	getStatus(): { providers: ProviderMetrics[]; healthyCount: number } {
		const providers = this.providers.map((p) => {
			const metrics = p.getMetrics();
			return {
				name: p.name,
				type: p.type,
				status: metrics.status,
				requestCount: metrics.requestCount,
				consecutiveFailures: metrics.consecutiveFailures,
			};
		});

		return {
			providers,
			healthyCount: this.providers.filter((p) => p.isHealthy()).length,
		};
	}
}
