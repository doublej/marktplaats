/**
 * Non-mutating recon: load the SYI page for Kledingkasten (l1=504 l2=518 bucket=135)
 * and dump every <input>/<select>/<textarea>, every form action, and every
 * timestamp.hex candidate embedded in scripts.
 *
 * No form submit, no network mutations.
 */

import { writeFileSync } from "node:fs";
import {
	decryptStorageState,
	loadKeyFromEnv,
} from "../src/poster/index.js";
import { StorageManager } from "../src/server/storage.js";

const STORAGE_PATH = process.env.WATCH_STORAGE_PATH ?? "./marktplaats-watches.json";

function flag(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	if (i === -1) return undefined;
	const next = process.argv[i + 1];
	return next && !next.startsWith("--") ? next : "";
}

async function main() {
	const accountId = flag("account") ?? process.exit(2);
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
		});
		const page = await ctx.newPage();
		const url =
			"https://www.marktplaats.nl/plaats/504/518?bucketId=135&title=Probe%20IKEA%20PAX%20test";
		console.log(`→ goto ${url}`);
		const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
		console.log(`  status=${resp?.status()} url=${page.url()}`);

		// Wait for the form to have hydrated.
		await page.waitForTimeout(3000);

		const dump = await page.evaluate(() => {
			const inputs = Array.from(document.querySelectorAll("input, select, textarea")).map(
				(el) => {
					const e = el as
						| HTMLInputElement
						| HTMLSelectElement
						| HTMLTextAreaElement;
					return {
						tag: e.tagName.toLowerCase(),
						name: (e as HTMLInputElement).name ?? null,
						id: e.id || null,
						type: (e as HTMLInputElement).type ?? null,
						hasValue: !!(e as HTMLInputElement).value,
						valueLen: ((e as HTMLInputElement).value ?? "").length,
						valuePreview: ((e as HTMLInputElement).value ?? "").slice(0, 80),
					};
				},
			);
			const forms = Array.from(document.querySelectorAll("form")).map((f) => ({
				action: f.action,
				method: f.method,
				id: f.id,
			}));
			const tokenCandidates: Array<{ source: string; value: string }> = [];
			const tsHexRe = /\b(\d{13})\.([a-f0-9]{64})\b/g;
			for (const s of Array.from(document.querySelectorAll("script"))) {
				const t = s.textContent ?? "";
				let m: RegExpExecArray | null;
				while ((m = tsHexRe.exec(t))) {
					tokenCandidates.push({
						source: s.id || s.src || "inline",
						value: `${m[1]}.${m[2]}`,
					});
					if (tokenCandidates.length > 20) break;
				}
				if (tokenCandidates.length > 20) break;
			}
			const metas = Array.from(document.querySelectorAll("meta")).map((m) => ({
				name: m.name,
				content: (m.content ?? "").slice(0, 120),
			}));
			const bodyText = document.body.innerText.slice(0, 500);
			return { inputs, forms, tokenCandidates, metas, bodyText, title: document.title };
		});

		console.log(`\n=== title: ${dump.title}`);
		console.log(`\n=== body preview:\n${dump.bodyText}`);
		console.log(`\n=== forms (${dump.forms.length}):`);
		for (const f of dump.forms) {
			console.log(`  id=${f.id} method=${f.method} action=${f.action}`);
		}
		console.log(`\n=== inputs (${dump.inputs.length}):`);
		for (const i of dump.inputs) {
			console.log(
				`  <${i.tag} name=${i.name ?? "—"} id=${i.id ?? "—"} type=${i.type ?? "—"}> ${i.hasValue ? `[len=${i.valueLen}] ${i.valuePreview}` : ""}`,
			);
		}
		console.log(`\n=== token candidates (timestamp.hex):`);
		for (const t of dump.tokenCandidates) console.log(`  ${t.source} → ${t.value}`);
		if (dump.tokenCandidates.length === 0)
			console.log("  (none found in page scripts)");
		console.log(`\n=== relevant meta:`);
		for (const m of dump.metas.filter((m) =>
			/csrf|xsrf|token|tmsid/i.test(m.name || m.content),
		))
			console.log(`  ${m.name}=${m.content}`);

		// Also dump the full HTML for offline grepping.
		const html = await page.content();
		writeFileSync("./syi-probe.html", html);
		console.log(`\n→ full HTML written to ./syi-probe.html (${html.length} bytes)`);
	} finally {
		await browser.close();
	}
}

await main();
