/**
 * Canary #2: real submit WITH photo uploads, auto-delete on success.
 *
 * Exercises the full flow: prepareSyi (tokens + multi-image upload) →
 * submitAd → screenshots → deleteAd. One shot, no retries.
 *
 *   bun run scripts/mp-canary-with-photos.ts --account <id>
 */

import {
	CreateAdInputSchema,
	PosterError,
	decryptStorageState,
	deleteAd,
	loadKeyFromEnv,
	submitAd,
} from "../src/poster/index.js";
import type { StorageState } from "../src/poster/types.js";
import { StorageManager } from "../src/server/storage.js";

const STORAGE_PATH = process.env.WATCH_STORAGE_PATH ?? "./marktplaats-watches.json";

const PHOTOS = [
	"/Users/jurrejan/Downloads/WhatsApp Image 2026-04-11 at 07.58.56.jpeg",
	"/Users/jurrejan/Downloads/WhatsApp Image 2026-04-11 at 07.58.56 (1).jpeg",
];

function flag(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	if (i === -1) return undefined;
	const next = process.argv[i + 1];
	return next && !next.startsWith("--") ? next : "";
}

async function screenshot(state: StorageState, url: string, name: string) {
	const playwright = await import("playwright");
	const browser = await playwright.chromium.launch({ headless: true });
	try {
		const ctx = await browser.newContext({
			viewport: { width: 1280, height: 1600 },
			storageState: {
				cookies: state.cookies,
				origins: state.origins.map((o) => ({
					origin: o.origin,
					localStorage: o.localStorage ?? [],
				})),
			},
		});
		const page = await ctx.newPage();
		await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
		await page.waitForTimeout(2500);
		await page.screenshot({ path: `./screenshots/${name}.png`, fullPage: true });
		console.log(`   📸 ./screenshots/${name}.png`);
	} finally {
		await browser.close();
	}
}

async function main() {
	const accountId = flag("account") ?? "";
	if (!accountId) {
		console.error("--account required");
		process.exit(2);
	}
	const storage = new StorageManager(STORAGE_PATH);
	const account = storage
		.getMpAccounts("cli")
		.find((a) => a.id === accountId || a.id.startsWith(accountId));
	if (!account) throw new Error(`no account ${accountId}`);

	console.log(`→ account ${account.id} (${account.label}) Jurre/${account.postCode}`);
	const key = loadKeyFromEnv();
	const state = decryptStorageState(account.encryptedStorageState, key);

	const input = CreateAdInputSchema.parse({
		title: "IKEA PAX schuifdeurkast 150x200 wit met frosted glas (test)",
		description:
			"CANARY TEST — deze advertentie wordt binnen 10 seconden verwijderd.\n\n" +
			"IKEA PAX kledingkast, wit, met twee schuifdeuren (frosted glas, witte randen). " +
			"Afmetingen ongeveer 150 cm breed x 200 cm hoog x 58 cm diep.",
		priceCents: 9500,
		l1CategoryId: "504",
		l2CategoryId: "518",
		l2CategoryFullName: "Kasten | Kledingkasten",
		bucketId: "135",
		deliveryMethod: "Ophalen",
		attributes: {
			condition: "Gebruikt",
			height: "200 cm of meer",
			width: "150 tot 200 cm",
			depth: "50 tot 75 cm",
		},
	});

	console.log(`\n=== STAGE 1: submit with ${PHOTOS.length} photos ===`);
	let adId: string | null = null;
	try {
		const created = await submitAd({
			state,
			input,
			profile: { postCode: account.postCode, nickname: account.nickname },
			imagePaths: PHOTOS,
		});
		adId = created.adId;
		console.log(`✅ adId=${created.adId}`);
		console.log(`   ${created.url}`);
	} catch (err) {
		if (err instanceof PosterError) {
			console.error(`❌ ${err.name} [${err.code ?? "?"}]: ${err.message}`);
		} else {
			console.error(`❌ ${(err as Error).message}`);
		}
		process.exit(1);
	}

	console.log(`\n=== STAGE 2: screenshot live ad (seller view) ===`);
	const itemId = adId.startsWith("m") ? adId : `m${adId}`;
	try {
		await screenshot(
			state,
			`https://www.marktplaats.nl/seller/view/${itemId}`,
			"03-live-ad-with-photos",
		);
	} catch (err) {
		console.warn(`   ! screenshot failed: ${(err as Error).message}`);
	}

	console.log(`\n=== STAGE 3: delete ad ${adId} ===`);
	try {
		await deleteAd(state, adId);
		console.log("✅ deleted");
	} catch (err) {
		console.error(`❌ delete failed: ${(err as Error).message}`);
		console.error(`\n⚠️  MANUAL ACTION REQUIRED: https://www.marktplaats.nl/v/m${adId}`);
		process.exit(3);
	}

	console.log(`\n=== STAGE 4: screenshot post-delete ===`);
	try {
		await screenshot(state, `https://www.marktplaats.nl/v/${itemId}`, "04-deleted-ad");
	} catch (err) {
		console.warn(`   ! screenshot failed: ${(err as Error).message}`);
	}

	console.log("\n✨ canary complete — all stages passed");
}

await main();
