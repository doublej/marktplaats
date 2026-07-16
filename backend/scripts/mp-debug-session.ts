import { decryptStorageState, loadKeyFromEnv } from "../src/poster/index.js";
import { StorageManager } from "../src/server/storage.js";

const STORAGE_PATH = process.env.WATCH_STORAGE_PATH ?? "./marktplaats-watches.json";
const label = process.argv[2] ?? "default";
const appUser = process.argv[3] ?? "cli";

const storage = new StorageManager(STORAGE_PATH);
const account = storage.getMpAccounts(appUser).find((a) => a.label === label);
if (!account) {
	console.error(`no account with label=${label}`);
	process.exit(2);
}
const key = loadKeyFromEnv();
const state = decryptStorageState(account.encryptedStorageState, key);

console.log(`\n=== cookies (${state.cookies.length}) ===`);
for (const c of state.cookies) {
	console.log(
		`  ${c.name.padEnd(28)} domain=${c.domain.padEnd(28)} len=${c.value.length} httpOnly=${c.httpOnly} secure=${c.secure}`,
	);
}

const cookieStr = state.cookies
	.filter((c) => c.domain.endsWith("marktplaats.nl"))
	.map((c) => `${c.name}=${c.value}`)
	.join("; ");

console.log(`\ncookie header length: ${cookieStr.length} bytes`);

console.log("\n=== GET /mijn-marktplaats/ ===");
const r1 = await fetch("https://www.marktplaats.nl/mijn-marktplaats/", {
	headers: {
		Cookie: cookieStr,
		"User-Agent":
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
		Accept: "text/html",
	},
	redirect: "manual",
});
console.log(`status=${r1.status} location=${r1.headers.get("location") ?? "-"}`);

console.log("\n=== GET /identity/v2/api/user ===");
const r2 = await fetch("https://www.marktplaats.nl/identity/v2/api/user", {
	headers: {
		Cookie: cookieStr,
		"User-Agent":
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
		Accept: "application/json",
	},
	redirect: "manual",
});
console.log(`status=${r2.status}`);
if (r2.status === 200) {
	const body = await r2.text();
	console.log(`body: ${body.slice(0, 400)}`);
}
