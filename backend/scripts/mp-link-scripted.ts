/**
 * Scripted (non-interactive) variant of `mp:link`.
 *
 * Logs in with credentials supplied via env vars, captures storageState,
 * encrypts + persists as an MpAccount. One shot, verbose, no ad creation.
 *
 *   MP_LOGIN_EMAIL=... MP_LOGIN_PASSWORD=... \
 *     bun run scripts/mp-link-scripted.ts --label default
 *
 * Flags:
 *   --label <str>    account label (default: "default")
 *   --user <str>     appUserId (default: "cli")
 *   --headed         launch headed browser (default: headed, use --headless to disable)
 *   --headless       launch headless
 *   --replace        if a previous account with same label exists, delete first
 */

import { randomUUID } from "node:crypto";
import {
	StorageStateSchema,
	encryptStorageState,
	loadKeyFromEnv,
} from "../src/poster/index.js";
import { StorageManager } from "../src/server/storage.js";
import type { MpAccount } from "../src/server/types.js";

const POSTCODE_RE = /^(\d{4})\s?([A-Z]{2})$/i;
function normalizePostcode(raw: string): string {
	const m = POSTCODE_RE.exec(raw.trim());
	if (!m) throw new Error(`invalid postcode (expected NNNN XX): ${raw}`);
	return `${m[1]} ${m[2].toUpperCase()}`;
}

const STORAGE_PATH = process.env.WATCH_STORAGE_PATH ?? "./marktplaats-watches.json";
const LOGIN_URL = "https://www.marktplaats.nl/identity/v2/login";
const HOME_URL = "https://www.marktplaats.nl/";

function flag(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	if (i === -1) return undefined;
	const next = process.argv[i + 1];
	return next && !next.startsWith("--") ? next : "";
}

function hasFlag(name: string): boolean {
	return process.argv.includes(`--${name}`);
}

async function main() {
	const email = process.env.MP_LOGIN_EMAIL;
	const password = process.env.MP_LOGIN_PASSWORD;
	if (!email || !password) {
		console.error("ERROR: set MP_LOGIN_EMAIL and MP_LOGIN_PASSWORD");
		process.exit(2);
	}
	const label = flag("label") || "default";
	const appUser = flag("user") || "cli";
	const headless = hasFlag("headless");
	const replace = hasFlag("replace");
	const postcodeArg = flag("postcode");
	const nicknameArg = flag("nickname");
	const postCode = postcodeArg ? normalizePostcode(postcodeArg) : null;

	const key = loadKeyFromEnv();
	const storage = new StorageManager(STORAGE_PATH);

	if (replace) {
		for (const existing of storage.getMpAccounts(appUser).filter((a) => a.label === label)) {
			console.log(`→ removing existing account id=${existing.id} label=${existing.label}`);
			storage.deleteMpAccount(existing.id, appUser);
		}
	}

	console.log(`→ launching chromium (headless=${headless})`);
	const playwright = await import("playwright");
	const browser = await playwright.chromium.launch({ headless });
	const ctx = await browser.newContext({
		userAgent:
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
		locale: "nl-NL",
		timezoneId: "Europe/Amsterdam",
		viewport: { width: 1280, height: 900 },
	});
	const page = await ctx.newPage();

	try {
		console.log(`→ goto ${LOGIN_URL}`);
		await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

		console.log("→ dismissing SourcePoint consent iframe if present");
		try {
			const spFrame = page.frameLocator('iframe[title="SP Consent Message"]').first();
			const acceptBtn = spFrame.locator(
				'button[title="Accepteren"], button:has-text("Accepteren"), button[title="Accept All"], button:has-text("Accept All"), button[aria-label*="Accept" i]',
			);
			await acceptBtn.first().click({ timeout: 8000 });
			console.log("   ✓ consent accepted");
			await page.waitForTimeout(500);
		} catch {
			console.log("   (no consent iframe or already accepted)");
		}

		console.log("→ waiting for email input");
		const emailInput = page
			.locator(
				'input[name="j_username"], input[name="email"], input[type="email"], input[id*="email" i]',
			)
			.first();
		await emailInput.waitFor({ state: "visible", timeout: 20000 });
		await emailInput.fill(email);

		const pwInput = page
			.locator('input[name="j_password"], input[name="password"], input[type="password"]')
			.first();
		await pwInput.waitFor({ state: "visible", timeout: 10000 });
		await pwInput.fill(password);

		console.log("→ submitting login form (Enter on password field)");
		// Tab-button "Inloggen" is a role=tab and intercepted the earlier selector;
		// pressing Enter inside the password input is the most reliable submit path.
		await pwInput.press("Enter");

		console.log("→ waiting for redirect away from /identity/v2/login");
		await page.waitForURL((url) => !/identity\/v2\/login/.test(url.toString()), {
			timeout: 60_000,
		});
		console.log(`   ✓ now at ${page.url()}`);

		console.log(`→ goto ${HOME_URL} (ensure home cookies set)`);
		await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });

		const rawState = await ctx.storageState();
		const state = StorageStateSchema.parse({
			cookies: rawState.cookies,
			origins: rawState.origins,
		});

		const mpSession = state.cookies.find((c) => c.name === "MpSession");
		const mpSec = state.cookies.find((c) => c.name === "MpSecurity");
		if (!mpSession || !mpSec) {
			console.error("ERROR: MpSession/MpSecurity cookies missing — login likely failed");
			console.error(
				"   cookies captured: " + state.cookies.map((c) => c.name).join(", "),
			);
			process.exitCode = 3;
			return;
		}
		console.log(
			`   ✓ captured session cookies (MpSession len=${mpSession.value.length}, MpSecurity len=${mpSec.value.length})`,
		);

		const account: MpAccount = {
			id: randomUUID(),
			appUserId: appUser,
			label,
			mpUserId: "",
			nickname: nicknameArg ?? null,
			email: email,
			postCode,
			encryptedStorageState: encryptStorageState(state, key),
			linkedAt: new Date().toISOString(),
			lastUsedAt: null,
		};
		storage.addMpAccount(account);
		console.log(`✅ linked account id=${account.id} label=${account.label}`);
	} finally {
		await browser.close();
	}
}

await main();
