import { describe, expect, test } from "bun:test";
import {
	cleanDescription,
	cleanTitle,
	escapeHtml,
	normalizeWhitespace,
	parseDutchDate,
	parseRelativeDate,
} from "./text";

describe("escapeHtml", () => {
	test("escapes HTML special characters", () => {
		expect(escapeHtml("<script>alert('xss')</script>")).toBe(
			"&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;",
		);
	});

	test("escapes ampersand", () => {
		expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
	});
});

describe("normalizeWhitespace", () => {
	test("collapses multiple spaces", () => {
		expect(normalizeWhitespace("hello    world")).toBe("hello world");
	});

	test("trims leading/trailing whitespace", () => {
		expect(normalizeWhitespace("  hello  ")).toBe("hello");
	});

	test("handles tabs and newlines", () => {
		expect(normalizeWhitespace("hello\n\tworld")).toBe("hello world");
	});
});

describe("cleanTitle", () => {
	test("removes trailing price", () => {
		expect(cleanTitle("iPhone 15 Pro € 1.200")).toBe("iPhone 15 Pro");
	});

	test("removes 'details' suffix", () => {
		expect(cleanTitle("iPhone 15 Pro details")).toBe("iPhone 15 Pro");
	});

	test("removes trailing numbers", () => {
		expect(cleanTitle("iPhone 15 Pro 123")).toBe("iPhone 15 Pro");
	});
});

describe("cleanDescription", () => {
	test("removes price patterns", () => {
		const result = cleanDescription("Great phone, only € 500!");
		expect(result).toBe("Great phone, only !");
	});

	test("returns null for short descriptions", () => {
		expect(cleanDescription("Short")).toBeNull();
	});

	test("removes view counts", () => {
		const result = cleanDescription("Nice item, 100 keer bekeken today");
		expect(result).not.toContain("100");
		expect(result).not.toContain("bekeken");
	});

	test("removes section markers", () => {
		const result = cleanDescription("128GBdetailsApple iPhone SE in goede staat");
		expect(result).not.toContain("128GB");
		expect(result).not.toContain("details");
		expect(result).toContain("Apple iPhone SE");
	});

	test("removes condition labels", () => {
		const result = cleanDescription("conditie nieuw Prachtige laptop te koop");
		expect(result).not.toContain("conditie");
		expect(result).not.toContain("nieuw");
		expect(result).toContain("Prachtige laptop te koop");
	});
});

describe("parseRelativeDate", () => {
	test("parses 'vandaag'", () => {
		const result = parseRelativeDate("vandaag");
		expect(result).not.toBeNull();
		const today = new Date();
		expect(result?.getDate()).toBe(today.getDate());
	});

	test("parses 'gisteren'", () => {
		const result = parseRelativeDate("gisteren");
		expect(result).not.toBeNull();
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		expect(result?.getDate()).toBe(yesterday.getDate());
	});

	test("parses 'X dagen geleden'", () => {
		const result = parseRelativeDate("5 dagen geleden");
		expect(result).not.toBeNull();
		const expected = new Date();
		expected.setDate(expected.getDate() - 5);
		expect(result?.getDate()).toBe(expected.getDate());
	});

	test("parses 'X weken geleden'", () => {
		const result = parseRelativeDate("2 weken geleden");
		expect(result).not.toBeNull();
		const now = Date.now();
		const diff = now - (result?.getTime() ?? 0);
		const daysDiff = Math.round(diff / (1000 * 60 * 60 * 24));
		expect(daysDiff).toBe(14);
	});
});

describe("parseDutchDate", () => {
	test("parses full date with year", () => {
		const result = parseDutchDate("15 januari 2024");
		expect(result).not.toBeNull();
		expect(result?.getFullYear()).toBe(2024);
		expect(result?.getMonth()).toBe(0); // January
		expect(result?.getDate()).toBe(15);
	});

	test("parses short month format", () => {
		const result = parseDutchDate("15 jan 2024");
		expect(result).not.toBeNull();
		expect(result?.getMonth()).toBe(0);
	});

	test("parses date without year (assumes current year)", () => {
		const result = parseDutchDate("15 dec");
		expect(result).not.toBeNull();
		expect(result?.getFullYear()).toBe(new Date().getFullYear());
		expect(result?.getMonth()).toBe(11); // December
	});

	test("falls back to relative date parsing", () => {
		const result = parseDutchDate("vandaag");
		expect(result).not.toBeNull();
	});
});
