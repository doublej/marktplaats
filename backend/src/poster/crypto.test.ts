import { describe, expect, test } from "bun:test";
import { scryptSync } from "node:crypto";
import { decryptJson, encryptJson, loadKeyFromEnv } from "./crypto.js";
import { CryptoError } from "./errors.js";

const testKey = scryptSync("test-key-test-key", "mp-poster.v1", 32);

describe("crypto", () => {
	test("roundtrips object", () => {
		const obj = { cookies: [{ name: "a", value: "b" }], meta: 42 };
		const blob = encryptJson(obj, testKey);
		const back = decryptJson(blob, testKey);
		expect(back).toEqual(obj);
	});

	test("tamper detection throws", () => {
		const blob = encryptJson({ secret: "x" }, testKey);
		const tampered = `${blob.slice(0, -4)}AAAA`;
		expect(() => decryptJson(tampered, testKey)).toThrow(CryptoError);
	});

	test("wrong key throws", () => {
		const blob = encryptJson({ secret: "x" }, testKey);
		const otherKey = scryptSync("other-key-other-k", "mp-poster.v1", 32);
		expect(() => decryptJson(blob, otherKey)).toThrow(CryptoError);
	});

	test("ciphertext is base64", () => {
		const blob = encryptJson({ a: 1 }, testKey);
		expect(blob).toMatch(/^[A-Za-z0-9+/=]+$/);
	});

	test("loadKeyFromEnv rejects missing env", () => {
		const prev = process.env.MP_POSTER_KEY;
		process.env.MP_POSTER_KEY = "";
		expect(() => loadKeyFromEnv()).toThrow(CryptoError);
		if (prev !== undefined) process.env.MP_POSTER_KEY = prev;
	});

	test("loadKeyFromEnv rejects short key", () => {
		const prev = process.env.MP_POSTER_KEY;
		process.env.MP_POSTER_KEY = "short";
		expect(() => loadKeyFromEnv()).toThrow(CryptoError);
		if (prev !== undefined) process.env.MP_POSTER_KEY = prev;
		else process.env.MP_POSTER_KEY = "";
	});
});
