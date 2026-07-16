/**
 * Non-mutating recon for /plaats/api/image/upload.
 *
 * 1. Load SYI page (Kledingkasten).
 * 2. Screenshot the empty form.
 * 3. Intercept outgoing requests to /plaats/api/image/upload to capture the
 *    exact multipart field name + headers the SPA uses.
 * 4. Use Playwright setInputFiles() to upload one PAX photo via the real
 *    <input type=file> — lets the page's own JS build the request.
 * 5. Wait for the response, dump body, screenshot the form with thumbnail.
 * 6. Do NOT submit. Close browser. Leaves zero state changes on MP.
 */

import { writeFileSync } from "node:fs";
import { decryptStorageState, loadKeyFromEnv } from "../src/poster/index.js";
import { StorageManager } from "../src/server/storage.js";

const STORAGE_PATH = process.env.WATCH_STORAGE_PATH ?? "./marktplaats-watches.json";
const PHOTO =
	"/Users/jurrejan/Downloads/WhatsApp Image 2026-04-11 at 07.58.56.jpeg";

function flag(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	if (i === -1) return undefined;
	const next = process.argv[i + 1];
	return next && !next.startsWith("--") ? next : "";
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
	const key = loadKeyFromEnv();
	const state = decryptStorageState(account.encryptedStorageState, key);

	const playwright = await import("playwright");
	const browser = await playwright.chromium.launch({ headless: false });
	try {
		const ctx = await browser.newContext({
			storageState: {
				cookies: state.cookies,
				origins: state.origins.map((o) => ({
					origin: o.origin,
					localStorage: o.localStorage ?? [],
				})),
			},
			userAgent:
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
			locale: "nl-NL",
			timezoneId: "Europe/Amsterdam",
			viewport: { width: 1280, height: 900 },
		});
		const page = await ctx.newPage();

		// Capture upload request details.
		const captured: Array<{
			method: string;
			url: string;
			headers: Record<string, string>;
			postData: string | null;
		}> = [];
		page.on("request", (req) => {
			if (req.url().includes("/plaats/api/image/upload")) {
				captured.push({
					method: req.method(),
					url: req.url(),
					headers: req.headers(),
					postData: req.postData(),
				});
			}
		});

		const responses: Array<{ status: number; body: string }> = [];
		page.on("response", async (res) => {
			if (res.url().includes("/plaats/api/image/upload")) {
				try {
					responses.push({ status: res.status(), body: await res.text() });
				} catch {
					/* ignore */
				}
			}
		});

		const url =
			"https://www.marktplaats.nl/plaats/504/518?bucketId=135&title=probe%20upload";
		console.log(`→ goto ${url}`);
		await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
		await page.waitForFunction(
			() => {
				const el = document.querySelector<HTMLInputElement>('input[name="xsrf.token"]');
				return !!el && !!el.value;
			},
			{ timeout: 20_000 },
		);
		await page.waitForTimeout(1500);

		console.log("→ screenshot: syi form empty");
		await page.screenshot({
			path: "./screenshots/01-syi-form-empty.png",
			fullPage: true,
		});

		console.log(`→ setInputFiles on #imageUploader-hiddenInput with ${PHOTO}`);
		await page.setInputFiles("#imageUploader-hiddenInput", PHOTO);

		console.log("→ waiting for upload response");
		// Wait until we see a captured response.
		const start = Date.now();
		while (responses.length === 0 && Date.now() - start < 30_000) {
			await page.waitForTimeout(200);
		}

		if (responses.length === 0) {
			console.error("❌ no upload response captured within 30s");
		} else {
			for (const r of responses) {
				console.log(`\n=== response status=${r.status} ===`);
				console.log(r.body);
			}
		}

		for (const c of captured) {
			console.log(`\n=== captured request ===`);
			console.log(`${c.method} ${c.url}`);
			console.log("headers:");
			for (const [k, v] of Object.entries(c.headers)) {
				if (k === "cookie") console.log(`  ${k}=<len ${v.length}>`);
				else if (/content-length|content-type|x-mp-xsrf|referer|origin/i.test(k))
					console.log(`  ${k}=${v}`);
			}
			console.log(
				`postData: ${c.postData ? `len=${c.postData.length}, head=${JSON.stringify(c.postData.slice(0, 300))}` : "null"}`,
			);
		}

		console.log("→ waiting 2s for thumbnail to render");
		await page.waitForTimeout(2000);
		console.log("→ screenshot: syi form after upload");
		await page.screenshot({
			path: "./screenshots/02-syi-form-after-upload.png",
			fullPage: true,
		});

		// Pull the images.ids input to see what value the SPA set.
		const postUploadState = await page.evaluate(() => {
			const ids = document.querySelectorAll<HTMLInputElement>('input[name="images.ids"]');
			const urls = document.querySelectorAll<HTMLInputElement>('input[name="images.urls"]');
			return {
				ids: Array.from(ids).map((e) => e.value),
				urls: Array.from(urls).map((e) => e.value),
			};
		});
		console.log(`\n=== post-upload form inputs ===`);
		console.log(`images.ids  = ${JSON.stringify(postUploadState.ids)}`);
		console.log(`images.urls = ${JSON.stringify(postUploadState.urls)}`);

		writeFileSync(
			"./upload-probe-result.json",
			JSON.stringify({ captured, responses, postUploadState }, null, 2),
		);
		console.log("\n→ raw dump → ./upload-probe-result.json");
	} finally {
		await browser.close();
	}
}

await main();
