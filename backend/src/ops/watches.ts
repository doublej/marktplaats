import { z } from "zod";
import type { StorageManager } from "../server/storage.js";
import type { NotificationEvent, WatchConfig, WatchState } from "../server/types.js";
import { Watcher } from "../server/watcher.js";
import { notFound } from "./errors.js";
import { openStorage } from "./storage.js";

/** Owner id used when a caller does not supply one. Shared by CLI and MCP so
 * both surfaces see the same watches and linked accounts. */
export const DEFAULT_USER_ID = "cli";

/** Watches poll a wider result set than an interactive search. */
const WATCH_SEARCH_LIMIT = 50;

export interface WatchWithState extends WatchConfig {
	state: WatchState;
}

export function listWatches(storage: StorageManager = openStorage()): {
	count: number;
	watches: WatchWithState[];
} {
	const watches = storage.getWatches();
	return {
		count: watches.length,
		watches: watches.map((w) => ({ ...w, state: storage.getState(w.id) })),
	};
}

export const watchCreateInputShape = {
	name: z.string().min(1).describe("Human label for the watch"),
	query: z.string().min(1).describe("Search terms to poll"),
	intervalMinutes: z.number().int().min(5).optional().describe("Poll interval, min 5 (default 15)"),
	userId: z.string().optional().describe("Owner id (default 'cli')"),
	zipCode: z.string().optional().describe("Dutch postcode to search around"),
	distance: z.number().int().positive().optional().describe("Radius in km around zipCode"),
	priceFromCents: z.number().int().nonnegative().optional().describe("Min price in CENTS"),
	priceToCents: z.number().int().nonnegative().optional().describe("Max price in CENTS"),
	fuel: z.string().optional().describe("Cars only: Benzine | Diesel | Hybride | Elektrisch | LPG"),
	body: z.string().optional().describe("Cars only: Stationwagon | Hatchback | SUV | MPV | Sedan"),
} as const;

export const WatchCreateInputSchema = z.object(watchCreateInputShape);
export type WatchCreateInput = z.infer<typeof WatchCreateInputSchema>;

export function createWatch(
	input: WatchCreateInput,
	storage: StorageManager = openStorage(),
): WatchConfig {
	const { name, query, intervalMinutes, userId, ...filters } = WatchCreateInputSchema.parse(input);
	const now = new Date().toISOString();

	const watch: WatchConfig = {
		id: crypto.randomUUID(),
		userId: userId ?? DEFAULT_USER_ID,
		name,
		searchOptions: { query, limit: WATCH_SEARCH_LIMIT, ...filters },
		intervalMinutes: intervalMinutes ?? 15,
		enabled: true,
		createdAt: now,
		updatedAt: now,
	};

	storage.addWatch(watch);
	return watch;
}

export const watchIdInputShape = {
	id: z.string().min(1).describe("Watch id (from watches)"),
} as const;

export const WatchIdInputSchema = z.object(watchIdInputShape);
export type WatchIdInput = z.infer<typeof WatchIdInputSchema>;

export interface PollResult {
	watchId: string;
	watchName: string;
	events: NotificationEvent[];
}

export async function pollWatch(
	input: WatchIdInput,
	storage: StorageManager = openStorage(),
): Promise<PollResult> {
	const { id } = WatchIdInputSchema.parse(input);
	const watch = storage.getWatch(id);
	if (!watch) notFound(`Watch not found: ${id}`);
	const events = await new Watcher(storage).poll(watch);
	return { watchId: id, watchName: watch.name, events };
}

export function deleteWatch(
	input: WatchIdInput,
	storage: StorageManager = openStorage(),
): { deleted: true; id: string } {
	const { id } = WatchIdInputSchema.parse(input);
	if (!storage.deleteWatch(id)) notFound(`Watch not found: ${id}`);
	return { deleted: true, id };
}
