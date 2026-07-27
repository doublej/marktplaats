#!/usr/bin/env bun
import { OpsError, VERSION } from "../ops/index.js";
import { runCategories, runDetail, runSearch, runSeller, runStatus } from "./commands.js";
import { runMpAccounts, runMpCreateAd, runMpLink, runMpUpdateAccount } from "./mp.js";
import { type Ctx, createOutput, jsonError, parseFlags } from "./output.js";
import { runPrime } from "./prime.js";
import { runWatchCreate, runWatchDelete, runWatchPoll, runWatches } from "./watches.js";

const argv = process.argv.slice(2);
const flags = parseFlags(argv);
const out = createOutput(flags);

const BOOL_FLAGS = new Set(["json", "quiet", "no-color", "no-progress", "help", "version"]);

function parsePositionals(): string[] {
	const result: string[] = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (!arg) continue;
		if (arg.startsWith("--")) {
			if (!BOOL_FLAGS.has(arg.slice(2))) {
				const next = argv[i + 1];
				if (next && !next.startsWith("--")) i++;
			}
			continue;
		}
		result.push(arg);
	}
	return result;
}

function flag(name: string): string | undefined {
	const idx = argv.indexOf(`--${name}`);
	if (idx === -1 || idx + 1 >= argv.length) return undefined;
	const val = argv[idx + 1];
	return val?.startsWith("--") ? undefined : val;
}

const positionals = parsePositionals();
const command = positionals[0] ?? "prime";
const ctx: Ctx = { positionals, flag, flags, out };

const commands: Record<string, (ctx: Ctx) => Promise<void>> = {
	prime: runPrime,
	search: runSearch,
	detail: runDetail,
	seller: runSeller,
	categories: runCategories,
	watches: runWatches,
	"watch:create": runWatchCreate,
	"watch:poll": runWatchPoll,
	"watch:delete": runWatchDelete,
	"mp:link": runMpLink,
	"mp:accounts": runMpAccounts,
	"mp:update-account": runMpUpdateAccount,
	"mp:create-ad": runMpCreateAd,
	status: runStatus,
	help: showHelp,
};

if (argv.includes("--help")) {
	await showHelp(ctx);
	process.exit(0);
}
if (argv.includes("--version")) {
	process.stdout.write(`${VERSION}\n`);
	process.exit(0);
}

const handler = commands[command];
if (!handler) {
	if (flags.json) jsonError(`Unknown command: ${command}`, "UNKNOWN_COMMAND");
	out.error(`Unknown command: ${command}`);
	await showHelp(ctx);
	process.exit(2);
}

try {
	await handler(ctx);
} catch (err) {
	const msg = err instanceof Error ? err.message : String(err);
	const code = err instanceof OpsError ? err.code : undefined;
	if (flags.json) jsonError(msg, code ?? "EXECUTION_ERROR");
	out.error(msg);
	process.exit(1);
}

async function showHelp(ctx: Ctx): Promise<void> {
	if (ctx.flags.json) {
		ctx.out.json({
			usage: "marktplaats <command> [options]",
			commands: Object.keys(commands).filter((c) => c !== "help"),
			flags: ["--json", "--quiet", "--no-color", "--no-progress"],
		});
		return;
	}
	ctx.out.heading("marktplaats", 1);
	ctx.out.write("Agent-facing CLI for Marktplaats.nl scraper.");
	ctx.out.write("");
	ctx.out.write("**Usage:** `marktplaats <command> [options]`");
	ctx.out.heading("Commands");
	ctx.out.table(
		["Command", "Description"],
		[
			["`prime`", "Full project overview (default)"],
			["`search <query>`", "Search listings"],
			["`detail <id>`", "Get listing detail"],
			["`seller <id>`", "Seller listings"],
			["`categories`", "Category tree"],
			["`watches`", "List watches"],
			["`watch:create`", "Create watch"],
			["`watch:poll <id>`", "Poll watch now"],
			["`watch:delete <id>`", "Remove watch"],
			["`mp:link`", "Link a marktplaats account (headed browser)"],
			["`mp:accounts`", "List linked mp accounts"],
			["`mp:update-account`", "Update nickname/postcode/email on a linked account"],
			["`mp:create-ad`", "Submit a new ad via a linked account"],
			["`status`", "Provider health"],
		],
	);
	ctx.out.write("> Flags: `--json` `--quiet` `--no-color` `--no-progress`");
}
