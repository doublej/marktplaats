import {
	CreateAdInputSchema,
	PosterError,
	StorageStateSchema,
	decryptStorageState,
	encryptStorageState,
	loadKeyFromEnv,
	submitAd,
} from "../poster/index.js";
import { StorageManager } from "../server/storage.js";
import type { MpAccount } from "../server/types.js";
import { type Ctx, fail } from "./output.js";

const STORAGE_PATH = process.env.WATCH_STORAGE_PATH ?? "./marktplaats-watches.json";
const LOGIN_URL = "https://www.marktplaats.nl/identity/v2/login";
const HOME_URL = "https://www.marktplaats.nl/";

const POSTCODE_RE = /^(\d{4})\s?([A-Z]{2})$/i;

function normalizePostcode(raw: string): string {
	const m = POSTCODE_RE.exec(raw.trim());
	if (!m?.[1] || !m[2]) throw new Error(`invalid postcode (expected NNNN XX): ${raw}`);
	return `${m[1]} ${m[2].toUpperCase()}`;
}

export async function runMpLink(ctx: Ctx): Promise<void> {
	const label = ctx.flag("label") ?? "default";
	const appUser = ctx.flag("user") ?? "cli";
	const postcodeFlag = ctx.flag("postcode");
	const nicknameFlag = ctx.flag("nickname");
	const emailFlag = ctx.flag("email") ?? process.env.MP_LOGIN_EMAIL ?? null;
	const postCode = postcodeFlag ? normalizePostcode(postcodeFlag) : null;
	const key = loadKeyFromEnv();
	const playwright = await import("playwright");
	ctx.out.write("Launching headed Chromium — log in manually then close the window.");
	const browser = await playwright.chromium.launch({ headless: false });
	const ctxBrowser = await browser.newContext();
	const page = await ctxBrowser.newPage();
	await page.goto(LOGIN_URL);
	await page.waitForURL((url) => !/identity\/v2\/login/.test(url.toString()), {
		timeout: 5 * 60_000,
	});
	await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });
	const rawState = await ctxBrowser.storageState();
	await browser.close();
	const state = StorageStateSchema.parse({
		cookies: rawState.cookies,
		origins: rawState.origins,
	});
	const account: MpAccount = {
		id: crypto.randomUUID(),
		appUserId: appUser,
		label,
		mpUserId: "",
		nickname: nicknameFlag ?? null,
		email: emailFlag,
		postCode,
		encryptedStorageState: encryptStorageState(state, key),
		linkedAt: new Date().toISOString(),
		lastUsedAt: null,
	};
	const storage = new StorageManager(STORAGE_PATH);
	storage.addMpAccount(account);
	if (ctx.flags.json) {
		ctx.out.json({
			id: account.id,
			label: account.label,
			nickname: account.nickname,
			email: account.email,
			postCode: account.postCode,
		});
		return;
	}
	ctx.out.write(
		`Linked mp account **${account.label}** (\`${account.id}\`) — nickname=${account.nickname ?? "—"} postcode=${account.postCode ?? "—"}`,
	);
}

export async function runMpUpdateAccount(ctx: Ctx): Promise<void> {
	const appUser = ctx.flag("user") ?? "cli";
	const accountId = ctx.flag("account") ?? fail(ctx, "Missing: --account", "MISSING_ARG");
	const storage = new StorageManager(STORAGE_PATH);
	const existing = storage.getMpAccount(accountId, appUser);
	if (!existing) fail(ctx, `Account not found: ${accountId}`, "NOT_FOUND");
	const updates: Partial<MpAccount> = {};
	const postcodeFlag = ctx.flag("postcode");
	const nicknameFlag = ctx.flag("nickname");
	const emailFlag = ctx.flag("email");
	const labelFlag = ctx.flag("label");
	if (postcodeFlag !== undefined) updates.postCode = normalizePostcode(postcodeFlag);
	if (nicknameFlag !== undefined) updates.nickname = nicknameFlag || null;
	if (emailFlag !== undefined) updates.email = emailFlag || null;
	if (labelFlag !== undefined) updates.label = labelFlag;
	if (Object.keys(updates).length === 0) fail(ctx, "No fields to update", "MISSING_ARG");
	const updated = storage.updateMpAccount(accountId, updates);
	if (!updated) fail(ctx, "Update failed", "NOT_FOUND");
	if (ctx.flags.json) {
		ctx.out.json({
			id: updated.id,
			label: updated.label,
			nickname: updated.nickname,
			email: updated.email,
			postCode: updated.postCode,
		});
		return;
	}
	ctx.out.write(
		`Updated **${updated.label}** (\`${updated.id}\`) — nickname=${updated.nickname ?? "—"} postcode=${updated.postCode ?? "—"} email=${updated.email ?? "—"}`,
	);
}

export async function runMpAccounts(ctx: Ctx): Promise<void> {
	const appUser = ctx.flag("user") ?? "cli";
	const storage = new StorageManager(STORAGE_PATH);
	const accounts = storage.getMpAccounts(appUser);
	if (ctx.flags.json) {
		ctx.out.json({
			count: accounts.length,
			accounts: accounts.map((a) => ({
				id: a.id,
				label: a.label,
				mpUserId: a.mpUserId,
				nickname: a.nickname,
				email: a.email,
				postCode: a.postCode,
				linkedAt: a.linkedAt,
				lastUsedAt: a.lastUsedAt,
			})),
		});
		return;
	}
	ctx.out.heading(`MP accounts — ${accounts.length}`, 1);
	if (accounts.length === 0) {
		ctx.out.write("No accounts. Link with `mp:link`.");
		return;
	}
	ctx.out.table(
		["ID", "Label", "Nickname", "Postcode", "Linked"],
		accounts.map((a) => [
			a.id.slice(0, 8),
			a.label,
			a.nickname ?? "—",
			a.postCode ?? "—",
			a.linkedAt.slice(0, 10),
		]),
	);
}

export async function runMpCreateAd(ctx: Ctx): Promise<void> {
	const appUser = ctx.flag("user") ?? "cli";
	const accountId = ctx.flag("account") ?? fail(ctx, "Missing: --account", "MISSING_ARG");
	const title = ctx.flag("title") ?? fail(ctx, "Missing: --title", "MISSING_ARG");
	const description = ctx.flag("description") ?? fail(ctx, "Missing: --description", "MISSING_ARG");
	const priceFlag = ctx.flag("price");
	const l1 = ctx.flag("l1") ?? fail(ctx, "Missing: --l1", "MISSING_ARG");
	const l2 = ctx.flag("l2") ?? fail(ctx, "Missing: --l2", "MISSING_ARG");
	const l2Full = ctx.flag("l2-name") ?? fail(ctx, "Missing: --l2-name", "MISSING_ARG");
	const bucket = ctx.flag("bucket");
	const delivery = ctx.flag("delivery") ?? "Ophalen";
	const storage = new StorageManager(STORAGE_PATH);
	const account = storage.getMpAccount(accountId, appUser);
	if (!account) {
		fail(ctx, `Account not found: ${accountId}`, "NOT_FOUND");
	}
	const key = loadKeyFromEnv();
	const state = decryptStorageState(account.encryptedStorageState, key);
	const input = CreateAdInputSchema.parse({
		title,
		description,
		priceCents: priceFlag ? Number(priceFlag) : null,
		l1CategoryId: l1,
		l2CategoryId: l2,
		l2CategoryFullName: l2Full,
		bucketId: bucket,
		deliveryMethod: delivery,
	});
	try {
		const created = await submitAd({
			state,
			input,
			profile: { postCode: account.postCode, nickname: account.nickname },
			onStateUpdate: (next) => {
				storage.updateMpAccount(account.id, {
					encryptedStorageState: encryptStorageState(next, key),
					lastUsedAt: new Date().toISOString(),
				});
			},
		});
		if (ctx.flags.json) {
			ctx.out.json(created);
			return;
		}
		ctx.out.write(`Created ad \`${created.adId}\` — ${created.url}`);
	} catch (err) {
		if (err instanceof PosterError) {
			fail(ctx, `${err.code ?? "POSTER_ERROR"}: ${err.message}`, err.code ?? "POSTER_ERROR");
		}
		throw err;
	}
}
