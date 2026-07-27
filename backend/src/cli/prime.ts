import { COMMANDS, getOverview } from "../ops/index.js";
import type { Ctx } from "./output.js";
import { timeAgo } from "./output.js";

export async function runPrime(ctx: Ctx): Promise<void> {
	const overview = getOverview();

	if (ctx.flags.json) {
		ctx.out.json(overview);
		return;
	}

	const healthy = overview.provider.healthyCount > 0;

	ctx.out.heading(`marktplaats v${overview.version}`, 1);
	ctx.out.heading("Status");
	ctx.out.kv("Provider", healthy ? "healthy" : "degraded");
	ctx.out.kv("Watches", fmtWatchCount(overview.watches.enabled, overview.watches.disabled));
	ctx.out.kv("Accounts", String(overview.accounts.total));
	ctx.out.kv("Storage", `\`${overview.storage.path}\``);

	if (overview.watches.total > 0) {
		ctx.out.heading("Watches");
		ctx.out.table(
			["Name", "Query", "Interval", "Tracked", "Last Polled", "Status"],
			overview.watches.items.map((w) => [
				w.name,
				w.query,
				`${w.intervalMinutes}m`,
				String(w.trackedListings),
				timeAgo(w.lastPolledAt),
				w.enabled ? "enabled" : "disabled",
			]),
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
