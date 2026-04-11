/**
 * Text sanitization and cleaning utilities
 */

const HTML_ENTITIES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#x27;",
};

/**
 * Escape HTML special characters (XSS protection)
 */
export function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * Normalize whitespace: collapse multiple spaces, trim
 */
export function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

/**
 * Normalize whitespace but preserve line breaks
 * Collapses horizontal whitespace (spaces/tabs) but keeps newlines
 */
export function normalizePreservingNewlines(text: string): string {
	return text
		.split(/\n/)
		.map((line) => line.replace(/[\t ]+/g, " ").trim())
		.filter((line) => line.length > 0)
		.join("\n");
}

/**
 * Clean text: normalize whitespace + escape HTML
 */
export function cleanText(text: string): string {
	return escapeHtml(normalizeWhitespace(text));
}

/**
 * Clean title: remove trailing prices, "details" suffix, standalone numbers
 */
export function cleanTitle(title: string): string {
	let cleaned = normalizeWhitespace(title);

	// Remove trailing price patterns
	cleaned = cleaned.replace(/€\s*[\d.,]+\s*$/i, "");
	cleaned = cleaned.replace(/\d+\s*euro\s*$/i, "");

	// Remove "details" suffix
	cleaned = cleaned.replace(/\s*details?\s*$/i, "");

	// Remove trailing standalone numbers
	cleaned = cleaned.replace(/\s+\d+\s*$/, "");

	return cleaned.trim();
}

/**
 * Clean description: remove price mentions, metadata, section markers, enforce min length
 */
export function cleanDescription(description: string, minLength = 10): string | null {
	let cleaned = normalizeWhitespace(description);

	// Remove price patterns
	cleaned = cleaned.replace(/€\s*[\d.,]+/gi, "");
	cleaned = cleaned.replace(/\d+\s*euro/gi, "");

	// Remove common metadata patterns
	cleaned = cleaned.replace(/\d+\s*keer\s*bekeken/gi, "");
	cleaned = cleaned.replace(/\d+\s*reacties?/gi, "");

	// Remove spec-like patterns (128GB, 256GB, 64GB, etc.) - do this first
	cleaned = cleaned.replace(/\d+\s*[GMKT]B/gi, "");

	// Remove section markers that get concatenated (with or without word boundaries)
	cleaned = cleaned.replace(/details?/gi, "");
	cleaned = cleaned.replace(/kenmerken/gi, "");
	cleaned = cleaned.replace(/\bbieden\b/gi, "");
	cleaned = cleaned.replace(/\bconditie\b/gi, "");
	cleaned = cleaned.replace(/\bverzenden\b/gi, "");
	cleaned = cleaned.replace(/\bophalen\b/gi, "");

	// Remove standalone short words that are likely UI labels
	cleaned = cleaned.replace(/\b(nieuw|gebruikt|zo goed als nieuw)\b/gi, "");

	// Collapse multiple spaces after removals
	cleaned = cleaned.replace(/\s+/g, " ").trim();

	return cleaned.length >= minLength ? cleaned : null;
}

/**
 * Extract location from Dutch location patterns
 */
export function extractLocation(text: string): string | null {
	// Common patterns: "Amsterdam, Noord-Holland" or "1012 AB Amsterdam"
	const patterns = [
		/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s*(?:[A-Z][a-z-]+)?/,
		/\d{4}\s*[A-Z]{2}\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
	];

	for (const pattern of patterns) {
		const match = pattern.exec(text);
		if (match?.[1]) {
			return match[1].trim();
		}
	}

	return null;
}

/**
 * Dutch month names for date parsing
 */
export const DUTCH_MONTHS: Record<string, number> = {
	jan: 0,
	januari: 0,
	feb: 1,
	februari: 1,
	mrt: 2,
	maart: 2,
	apr: 3,
	april: 3,
	mei: 4,
	jun: 5,
	juni: 5,
	jul: 6,
	juli: 6,
	aug: 7,
	augustus: 7,
	sep: 8,
	sept: 8,
	september: 8,
	okt: 9,
	oktober: 9,
	nov: 10,
	november: 10,
	dec: 11,
	december: 11,
};

/**
 * Parse Dutch relative dates (vandaag, gisteren, X dagen/weken geleden)
 */
export function parseRelativeDate(text: string): Date | null {
	const lower = text.toLowerCase().trim();
	const now = new Date();

	if (lower === "vandaag" || lower === "today") {
		return now;
	}

	if (lower === "gisteren" || lower === "yesterday") {
		return new Date(now.getTime() - 24 * 60 * 60 * 1000);
	}

	// X dagen/weken/maanden geleden
	const agoMatch = /(\d+)\s*(dag|dagen|week|weken|maand|maanden)\s*geleden/i.exec(lower);
	if (agoMatch) {
		const amount = Number.parseInt(agoMatch[1] ?? "0", 10);
		const unit = agoMatch[2]?.toLowerCase() ?? "";
		const result = new Date(now);

		if (unit === "dag" || unit === "dagen") {
			result.setDate(result.getDate() - amount);
		} else if (unit === "week" || unit === "weken") {
			result.setDate(result.getDate() - amount * 7);
		} else if (unit === "maand" || unit === "maanden") {
			result.setMonth(result.getMonth() - amount);
		}

		return result;
	}

	return null;
}

/**
 * Parse Dutch date string (e.g., "15 jan 2024", "15 januari")
 */
export function parseDutchDate(text: string): Date | null {
	// Try relative date first
	const relative = parseRelativeDate(text);
	if (relative) return relative;

	const lower = text.toLowerCase().trim();

	// Pattern: "15 jan 2024" or "15 januari 2024"
	const fullMatch = /(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})/i.exec(lower);
	if (fullMatch) {
		const day = Number.parseInt(fullMatch[1] ?? "1", 10);
		const monthName = fullMatch[2]?.toLowerCase() ?? "";
		const year = Number.parseInt(fullMatch[3] ?? "2024", 10);
		const month = DUTCH_MONTHS[monthName];

		if (month !== undefined) {
			return new Date(year, month, day);
		}
	}

	// Pattern: "15 jan" (current year)
	const shortMatch = /(\d{1,2})\s+([a-z]+)\.?/i.exec(lower);
	if (shortMatch) {
		const day = Number.parseInt(shortMatch[1] ?? "1", 10);
		const monthName = shortMatch[2]?.toLowerCase() ?? "";
		const month = DUTCH_MONTHS[monthName];

		if (month !== undefined) {
			return new Date(new Date().getFullYear(), month, day);
		}
	}

	return null;
}
