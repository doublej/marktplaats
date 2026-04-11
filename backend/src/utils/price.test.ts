import { describe, expect, test } from "bun:test";
import { centsToEuros, eurosToCents, formatEuros, parsePrice } from "./price";

describe("parsePrice", () => {
	test("parses € symbol with integer", () => {
		const result = parsePrice("€ 500");
		expect(result.cents).toBe(50000);
		expect(result.display).toBe("€ 500");
	});

	test("parses € symbol with decimals (Dutch format)", () => {
		const result = parsePrice("€ 99,99");
		expect(result.cents).toBe(9999);
	});

	test("parses Dutch thousands format", () => {
		const result = parsePrice("€ 1.234,56");
		expect(result.cents).toBe(123456);
	});

	test("handles 'gratis' as free", () => {
		const result = parsePrice("gratis");
		expect(result.cents).toBe(0);
		expect(result.display).toBe("€ 0");
	});

	test("handles 'vraagprijs'", () => {
		const result = parsePrice("vraagprijs");
		expect(result.cents).toBeNull();
		expect(result.display).toBe("Price on request");
	});

	test("handles 'bieden'", () => {
		const result = parsePrice("bieden");
		expect(result.cents).toBeNull();
		expect(result.display).toBe("Bieden");
	});

	test("parses 'euro' word format", () => {
		const result = parsePrice("500 euro");
		expect(result.cents).toBe(50000);
	});

	test("handles thousands with comma (US format fallback)", () => {
		const result = parsePrice("€ 1,234");
		expect(result.cents).toBe(123400);
	});
});

describe("formatEuros", () => {
	test("formats whole euros", () => {
		expect(formatEuros(500)).toBe("€ 500");
	});

	test("formats euros with cents", () => {
		expect(formatEuros(99.99)).toBe("€ 99,99");
	});

	test("formats thousands", () => {
		expect(formatEuros(1234.56)).toBe("€ 1.234,56");
	});
});

describe("eurosToCents", () => {
	test("converts whole euros", () => {
		expect(eurosToCents(100)).toBe(10000);
	});

	test("converts euros with cents", () => {
		expect(eurosToCents(99.99)).toBe(9999);
	});

	test("rounds correctly", () => {
		expect(eurosToCents(10.999)).toBe(1100);
	});
});

describe("centsToEuros", () => {
	test("converts cents to euros", () => {
		expect(centsToEuros(10000)).toBe(100);
	});

	test("preserves decimal precision", () => {
		expect(centsToEuros(9999)).toBe(99.99);
	});
});
