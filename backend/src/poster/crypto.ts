import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { CryptoError } from "./errors.js";

const ALG = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const SCRYPT_SALT = "mp-poster.v1";

function deriveKey(envKey: string): Buffer {
	if (envKey.length < 16) {
		throw new CryptoError("MP_POSTER_KEY too short (min 16 chars)");
	}
	return scryptSync(envKey, SCRYPT_SALT, KEY_LEN);
}

export function loadKeyFromEnv(): Buffer {
	const raw = process.env.MP_POSTER_KEY;
	if (!raw) throw new CryptoError("MP_POSTER_KEY env var not set");
	return deriveKey(raw);
}

export function encryptJson(value: unknown, key: Buffer): string {
	const iv = randomBytes(IV_LEN);
	const cipher = createCipheriv(ALG, key, iv);
	const plain = Buffer.from(JSON.stringify(value), "utf8");
	const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptJson<T = unknown>(blob: string, key: Buffer): T {
	const buf = Buffer.from(blob, "base64");
	if (buf.length < IV_LEN + TAG_LEN) throw new CryptoError("ciphertext too short");
	const iv = buf.subarray(0, IV_LEN);
	const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
	const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
	const decipher = createDecipheriv(ALG, key, iv);
	decipher.setAuthTag(tag);
	let plain: Buffer;
	try {
		plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	} catch (err) {
		throw new CryptoError(`decrypt failed: ${(err as Error).message}`);
	}
	return JSON.parse(plain.toString("utf8")) as T;
}
