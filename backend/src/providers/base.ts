import type {
	ProviderConfig,
	ProviderResult,
	ProviderStatus,
	ProviderType,
	SearchContext,
	SearchOptions,
} from "../types.js";

/**
 * Abstract base class for listing providers
 */
export abstract class MarktplaatsProvider {
	abstract readonly type: ProviderType;
	abstract readonly name: string;

	protected status: ProviderStatus = "healthy";
	protected consecutiveFailures = 0;
	protected lastRequestTime = 0;
	protected requestCount = 0;

	constructor(protected readonly config: ProviderConfig) {}

	abstract search(context: SearchContext): Promise<ProviderResult>;

	getStatus(): ProviderStatus {
		return this.status;
	}

	isHealthy(): boolean {
		return this.status === "healthy";
	}

	isAvailable(): boolean {
		return this.status !== "unavailable";
	}

	protected markSuccess(): void {
		this.consecutiveFailures = 0;
		this.status = "healthy";
	}

	protected markFailure(): void {
		this.consecutiveFailures++;
		if (this.consecutiveFailures >= this.config.circuitBreakerThreshold) {
			this.status = "unavailable";
			// Schedule recovery check
			setTimeout(() => {
				this.status = "degraded";
			}, this.config.circuitBreakerTimeoutSeconds * 1000);
		} else {
			this.status = "degraded";
		}
	}

	protected async enforceRateLimit(): Promise<void> {
		const now = Date.now();
		const minDelay = this.config.retryDelaySeconds * 1000;
		const elapsed = now - this.lastRequestTime;

		if (elapsed < minDelay) {
			await new Promise((resolve) => setTimeout(resolve, minDelay - elapsed));
		}

		this.lastRequestTime = Date.now();
		this.requestCount++;
	}

	getMetrics(): { requestCount: number; consecutiveFailures: number; status: ProviderStatus } {
		return {
			requestCount: this.requestCount,
			consecutiveFailures: this.consecutiveFailures,
			status: this.status,
		};
	}
}

/**
 * Create a SearchContext from SearchOptions
 */
export function createSearchContext(options: SearchOptions): SearchContext {
	return {
		searchId: crypto.randomUUID(),
		query: options.query,
		zipCode: options.zipCode,
		distance: options.distance,
		priceFromCents: options.priceFromCents,
		priceToCents: options.priceToCents,
		limit: options.limit ?? 10,
		sortBy: options.sortBy === "price" ? "PRICE" : options.sortBy === "date" ? "DATE" : undefined,
		sortOrder:
			options.sortOrder === "asc"
				? "INCREASING"
				: options.sortOrder === "desc"
					? "DECREASING"
					: undefined,
		searchTimestamp: new Date(),
		timeoutSeconds: (options.timeout ?? 30000) / 1000,
		fuel: options.fuel,
		body: options.body,
		categorySlug: options.categorySlug,
	};
}
