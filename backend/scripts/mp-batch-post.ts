/**
 * Unified Marktplaats batch poster — one command, deterministic, idempotent.
 *
 *   bun run scripts/mp-batch-post.ts --account <id> --file listings/<date>.json
 *
 *   --dry-run       fetch dashboard + validate, skip submit
 *   --only <slugs>  comma-separated whitelist (e.g. pax,bed)
 *
 * Flow:
 *   1. Load + validate listings JSON (zod schema).
 *   2. Decrypt session, fetch seller dashboard, build live {title → adId} map.
 *   3. For each listing: skip if title already live, else submit + screenshot.
 *   4. Persist rotated session state after every successful submit.
 *   5. Summary: live URLs for every listing (existing + new), non-zero exit on failure.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import {
	CreateAdInputSchema,
	PosterError,
	decryptStorageState,
	encryptStorageState,
	loadKeyFromEnv,
	submitAd,
} from "../src/poster/index.js";
import type { StorageState } from "../src/poster/types.js";
import { StorageManager } from "../src/server/storage.js";

const STORAGE_PATH = process.env.WATCH_STORAGE_PATH ?? "./marktplaats-watches.json";
const SELLER_DASH_URL = "https://www.marktplaats.nl/my-account/sell/index.html";

const ListingSchema = z.object({
	slug: z.string().min(1),
	title: z.string().min(3).max(60),
	priceCents: z.number().int().nonnegative().nullable(),
	priceType: z
		.enum(["FIXED", "BIDDING_FROM", "FREE", "RESERVED", "SWAP", "SEE_DESCRIPTION"])
		.default("FIXED"),
	deliveryMethod: z.enum(["Ophalen", "Verzenden", "OphalenOfVerzenden"]).default("Ophalen"),
	category: z.object({
		l1: z.string().regex(/^\d+$/),
		l2: z.string().regex(/^\d+$/),
		l2Name: z.string().min(1),
		bucket: z.string().regex(/^\d+$/).optional(),
	}),
	attributes: z.record(z.string(), z.string()).default({}),
	photos: z.array(z.string().min(1)).min(0),
	description: z.array(z.string()),
});

const BatchFileSchema = z.object({
	date: z.string(),
	photoDir: z.string().min(1),
	photoPrefix: z.string().default(""),
	photoSuffix: z.string().default(""),
	listings: z.array(ListingSchema).min(1),
});

type BatchFile = z.infer<typeof BatchFileSchema>;
type Listing = z.infer<typeof ListingSchema>;

function flag(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	if (i === -1) return undefined;
	const next = process.argv[i + 1];
	return next && !next.startsWith("--") ? next : "";
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

function resolvePhoto(b: BatchFile, stem: string): string {
	return resolve(b.photoDir, `${b.photoPrefix}${stem}${b.photoSuffix}`);
}

function normalizeTitle(t: string): string {
	return t.toLowerCase().replace(/\s+/g, " ").trim();
}

function buildCreateAdInput(l: Listing) {
	return CreateAdInputSchema.parse({
		title: l.title,
		description: l.description.join("\n"),
		priceCents: l.priceCents,
		priceType: l.priceType,
		l1CategoryId: l.category.l1,
		l2CategoryId: l.category.l2,
		l2CategoryFullName: l.category.l2Name,
		bucketId: l.category.bucket,
		deliveryMethod: l.deliveryMethod,
		attributes: l.attributes,
	});
}

async function fetchLiveAds(
	state: StorageState,
): Promise<{ map: Map<string, { adId: string; title: string }>; screenshotPath: string }> {
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
		const resp = await page.goto(SELLER_DASH_URL, {
			waitUntil: "domcontentloaded",
			timeout: 30_000,
		});
		if (!resp || !resp.ok()) {
			throw new Error(`seller dashboard ${resp?.status()}`);
		}
		await page.waitForTimeout(2500);
		const entries = await page.evaluate(() => {
			const out: Array<{ adId: string; title: string }> = [];
			for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
				const m = a.href.match(/\/seller\/view\/m(\d+)|\/v\/m(\d+)/);
				const adId = m?.[1] ?? m?.[2];
				if (!adId) continue;
				// Walk up to find the card that contains a title.
				let node: HTMLElement | null = a;
				let title: string | null = null;
				for (let i = 0; i < 5 && node; i++) {
					const h = node.querySelector("h1,h2,h3,h4,[class*='title' i]");
					if (h?.textContent?.trim()) {
						title = h.textContent.trim();
						break;
					}
					node = node.parentElement;
				}
				if (title) out.push({ adId, title });
			}
			return out;
		});
		const screenshotPath = "./screenshots/dashboard.png";
		await page.screenshot({ path: screenshotPath, fullPage: true });
		const map = new Map<string, { adId: string; title: string }>();
		for (const e of entries) {
			const key = normalizeTitle(e.title);
			if (!map.has(key)) map.set(key, e);
		}
		return { map, screenshotPath };
	} finally {
		await browser.close();
	}
}

async function screenshotLive(state: StorageState, adId: string, slug: string) {
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
		const itemId = adId.startsWith("m") ? adId : `m${adId}`;
		await page.goto(`https://www.marktplaats.nl/seller/view/${itemId}`, {
			waitUntil: "domcontentloaded",
			timeout: 30_000,
		});
		await page.waitForTimeout(2500);
		const path = `./screenshots/live-${slug}.png`;
		await page.screenshot({ path, fullPage: true });
		return path;
	} finally {
		await browser.close();
	}
}

function validatePhotos(batch: BatchFile): string[] {
	const missing: string[] = [];
	for (const l of batch.listings) {
		for (const p of l.photos) {
			const full = resolvePhoto(batch, p);
			if (!existsSync(full)) missing.push(`${l.slug}: ${full}`);
		}
	}
	return missing;
}

async function main() {
	const accountId = flag("account") ?? "";
	const file = flag("file") ?? "";
	if (!accountId || !file) {
		console.error("usage: mp-batch-post --account <id> --file <listings.json> [--dry-run] [--only slug1,slug2]");
		process.exit(2);
	}
	const dryRun = hasFlag("dry-run");
	const only = flag("only")?.split(",").filter(Boolean) ?? [];

	const raw = JSON.parse(readFileSync(resolve(file), "utf8"));
	const batch = BatchFileSchema.parse(raw);
	console.log(`loaded ${batch.listings.length} listings from ${file}`);

	const missing = validatePhotos(batch);
	if (missing.length) {
		console.error(`missing photos (${missing.length}):`);
		for (const m of missing) console.error("  -", m);
		process.exit(2);
	}
	console.log("✓ all photos present");

	const todo = only.length
		? batch.listings.filter((l) => only.includes(l.slug))
		: batch.listings;
	if (todo.length === 0) {
		console.error(`no listings matched --only ${only.join(",")}`);
		process.exit(2);
	}

	mkdirSync("./screenshots", { recursive: true });

	const storage = new StorageManager(STORAGE_PATH);
	const account = storage
		.getMpAccounts("cli")
		.find((a) => a.id === accountId || a.id.startsWith(accountId));
	if (!account) throw new Error(`no account ${accountId}`);
	console.log(`→ account ${account.id} (${account.label}) ${account.nickname}/${account.postCode}`);

	const key = loadKeyFromEnv();
	let state = decryptStorageState(account.encryptedStorageState, key);

	console.log("\n--- dashboard check ---");
	const { map: liveByTitle, screenshotPath } = await fetchLiveAds(state);
	console.log(`found ${liveByTitle.size} live ads on dashboard (📸 ${screenshotPath})`);
	for (const e of liveByTitle.values()) console.log(`  [${e.adId}] ${e.title}`);

	type Row = { slug: string; title: string; status: "existing" | "posted" | "skipped"; adId?: string };
	const results: Row[] = [];

	for (const listing of todo) {
		const key = normalizeTitle(listing.title);
		const existing = liveByTitle.get(key);
		if (existing) {
			console.log(`\n[${listing.slug}] EXISTING ${existing.adId}  ${listing.title}`);
			results.push({ slug: listing.slug, title: listing.title, status: "existing", adId: existing.adId });
			continue;
		}

		if (dryRun) {
			console.log(`\n[${listing.slug}] WOULD POST  ${listing.title}`);
			results.push({ slug: listing.slug, title: listing.title, status: "skipped" });
			continue;
		}

		const input = buildCreateAdInput(listing);
		const photos = listing.photos.map((p) => resolvePhoto(batch, p));
		console.log(`\n[${listing.slug}] POSTING (${photos.length} photos)  ${listing.title}`);
		try {
			const created = await submitAd({
				state,
				input,
				profile: { postCode: account.postCode, nickname: account.nickname },
				imagePaths: photos,
				onStateUpdate: (next) => {
					state = next;
				},
			});
			storage.updateMpAccount(account.id, {
				encryptedStorageState: encryptStorageState(state, key),
			});
			const shot = await screenshotLive(state, created.adId, listing.slug);
			console.log(`  ✅ adId=${created.adId}`);
			console.log(`     ${created.url}`);
			console.log(`     📸 ${shot}`);
			results.push({ slug: listing.slug, title: listing.title, status: "posted", adId: created.adId });
		} catch (err) {
			if (err instanceof PosterError) {
				console.error(`  ❌ ${err.name} [${err.code ?? "?"}]: ${err.message}`);
			} else {
				console.error(`  ❌ ${(err as Error).message}`);
			}
			console.error("\naborting batch");
			for (const r of results) console.error(`  ${r.status.padEnd(9)} ${r.slug} ${r.adId ?? ""}`);
			process.exit(1);
		}
	}

	console.log("\n=== summary ===");
	for (const r of results) {
		const url = r.adId ? `https://www.marktplaats.nl/v/m${r.adId}` : "";
		console.log(`  ${r.status.padEnd(9)} ${r.slug.padEnd(12)} ${url}`);
	}
	const newCount = results.filter((r) => r.status === "posted").length;
	const existCount = results.filter((r) => r.status === "existing").length;
	console.log(`\n✨ ${newCount} posted, ${existCount} already live${dryRun ? " (dry run)" : ""}`);
}

await main();
