import {
	decryptStorageState,
	isSessionValid,
	loadKeyFromEnv,
} from "../src/poster/index.js";
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
console.log(`→ verify session for ${label} (id=${account.id.slice(0, 8)})`);
const ok = await isSessionValid(state);
console.log(ok ? "✅ session valid" : "❌ session invalid");
process.exit(ok ? 0 : 1);
