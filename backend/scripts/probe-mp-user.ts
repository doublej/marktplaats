#!/usr/bin/env bun
/**
 * Dumps raw /identity/v2/api/user response for a linked mp account.
 * Usage: MP_POSTER_KEY=... bun scripts/probe-mp-user.ts <accountId>
 */
import { decryptStorageState, loadKeyFromEnv } from "../src/poster/index.js";
import { StorageManager } from "../src/server/storage.js";

const STORAGE_PATH = process.env.WATCH_STORAGE_PATH ?? "./marktplaats-watches.json";
const accountId = process.argv[2];
if (!accountId) {
	console.error("Usage: bun scripts/probe-mp-user.ts <accountId>");
	process.exit(1);
}

const storage = new StorageManager(STORAGE_PATH);
const appUser = process.env.APP_USER ?? "cli";
const account = storage.getMpAccount(accountId, appUser);
if (!account) {
	console.error(`Account not found: ${accountId}`);
	process.exit(1);
}
const key = loadKeyFromEnv();
const state = decryptStorageState(account.encryptedStorageState, key);
const cookieStr = state.cookies
	.filter((c) => c.domain.endsWith("marktplaats.nl"))
	.map((c) => `${c.name}=${c.value}`)
	.join("; ");

const endpoints = [
	"https://www.marktplaats.nl/identity/v2/api/user",
	"https://www.marktplaats.nl/identity/v2/api/user/profile",
	"https://www.marktplaats.nl/v/api/user/me",
];

for (const url of endpoints) {
	const res = await fetch(url, {
		headers: {
			Cookie: cookieStr,
			Accept: "application/json",
			"User-Agent":
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
		},
		redirect: "manual",
	});
	console.log(`\n=== ${url} ===`);
	console.log(`status: ${res.status}`);
	console.log(`location: ${res.headers.get("location") ?? "-"}`);
	const contentType = res.headers.get("content-type") ?? "";
	const text = await res.text();
	if (contentType.includes("json")) {
		try {
			console.log("body:", JSON.stringify(JSON.parse(text), null, 2).slice(0, 2000));
		} catch {
			console.log("body (raw):", text.slice(0, 800));
		}
	} else {
		console.log(`content-type: ${contentType}`);
		console.log("body (first 400 chars):", text.slice(0, 400));
	}
}
