import { getProviderStatus } from "../index.js";
import { StorageManager } from "../server/storage.js";
import type { Ctx } from "./output.js";
import { timeAgo } from "./output.js";

const STORAGE_PATH = process.env.WATCH_STORAGE_PATH ?? "./marktplaats-watches.json";

const COMMANDS = [
	{
		command: "search",
		usage: "`search <query>`",
		args: "<query> [--limit N] [--zip CODE] [--distance KM] [--min-price CENTS] [--max-price CENTS] [--sort price|date] [--order asc|desc] [--category SLUG] [--page N]",
		description: "Search listings (`--limit`, `--zip`, `--sort`, `--category`, ...)",
	},
	{
		command: "detail",
		usage: "`detail <id>`",
		args: "<listing-id>",
		description: "Get full listing details",
	},
	{
		command: "seller",
		usage: "`seller <id>`",
		args: "<seller-id> [--limit N]",
		description: "List seller's items (`--limit`)",
	},
	{
		command: "categories",
		usage: "`categories`",
		args: "[--slug CATEGORY]",
		description: "Browse category tree (`--slug`)",
	},
	{ command: "watches", usage: "`watches`", args: "", description: "List configured watches" },
	{
		command: "watch:create",
		usage: "`watch:create`",
		args: "--name NAME --query QUERY [--interval MIN] [--user ID] [--zip CODE] [--min-price CENTS] [--max-price CENTS]",
		description: "Create price watch (`--name`, `--query`, `--interval`, ...)",
	},
	{
		command: "watch:poll",
		usage: "`watch:poll <id>`",
		args: "<watch-id>",
		description: "Poll a watch immediately",
	},
	{
		command: "watch:delete",
		usage: "`watch:delete <id>`",
		args: "<watch-id>",
		description: "Delete a watch",
	},
	{ command: "status", usage: "`status`", args: "", description: "Provider health check" },
];

export async function runPrime(ctx: Ctx): Promise<void> {
	const storage = new StorageManager(STORAGE_PATH);
	const watches = storage.getWatches();
	const enabled = watches.filter((w) => w.enabled);
	const provider = getProviderStatus();

	if (ctx.flags.json) {
		ctx.out.json({
			name: "marktplaats-js",
			version: "0.1.0",
			provider,
			storage: { path: STORAGE_PATH },
			watches: {
				total: watches.length,
				enabled: enabled.length,
				disabled: watches.length - enabled.length,
				items: watches.map((w) => {
					const state = storage.getState(w.id);
					return {
						id: w.id,
						name: w.name,
						query: w.searchOptions.query,
						enabled: w.enabled,
						intervalMinutes: w.intervalMinutes,
						lastPolledAt: state.lastPolledAt,
						trackedListings: Object.keys(state.listings).length,
					};
				}),
			},
			commands: COMMANDS.map((c) => ({
				command: c.command,
				args: c.args,
				description: c.description,
			})),
		});
		return;
	}

	const healthy = provider.healthyCount > 0;

	ctx.out.heading("marktplaats v0.1.0", 1);
	ctx.out.heading("Status");
	ctx.out.kv("Provider", healthy ? "healthy" : "degraded");
	ctx.out.kv("Watches", fmtWatchCount(enabled.length, watches.length - enabled.length));
	ctx.out.kv("Storage", `\`${STORAGE_PATH}\``);

	if (watches.length > 0) {
		ctx.out.heading("Watches");
		ctx.out.table(
			["Name", "Query", "Interval", "Tracked", "Last Polled", "Status"],
			watches.map((w) => {
				const state = storage.getState(w.id);
				return [
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

	ctx.out.heading("Commands");
	ctx.out.table(
		["Command", "Description"],
		COMMANDS.map((c) => [c.usage, c.description]),
	);

	ctx.out.write("> Use `--json` for full command specs with all option details.");
}

function fmtWatchCount(enabled: number, disabled: number): string {
	const parts = [`${enabled} enabled`];
	if (disabled > 0) parts.push(`${disabled} disabled`);
	return parts.join(", ");
}
