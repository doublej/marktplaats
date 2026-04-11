import { fetchListings } from "../scraper.js";
import type { ProviderConfig, ProviderResult, ProviderType, SearchContext } from "../types.js";
import { DEFAULT_PROVIDER_CONFIG, ScrapingError } from "../types.js";
import { MarktplaatsProvider } from "./base.js";

export class HtmlScraperProvider extends MarktplaatsProvider {
	readonly type: ProviderType = "html_scraper";
	readonly name = "HTML Scraper";

	constructor(config: ProviderConfig = DEFAULT_PROVIDER_CONFIG) {
		super(config);
	}

	async search(context: SearchContext): Promise<ProviderResult> {
		const startTime = Date.now();

		if (!this.isAvailable()) {
			return {
				listings: [],
				providerType: this.type,
				success: false,
				errorMessage: "Provider is unavailable (circuit breaker open)",
				executionTimeMs: 0,
				sourceMetadata: {},
			};
		}

		try {
			await this.enforceRateLimit();

			const listings = await fetchListings({
				query: context.query,
				zipCode: context.zipCode,
				distance: context.distance,
				priceFromCents: context.priceFromCents,
				priceToCents: context.priceToCents,
				limit: context.limit,
				sortBy:
					context.sortBy === "PRICE" ? "price" : context.sortBy === "DATE" ? "date" : undefined,
				sortOrder:
					context.sortOrder === "INCREASING"
						? "asc"
						: context.sortOrder === "DECREASING"
							? "desc"
							: undefined,
				timeout: context.timeoutSeconds * 1000,
				fuel: context.fuel,
				body: context.body,
				categorySlug: context.categorySlug,
			});

			this.markSuccess();

			return {
				listings,
				providerType: this.type,
				success: true,
				executionTimeMs: Date.now() - startTime,
				sourceMetadata: {
					searchId: context.searchId,
					resultCount: listings.length,
				},
			};
		} catch (error) {
			this.markFailure();

			const message = error instanceof Error ? error.message : "Unknown error";
			const isRateLimit = error instanceof ScrapingError && message.includes("Rate limit");

			return {
				listings: [],
				providerType: this.type,
				success: false,
				errorMessage: message,
				executionTimeMs: Date.now() - startTime,
				rateLimitRemaining: isRateLimit ? 0 : undefined,
				sourceMetadata: {
					searchId: context.searchId,
					error: message,
				},
			};
		}
	}
}
