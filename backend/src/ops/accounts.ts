import { z } from "zod";
import {
	CreateAdInputSchema,
	StorageStateSchema,
	decryptStorageState,
	encryptStorageState,
	loadKeyFromEnv,
	submitAd,
} from "../poster/index.js";
import type { CreatedAd } from "../poster/index.js";
import type { StorageManager } from "../server/storage.js";
import type { MpAccount } from "../server/types.js";
import { invalidArg, notFound } from "./errors.js";
import { openStorage } from "./storage.js";
import { DEFAULT_USER_ID } from "./watches.js";

const LOGIN_URL = "https://www.marktplaats.nl/identity/v2/login";
const HOME_URL = "https://www.marktplaats.nl/";
/** How long the headed login window stays open waiting for a manual sign-in. */
const LOGIN_TIMEOUT_MS = 5 * 60_000;

const POSTCODE_RE = /^(\d{4})\s?([A-Z]{2})$/i;

export function normalizePostcode(raw: string): string {
	const m = POSTCODE_RE.exec(raw.trim());
	if (!m?.[1] || !m[2]) invalidArg(`invalid postcode (expected NNNN XX): ${raw}`);
	return `${m[1]} ${m[2].toUpperCase()}`;
}

/** Public view of a linked account — never includes the encrypted session. */
export interface AccountSummary {
	id: string;
	label: string;
	mpUserId: string;
	nickname: string | null;
	email: string | null;
	postCode: string | null;
	linkedAt: string;
	lastUsedAt: string | null;
}

function toSummary(a: MpAccount): AccountSummary {
	return {
		id: a.id,
		label: a.label,
		mpUserId: a.mpUserId,
		nickname: a.nickname,
		email: a.email,
		postCode: a.postCode,
		linkedAt: a.linkedAt,
		lastUsedAt: a.lastUsedAt,
	};
}

export const accountsInputShape = {
	userId: z.string().optional().describe("Owner id (default 'cli')"),
} as const;

export const AccountsInputSchema = z.object(accountsInputShape);
export type AccountsInput = z.infer<typeof AccountsInputSchema>;

export function listAccounts(
	input: AccountsInput = {},
	storage: StorageManager = openStorage(),
): { count: number; accounts: AccountSummary[] } {
	const { userId } = AccountsInputSchema.parse(input);
	const accounts = storage.getMpAccounts(userId ?? DEFAULT_USER_ID);
	return { count: accounts.length, accounts: accounts.map(toSummary) };
}

export const linkInputShape = {
	label: z.string().optional().describe("Friendly name for the account (default 'default')"),
	userId: z.string().optional().describe("Owner id (default 'cli')"),
	postcode: z.string().optional().describe("Dutch postcode 'NNNN XX' used as the ad location"),
	nickname: z.string().optional().describe("Seller name shown on ads"),
	email: z.string().optional().describe("Login email (falls back to MP_LOGIN_EMAIL)"),
} as const;

export const LinkInputSchema = z.object(linkInputShape);
export type LinkInput = z.infer<typeof LinkInputSchema>;

/**
 * Opens a headed Chromium on the host so a human can sign in, then stores the
 * resulting session encrypted. Blocks until login completes or LOGIN_TIMEOUT_MS.
 */
export async function linkAccount(
	input: LinkInput = {},
	storage: StorageManager = openStorage(),
	onProgress?: (message: string) => void,
): Promise<AccountSummary> {
	const parsed = LinkInputSchema.parse(input);
	const postCode = parsed.postcode ? normalizePostcode(parsed.postcode) : null;
	const key = loadKeyFromEnv();

	const playwright = await import("playwright");
	onProgress?.("Launching headed Chromium — log in manually then close the window.");
	const browser = await playwright.chromium.launch({ headless: false });
	let rawState: Awaited<ReturnType<Awaited<ReturnType<typeof browser.newContext>>["storageState"]>>;
	try {
		const browserCtx = await browser.newContext();
		const page = await browserCtx.newPage();
		await page.goto(LOGIN_URL);
		await page.waitForURL((url) => !/identity\/v2\/login/.test(url.toString()), {
			timeout: LOGIN_TIMEOUT_MS,
		});
		await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });
		rawState = await browserCtx.storageState();
	} finally {
		await browser.close();
	}

	const state = StorageStateSchema.parse({ cookies: rawState.cookies, origins: rawState.origins });
	const account: MpAccount = {
		id: crypto.randomUUID(),
		appUserId: parsed.userId ?? DEFAULT_USER_ID,
		label: parsed.label ?? "default",
		mpUserId: "",
		nickname: parsed.nickname ?? null,
		email: parsed.email ?? process.env.MP_LOGIN_EMAIL ?? null,
		postCode,
		encryptedStorageState: encryptStorageState(state, key),
		linkedAt: new Date().toISOString(),
		lastUsedAt: null,
	};

	storage.addMpAccount(account);
	return toSummary(account);
}

export const updateAccountInputShape = {
	accountId: z.string().min(1).describe("Account id (from mp_accounts)"),
	userId: z.string().optional().describe("Owner id (default 'cli')"),
	label: z.string().optional().describe("New friendly name"),
	nickname: z.string().optional().describe("New seller name — empty string clears it"),
	email: z.string().optional().describe("New login email — empty string clears it"),
	postcode: z.string().optional().describe("New postcode 'NNNN XX'"),
} as const;

export const UpdateAccountInputSchema = z.object(updateAccountInputShape);
export type UpdateAccountInput = z.infer<typeof UpdateAccountInputSchema>;

export function updateAccount(
	input: UpdateAccountInput,
	storage: StorageManager = openStorage(),
): AccountSummary {
	const parsed = UpdateAccountInputSchema.parse(input);
	const userId = parsed.userId ?? DEFAULT_USER_ID;
	if (!storage.getMpAccount(parsed.accountId, userId)) {
		notFound(`Account not found: ${parsed.accountId}`);
	}

	const updates: Partial<MpAccount> = {};
	if (parsed.postcode !== undefined) updates.postCode = normalizePostcode(parsed.postcode);
	if (parsed.nickname !== undefined) updates.nickname = parsed.nickname || null;
	if (parsed.email !== undefined) updates.email = parsed.email || null;
	if (parsed.label !== undefined) updates.label = parsed.label;
	if (Object.keys(updates).length === 0) invalidArg("No fields to update");

	const updated = storage.updateMpAccount(parsed.accountId, updates);
	if (!updated) notFound(`Account not found: ${parsed.accountId}`);
	return toSummary(updated);
}

export const createAdInputShape = {
	accountId: z.string().min(1).describe("Linked account id to post as (from mp_accounts)"),
	userId: z.string().optional().describe("Owner id (default 'cli')"),
	title: z.string().min(3).max(60).describe("Ad title, 3-60 chars"),
	description: z.string().min(10).max(4000).describe("Ad body, 10-4000 chars"),
	priceCents: z
		.number()
		.int()
		.nonnegative()
		.nullable()
		.optional()
		.describe("Asking price in CENTS (€25 = 2500); null for no fixed price"),
	l1CategoryId: z.string().regex(/^\d+$/).describe("Top-level category id, digits only"),
	l2CategoryId: z.string().regex(/^\d+$/).describe("Sub-category id, digits only"),
	l2CategoryFullName: z
		.string()
		.min(1)
		.describe("Sub-category display name, e.g. 'Fietsen | Herenfietsen'"),
	bucketId: z.string().regex(/^\d+$/).optional().describe("Optional bucket id for the category"),
	deliveryMethod: z
		.enum(["Ophalen", "Verzenden", "OphalenOfVerzenden"])
		.optional()
		.describe("Delivery option (default 'Ophalen')"),
} as const;

export const CreateAdInputArgsSchema = z.object(createAdInputShape);
export type CreateAdArgs = z.infer<typeof CreateAdInputArgsSchema>;

export async function createAd(
	input: CreateAdArgs,
	storage: StorageManager = openStorage(),
): Promise<CreatedAd> {
	const parsed = CreateAdInputArgsSchema.parse(input);
	const account = storage.getMpAccount(parsed.accountId, parsed.userId ?? DEFAULT_USER_ID);
	if (!account) notFound(`Account not found: ${parsed.accountId}`);

	const key = loadKeyFromEnv();
	const state = decryptStorageState(account.encryptedStorageState, key);
	const adInput = CreateAdInputSchema.parse({
		title: parsed.title,
		description: parsed.description,
		priceCents: parsed.priceCents ?? null,
		l1CategoryId: parsed.l1CategoryId,
		l2CategoryId: parsed.l2CategoryId,
		l2CategoryFullName: parsed.l2CategoryFullName,
		bucketId: parsed.bucketId,
		deliveryMethod: parsed.deliveryMethod ?? "Ophalen",
	});

	return submitAd({
		state,
		input: adInput,
		profile: { postCode: account.postCode, nickname: account.nickname },
		onStateUpdate: (next) => {
			storage.updateMpAccount(account.id, {
				encryptedStorageState: encryptStorageState(next, key),
				lastUsedAt: new Date().toISOString(),
			});
		},
	});
}
