import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	accountsInputShape,
	categoriesInputShape,
	createAd,
	createAdInputShape,
	createWatch,
	deleteWatch,
	detailInputShape,
	getCategories,
	getListingDetail,
	getOverview,
	getSellerListings,
	getStatus,
	linkAccount,
	linkInputShape,
	listAccounts,
	listWatches,
	pollWatch,
	searchInputShape,
	searchListings,
	sellerInputShape,
	updateAccount,
	updateAccountInputShape,
	watchCreateInputShape,
	watchIdInputShape,
} from "../ops/index.js";
import { run } from "./result.js";

/**
 * Registers one tool per CLI command. Every handler is a thin call into the ops
 * layer the CLI uses, so the two surfaces cannot drift.
 *
 * `readOnlyHint` marks tools that only fetch; `openWorldHint` marks tools that
 * reach marktplaats.nl. Both are advisory signals for MCP clients.
 */
export function registerTools(server: McpServer): void {
	server.registerTool(
		"prime",
		{
			title: "Project overview",
			description:
				"Start here. Returns provider health, the storage path, configured watches, linked accounts, and the full tool catalogue. Mirrors the CLI `prime` command.",
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		async () => run(() => getOverview()),
	);

	server.registerTool(
		"search",
		{
			title: "Search listings",
			description:
				"Search marktplaats.nl listings. Prices are integer CENTS everywhere (€50 = 5000). Returns up to `limit` results (default 10).",
			inputSchema: searchInputShape,
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) => run(() => searchListings(args)),
	);

	server.registerTool(
		"detail",
		{
			title: "Listing detail",
			description:
				"Fetch the full listing page for one ad: description, images, attributes, seller, view count.",
			inputSchema: detailInputShape,
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) => run(() => getListingDetail(args)),
	);

	server.registerTool(
		"seller",
		{
			title: "Seller listings",
			description: "List every active ad from one seller (default 30).",
			inputSchema: sellerInputShape,
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) => run(() => getSellerListings(args)),
	);

	server.registerTool(
		"categories",
		{
			title: "Category tree",
			description:
				"Browse the category tree. Omit `slug` for top-level categories, pass one to list its subcategories. Slugs feed `search`'s categorySlug.",
			inputSchema: categoriesInputShape,
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async (args) => run(() => getCategories(args)),
	);

	server.registerTool(
		"status",
		{
			title: "Provider health",
			description:
				"Scraper provider health: circuit-breaker state, request counts, consecutive failures.",
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		async () => run(() => getStatus()),
	);

	server.registerTool(
		"watches",
		{
			title: "List watches",
			description:
				"List saved searches that poll on an interval, each with its tracked listings and last poll time.",
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		async () => run(() => listWatches()),
	);

	server.registerTool(
		"watch_create",
		{
			title: "Create watch",
			description:
				"Save a search that polls on an interval and reports new listings and price drops. Prices in CENTS.",
			inputSchema: watchCreateInputShape,
			annotations: { readOnlyHint: false, openWorldHint: false },
		},
		async (args) => run(() => createWatch(args)),
	);

	server.registerTool(
		"watch_poll",
		{
			title: "Poll watch now",
			description:
				"Run a watch immediately and return the new-listing and price-drop events it found. Updates the watch's tracked state.",
			inputSchema: watchIdInputShape,
			annotations: { readOnlyHint: false, openWorldHint: true },
		},
		async (args) => run(() => pollWatch(args)),
	);

	server.registerTool(
		"watch_delete",
		{
			title: "Delete watch",
			description: "Remove a watch and its tracked listing state. Not reversible.",
			inputSchema: watchIdInputShape,
			annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
		},
		async (args) => run(() => deleteWatch(args)),
	);

	server.registerTool(
		"mp_accounts",
		{
			title: "List linked accounts",
			description:
				"List marktplaats accounts linked for posting. Never returns the stored session, only its metadata.",
			inputSchema: accountsInputShape,
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		async (args) => run(() => listAccounts(args)),
	);

	server.registerTool(
		"mp_link",
		{
			title: "Link a marktplaats account",
			description:
				"Opens a headed Chromium window ON THE HOST MACHINE and waits up to 5 minutes for a human to sign in, then stores the session encrypted. Requires a display and MP_SESSION_KEY. Only call when the user has explicitly asked to link an account and can reach the screen.",
			inputSchema: linkInputShape,
			annotations: { readOnlyHint: false, openWorldHint: true },
		},
		async (args) => run(() => linkAccount(args, undefined, (m) => console.error(`[mp_link] ${m}`))),
	);

	server.registerTool(
		"mp_update_account",
		{
			title: "Update linked account",
			description:
				"Change the label, seller nickname, email, or postcode on a linked account. Pass an empty string to clear nickname or email.",
			inputSchema: updateAccountInputShape,
			annotations: { readOnlyHint: false, openWorldHint: false },
		},
		async (args) => run(() => updateAccount(args)),
	);

	server.registerTool(
		"mp_create_ad",
		{
			title: "Post a new ad",
			description:
				"Publish a real, publicly visible ad on marktplaats.nl using a linked account. Price in CENTS. Category ids come from `categories`. Confirm the exact wording and price with the user before calling.",
			inputSchema: createAdInputShape,
			annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
		},
		async (args) => run(() => createAd(args)),
	);
}
