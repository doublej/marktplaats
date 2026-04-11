import { z } from "zod";

export const SearchOptionsSchema = z.object({
	query: z.string().min(1),
	categorySlug: z.string().optional(),
	zipCode: z.string().optional(),
	distance: z.number().optional(),
	/** Minimum price filter in cents */
	priceFromCents: z.number().optional(),
	/** Maximum price filter in cents */
	priceToCents: z.number().optional(),
	limit: z.number().default(50),
	page: z.number().optional(),
	sortBy: z.enum(["price", "date"]).optional(),
	sortOrder: z.enum(["asc", "desc"]).optional(),
	/** Fuel type: Benzine | Diesel | Hybride | Elektrisch | LPG */
	fuel: z.string().optional(),
	/** Body type: Stationwagon | Hatchback | SUV | MPV | Sedan | Cabriolet */
	body: z.string().optional(),
});

export const WatchConfigSchema = z.object({
	id: z.string().uuid(),
	userId: z.string(),
	name: z.string().min(1),
	searchOptions: SearchOptionsSchema,
	webhookUrl: z.string().url().optional(),
	intervalMinutes: z.number().min(5).default(15),
	enabled: z.boolean().default(true),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
});

export type WatchConfig = z.infer<typeof WatchConfigSchema>;

export const PricePointSchema = z.object({
	/** Price in cents */
	priceCents: z.number().nullable(),
	seenAt: z.string().datetime(),
});

export const TrackedListingSchema = z.object({
	sourceListingId: z.string(),
	url: z.string().url().optional(),
	firstSeenAt: z.string().datetime(),
	lastSeenAt: z.string().datetime(),
	priceHistory: z.array(PricePointSchema),
});

export type TrackedListing = z.infer<typeof TrackedListingSchema>;

export const WatchStateSchema = z.object({
	watchId: z.string().uuid(),
	lastPolledAt: z.string().datetime().nullable(),
	listings: z.record(z.string(), TrackedListingSchema),
});

export type WatchState = z.infer<typeof WatchStateSchema>;

export const StorageSchema = z.object({
	version: z.literal(1),
	watches: z.array(WatchConfigSchema),
	states: z.record(z.string(), WatchStateSchema),
});

export type Storage = z.infer<typeof StorageSchema>;

export const NotificationEventSchema = z.object({
	type: z.enum(["new_listing", "price_drop"]),
	watchId: z.string().uuid(),
	watchName: z.string(),
	listing: z.object({
		sourceListingId: z.string(),
		title: z.string(),
		url: z.string().url(),
		/** Price in cents */
		priceCents: z.number().nullable(),
		/** Previous price in cents */
		previousPriceCents: z.number().nullable().optional(),
	}),
	timestamp: z.string().datetime(),
});

export type NotificationEvent = z.infer<typeof NotificationEventSchema>;

export interface ServerConfig {
	storagePath: string;
	port: number;
	host: string;
}

export const CreateWatchSchema = z.object({
	userId: z.string(),
	name: z.string().min(1),
	searchOptions: SearchOptionsSchema,
	webhookUrl: z.string().url().optional(),
	intervalMinutes: z.number().min(5).default(15),
});

export const UpdateWatchSchema = z.object({
	name: z.string().min(1).optional(),
	searchOptions: SearchOptionsSchema.partial().optional(),
	webhookUrl: z.string().url().nullable().optional(),
	intervalMinutes: z.number().min(5).optional(),
	enabled: z.boolean().optional(),
});
