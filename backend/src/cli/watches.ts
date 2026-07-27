import { createWatch, deleteWatch, listWatches, pollWatch } from "../ops/index.js";
import { centsToEuros, formatEuros } from "../utils/price.js";
import { type Ctx, fail, num, timeAgo } from "./output.js";

export async function runWatches(ctx: Ctx): Promise<void> {
	const result = listWatches();

	if (ctx.flags.json) {
		ctx.out.json(result);
		return;
	}

	ctx.out.heading(`Watches — ${result.count} configured`, 1);
	if (result.count === 0) {
		ctx.out.write("No watches configured. Create one with `watch:create`.");
		return;
	}
	ctx.out.table(
		["ID", "Name", "Query", "Interval", "Tracked", "Last Polled", "Status"],
		result.watches.map((w) => [
			w.id.slice(0, 8),
			w.name,
			w.searchOptions.query,
			`${w.intervalMinutes}m`,
			String(Object.keys(w.state.listings).length),
			timeAgo(w.state.lastPolledAt),
			w.enabled ? "enabled" : "disabled",
		]),
	);
}

export async function runWatchCreate(ctx: Ctx): Promise<void> {
	const name = ctx.flag("name") ?? fail(ctx, "Missing: --name", "MISSING_ARG");
	const query = ctx.flag("query") ?? fail(ctx, "Missing: --query", "MISSING_ARG");

	const watch = createWatch({
		name,
		query,
		userId: ctx.flag("user"),
		intervalMinutes: num(ctx.flag("interval")),
		zipCode: ctx.flag("zip"),
		distance: num(ctx.flag("distance")),
		priceFromCents: num(ctx.flag("min-price")),
		priceToCents: num(ctx.flag("max-price")),
		fuel: ctx.flag("fuel"),
		body: ctx.flag("body"),
	});

	if (ctx.flags.json) {
		ctx.out.json(watch);
		return;
	}
	ctx.out.write(`Created watch **${watch.name}** (\`${watch.id}\`)`);
}

export async function runWatchPoll(ctx: Ctx): Promise<void> {
	const id = ctx.positionals[1] ?? fail(ctx, "Missing: watch ID", "MISSING_ARG");
	const result = await pollWatch({ id });

	if (ctx.flags.json) {
		ctx.out.json(result);
		return;
	}

	ctx.out.heading(`Poll: ${result.watchName} — ${result.events.length} events`, 1);
	if (result.events.length === 0) {
		ctx.out.write("No new events.");
		return;
	}
	ctx.out.table(
		["Type", "Title", "Price", "URL"],
		result.events.map((e) => [
			e.type === "new_listing" ? "new" : "price drop",
			e.listing.title,
			e.listing.priceCents !== null ? formatEuros(centsToEuros(e.listing.priceCents)) : "—",
			e.listing.url,
		]),
	);
}

export async function runWatchDelete(ctx: Ctx): Promise<void> {
	const id = ctx.positionals[1] ?? fail(ctx, "Missing: watch ID", "MISSING_ARG");
	const result = deleteWatch({ id });

	if (ctx.flags.json) {
		ctx.out.json(result);
		return;
	}
	ctx.out.write(`Deleted watch \`${result.id}\``);
}
