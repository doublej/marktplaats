/**
 * Operation layer: every command the CLI and the MCP server can run, as plain
 * async functions over validated input. Both surfaces are thin adapters — the
 * CLI formats the result, the MCP server serialises it — so they stay in parity
 * by construction.
 */
export { OpsError } from "./errors.js";
export { openStorage, resolveStoragePath } from "./storage.js";

export {
	searchListings,
	getListingDetail,
	getSellerListings,
	getCategories,
	getStatus,
	searchInputShape,
	detailInputShape,
	sellerInputShape,
	categoriesInputShape,
	SearchInputSchema,
	DetailInputSchema,
	SellerInputSchema,
	CategoriesInputSchema,
	type SearchInput,
	type SearchResult,
	type DetailInput,
	type SellerInput,
	type SellerResult,
	type CategoriesInput,
	type CategoriesResult,
} from "./listings.js";

export {
	listWatches,
	createWatch,
	pollWatch,
	deleteWatch,
	DEFAULT_USER_ID,
	watchCreateInputShape,
	watchIdInputShape,
	WatchCreateInputSchema,
	WatchIdInputSchema,
	type WatchCreateInput,
	type WatchIdInput,
	type WatchWithState,
	type PollResult,
} from "./watches.js";

export {
	listAccounts,
	linkAccount,
	updateAccount,
	createAd,
	normalizePostcode,
	accountsInputShape,
	linkInputShape,
	updateAccountInputShape,
	createAdInputShape,
	AccountsInputSchema,
	LinkInputSchema,
	UpdateAccountInputSchema,
	CreateAdInputArgsSchema,
	type AccountSummary,
	type AccountsInput,
	type LinkInput,
	type UpdateAccountInput,
	type CreateAdArgs,
} from "./accounts.js";

export { getOverview, COMMANDS, VERSION, type Overview, type OverviewWatch } from "./overview.js";
