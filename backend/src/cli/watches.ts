import { StorageManager } from "../server/storage.js";
import type { WatchConfig } from "../server/types.js";
import { Watcher } from "../server/watcher.js";
import { centsToEuros, formatEuros } from "../utils/price.js";
import { type Ctx, fail, timeAgo } from "./output.js";

const STORAGE_PATH = process.env.WATCH_STORAGE_PATH ?? "./marktplaats-watches.json";

export async function runWatches(ctx: Ctx): Promise<void> {
	const storage = new StorageManager(STORAGE_PATH);
	const watches = storage.getWatches();

	if (ctx.flags.json) {
		ctx.out.json({
			count: watches.length,
			watches: watches.map((w) => ({ ...w, state: storage.getState(w.id) })),
		});
		return;
	}

	ctx.out.heading(`Watches — ${watches.length} configured`, 1);
	if (watches.length === 0) {
		ctx.out.write("No watches configured. Create one with `watch:create`.");
		return;
	}
	ctx.out.table(
		["ID", "Name", "Query", "Interval", "Tracked", "Last Polled", "Status"],
		watches.map((w) => {
			const state = storage.getState(w.id);
			return [
				w.id.slice(0, 8),
				w.name,
				w.searchOptions.query,
				`${w.intervalMinutes}m`,
				String(Object.keys(state.listings).length),
				timeAgo(state.lastPolledAt),
				w.enabled ? "enabled" : "disabled",
			];
		}),
	);
}

export async function runWatchCreate(ctx: Ctx): Promise<void> {
	const name = ctx.flag("name") ?? fail(ctx, "Missing: --name", "MISSING_ARG");
	const query = ctx.flag("query") ?? fail(ctx, "Missing: --query", "MISSING_ARG");
	const now = new Date().toISOString();

	const watch: WatchConfig = {
		id: crypto.randomUUID(),
		userId: ctx.flag("user") ?? "cli",
		name,
		searchOptions: {
			query,
			limit: 50,
			zipCode: ctx.flag("zip"),
			distance: num(ctx.flag("distance")),
			priceFromCents: num(ctx.flag("min-price")),
			priceToCents: num(ctx.flag("max-price")),
			fuel: ctx.flag("fuel"),
			body: ctx.flag("body"),
		},
		intervalMinutes: num(ctx.flag("interval")) ?? 15,
		enabled: true,
		createdAt: now,
		updatedAt: now,
	};

	const storage = new StorageManager(STORAGE_PATH);
	storage.addWatch(watch);

	if (ctx.flags.json) {
		ctx.out.json(watch);
		return;
	}
	ctx.out.write(`Created watch **${watch.name}** (\`${watch.id}\`)`);
}

export async function runWatchPoll(ctx: Ctx): Promise<void> {
	const id = ctx.positionals[1] ?? fail(ctx, "Missing: watch ID", "MISSING_ARG");
	const storage = new StorageManager(STORAGE_PATH);
	const watch = storage.getWatch(id) ?? fail(ctx, `Watch not found: ${id}`, "NOT_FOUND");
	const events = await new Watcher(storage).poll(watch);

	if (ctx.flags.json) {
		ctx.out.json({ watchId: id, events });
		return;
	}

	ctx.out.heading(`Poll: ${watch.name} — ${events.length} events`, 1);
	if (events.length === 0) {
		ctx.out.write("No new events.");
		return;
	}
	ctx.out.table(
		["Type", "Title", "Price", "URL"],
		events.map((e) => [
			e.type === "new_listing" ? "new" : "price drop",
			e.listing.title,
			e.listing.priceCents !== null ? formatEuros(centsToEuros(e.listing.priceCents)) : "—",
			e.listing.url,
		]),
	);
}

export async function runWatchDelete(ctx: Ctx): Promise<void> {
	const id = ctx.positionals[1] ?? fail(ctx, "Missing: watch ID", "MISSING_ARG");
	const storage = new StorageManager(STORAGE_PATH);
	if (!storage.deleteWatch(id)) fail(ctx, `Watch not found: ${id}`, "NOT_FOUND");

	if (ctx.flags.json) {
		ctx.out.json({ deleted: true, id });
		return;
	}
	ctx.out.write(`Deleted watch \`${id}\``);
}

function num(v: string | undefined): number | undefined {
	if (v === undefined) return undefined;
	const n = Number(v);
	return Number.isNaN(n) ? undefined : n;
}
