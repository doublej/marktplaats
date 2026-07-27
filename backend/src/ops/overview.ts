import { getProviderStatus } from "../index.js";
import type { StorageManager } from "../server/storage.js";
import { openStorage, resolveStoragePath } from "./storage.js";
import { DEFAULT_USER_ID } from "./watches.js";

export const VERSION = "0.1.0";

/**
 * The command surface, shared by the CLI help/prime output and the MCP `prime`
 * tool. `command` is the CLI form, `tool` the MCP form of the same operation.
 */
export const COMMANDS = [
	{
		command: "search",
		tool: "search",
		usage: "`search <query>`",
		args: "<query> [--limit N] [--zip CODE] [--distance KM] [--min-price CENTS] [--max-price CENTS] [--sort price|date] [--order asc|desc] [--category SLUG] [--page N]",
		description: "Search listings (`--limit`, `--zip`, `--sort`, `--category`, ...)",
	},
	{
		command: "detail",
		tool: "detail",
		usage: "`detail <id>`",
		args: "<listing-id>",
		description: "Get full listing details",
	},
	{
		command: "seller",
		tool: "seller",
		usage: "`seller <id>`",
		args: "<seller-id> [--limit N]",
		description: "List seller's items (`--limit`)",
	},
	{
		command: "categories",
		tool: "categories",
		usage: "`categories`",
		args: "[--slug CATEGORY]",
		description: "Browse category tree (`--slug`)",
	},
	{
		command: "watches",
		tool: "watches",
		usage: "`watches`",
		args: "",
		description: "List configured watches",
	},
	{
		command: "watch:create",
		tool: "watch_create",
		usage: "`watch:create`",
		args: "--name NAME --query QUERY [--interval MIN] [--user ID] [--zip CODE] [--min-price CENTS] [--max-price CENTS]",
		description: "Create price watch (`--name`, `--query`, `--interval`, ...)",
	},
	{
		command: "watch:poll",
		tool: "watch_poll",
		usage: "`watch:poll <id>`",
		args: "<watch-id>",
		description: "Poll a watch immediately",
	},
	{
		command: "watch:delete",
		tool: "watch_delete",
		usage: "`watch:delete <id>`",
		args: "<watch-id>",
		description: "Delete a watch",
	},
	{
		command: "mp:link",
		tool: "mp_link",
		usage: "`mp:link`",
		args: "[--label NAME] [--user ID] [--postcode NNNN XX] [--nickname NAME] [--email ADDR]",
		description: "Link a marktplaats account (opens a headed browser)",
	},
	{
		command: "mp:accounts",
		tool: "mp_accounts",
		usage: "`mp:accounts`",
		args: "[--user ID]",
		description: "List linked mp accounts",
	},
	{
		command: "mp:update-account",
		tool: "mp_update_account",
		usage: "`mp:update-account`",
		args: "--account ID [--user ID] [--label NAME] [--nickname NAME] [--email ADDR] [--postcode NNNN XX]",
		description: "Update nickname/postcode/email on a linked account",
	},
	{
		command: "mp:create-ad",
		tool: "mp_create_ad",
		usage: "`mp:create-ad`",
		args: "--account ID --title T --description D --l1 ID --l2 ID --l2-name NAME [--price CENTS] [--bucket ID] [--delivery METHOD]",
		description: "Submit a new ad via a linked account",
	},
	{
		command: "status",
		tool: "status",
		usage: "`status`",
		args: "",
		description: "Provider health check",
	},
] as const;

export interface OverviewWatch {
	id: string;
	name: string;
	query: string;
	enabled: boolean;
	intervalMinutes: number;
	lastPolledAt: string | null;
	trackedListings: number;
}

export interface Overview {
	name: string;
	version: string;
	provider: ReturnType<typeof getProviderStatus>;
	storage: { path: string };
	accounts: { total: number };
	watches: {
		total: number;
		enabled: number;
		disabled: number;
		items: OverviewWatch[];
	};
	commands: { command: string; tool: string; args: string; description: string }[];
}

export function getOverview(storage: StorageManager = openStorage()): Overview {
	const watches = storage.getWatches();
	const enabled = watches.filter((w) => w.enabled);
	const accounts = storage.getMpAccounts(DEFAULT_USER_ID);

	return {
		name: "marktplaats-js",
		version: VERSION,
		provider: getProviderStatus(),
		storage: { path: resolveStoragePath() },
		accounts: { total: accounts.length },
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
			tool: c.tool,
			args: c.args,
			description: c.description,
		})),
	};
}
