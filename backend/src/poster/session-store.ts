import { decryptJson, encryptJson } from "./crypto.js";
import { type StorageState, StorageStateSchema } from "./types.js";

export function encryptStorageState(state: StorageState, key: Buffer): string {
	return encryptJson(state, key);
}

export function decryptStorageState(blob: string, key: Buffer): StorageState {
	const raw = decryptJson(blob, key);
	return StorageStateSchema.parse(raw);
}
