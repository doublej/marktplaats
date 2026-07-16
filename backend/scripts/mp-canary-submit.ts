/**
 * Option A: single controlled dry run.
 *
 * Submits ONE real ad via the existing submitAd() path, then immediately
 * DELETEs it via /seller/api/delete-ad (endpoint lifted from recon).
 *
 * Uses listing #1 (IKEA PAX) from the draft — we have known L1/L2/bucket
 * for this category from FLOW.md (504/518/135).
 *
 * No photos, no category attributes — this run is purely to surface where
 * the existing poster breaks (token selectors, signature scope, missing
 * required fields). Exactly one submit attempt. No retries.
 *
 *   bun run scripts/mp-canary-submit.ts --account <id>
 */

import {
	CreateAdInputSchema,
	PosterError,
	decryptStorageState,
	loadKeyFromEnv,
	submitAd,
} from "../src/poster/index.js";
import { StorageManager } from "../src/server/storage.js";

const STORAGE_PATH = process.env.WATCH_STORAGE_PATH ?? "./marktplaats-watches.json";
const DELETE_URL = "https://www.marktplaats.nl/seller/api/delete-ad";

function flag(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	if (i === -1) return undefined;
	const next = process.argv[i + 1];
	return next && !next.startsWith("--") ? next : "";
}

async function main() {
	const accountId = flag("account");
	if (!accountId) {
		console.error("ERROR: --account <id> required");
		process.exit(2);
	}
	const storage = new StorageManager(STORAGE_PATH);
	const account = storage
		.getMpAccounts("cli")
		.find((a) => a.id === accountId || a.id.startsWith(accountId));
	if (!account) {
		console.error(`ERROR: no account matching ${accountId}`);
		process.exit(2);
	}
	console.log(`→ account ${account.id} (${account.label})`);
	console.log(`  nickname=${account.nickname} postcode=${account.postCode}`);

	const key = loadKeyFromEnv();
	const state = decryptStorageState(account.encryptedStorageState, key);

	// Listing #1 from /Users/jurrejan/Documents/development/_life/Personal/marktplaats-listings-2026-04-11.md
	const input = CreateAdInputSchema.parse({
		title: "IKEA PAX schuifdeurkast 150x200 wit met frosted glas",
		description:
			"IKEA PAX kledingkast, wit, met twee schuifdeuren (frosted glas, witte randen). " +
			"Afmetingen ongeveer 150 cm breed x 200 cm hoog x 58 cm diep. " +
			"Inbegrepen: frame, 2 schuifdeuren met rails, 2 legplanken, 1 kledingroede, 3 KOMPLEMENT draadmanden. " +
			"De kast is al gedemonteerd. Reden verkoop: verhuizing, moet snel weg. " +
			"Ophalen in Utrecht (Volkerakstraat). Bij voorkeur weekend of avond.",
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

	console.log("\n=== STAGE 1: submit ===");
	let adId: string | null = null;
	try {
		const created = await submitAd({
			state,
			input,
			profile: { postCode: account.postCode, nickname: account.nickname },
		});
		adId = created.adId;
		console.log(`✅ submitAd succeeded: adId=${created.adId} url=${created.url}`);
	} catch (err) {
		if (err instanceof PosterError) {
			console.error(`❌ ${err.name} [${err.code ?? "?"}]: ${err.message}`);
		} else {
			console.error(`❌ unexpected: ${(err as Error).message}`);
		}
		console.log("\n→ no ad created, nothing to delete. bailing.");
		process.exit(1);
	}

	console.log("\n=== STAGE 2: delete ===");
	console.log(`→ DELETE ${DELETE_URL} itemId=m${adId}`);
	const cookieStr = state.cookies
		.filter((c) => c.domain.endsWith("marktplaats.nl"))
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");
	// Reuse a fresh xsrf by grabbing one via Playwright — SYI token is single-use-ish.
	// Cheap path first: try to generate via same algorithm the SPA uses (timestamp.sha256)
	// — but we don't have the key. So instead: load any authenticated page, grab xsrf
	// from window.__STATE__ or embedded JSON. For the canary: just try with the SYI
	// token we already have (reuse via a second SYI page load).
	const playwright = await import("playwright");
	const browser = await playwright.chromium.launch({ headless: true });
	let deleteOk = false;
	try {
		const ctx = await browser.newContext({
			storageState: {
				cookies: state.cookies,
				origins: state.origins.map((o) => ({
					origin: o.origin,
					localStorage: o.localStorage ?? [],
				})),
			},
		});
		const page = await ctx.newPage();
		// Navigate to the seller view — this is where the SPA's delete button lives,
		// and the page has an embedded xsrf token.
		const sellerView = `https://www.marktplaats.nl/seller/view/m${adId}`;
		console.log(`→ loading ${sellerView} to grab fresh xsrf`);
		await page.goto(sellerView, { waitUntil: "domcontentloaded", timeout: 30_000 });
		// Try multiple hiding spots for the xsrf token.
		const xsrf = await page.evaluate(() => {
			// 1. input[name="xsrf.token"]
			const el = document.querySelector<HTMLInputElement>('input[name="xsrf.token"]');
			if (el?.value) return { source: "input", value: el.value };
			// 2. meta tag
			const meta = document.querySelector<HTMLMetaElement>(
				'meta[name="xsrf-token"], meta[name="_csrf"], meta[name="csrf-token"]',
			);
			if (meta?.content) return { source: "meta", value: meta.content };
			// 3. embedded JSON — search for timestamp.hex pattern in any <script>
			for (const s of Array.from(document.querySelectorAll("script"))) {
				const m = s.textContent?.match(/\b(\d{13}\.[a-f0-9]{64})\b/);
				if (m) return { source: "script", value: m[1] };
			}
			return { source: "none", value: null };
		});
		console.log(`  xsrf source=${xsrf.source}${xsrf.value ? ` len=${xsrf.value.length}` : ""}`);
		if (!xsrf.value) {
			console.error("❌ could not extract xsrf — skipping delete");
		} else {
			const res = await fetch(DELETE_URL, {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
					Cookie: cookieStr,
					"x-mp-xsrf": xsrf.value,
					Origin: "https://www.marktplaats.nl",
					Referer: sellerView,
					"User-Agent":
						"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
				},
				body: JSON.stringify({ itemId: `m${adId}`, reason: "NO_DEAL_VIA_MP" }),
			});
			console.log(`  DELETE → ${res.status}`);
			if (res.status === 200) {
				deleteOk = true;
				console.log("✅ ad deleted");
			} else {
				const txt = await res.text().catch(() => "");
				console.error(`❌ delete failed: ${txt.slice(0, 300)}`);
			}
		}
	} finally {
		await browser.close();
	}
	if (!deleteOk) {
		console.error("\n⚠️  AD IS STILL LIVE. Manual action required:");
		console.error(`    https://www.marktplaats.nl/v/m${adId}`);
		process.exit(3);
	}
}

await main();
