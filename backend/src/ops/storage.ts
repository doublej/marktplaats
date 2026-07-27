import { StorageManager } from "../server/storage.js";

/**
 * Watch/account storage location. Relative paths resolve against the process
 * cwd, so long-lived hosts (MCP servers) should set WATCH_STORAGE_PATH to an
 * absolute path.
 */
export function resolveStoragePath(): string {
	return process.env.WATCH_STORAGE_PATH ?? "./marktplaats-watches.json";
}

export function openStorage(path = resolveStoragePath()): StorageManager {
	return new StorageManager(path);
}
