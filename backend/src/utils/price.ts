/**
 * Dutch/European price parsing utilities
 * Handles formats like: € 1.234,56 | €500 | € 99,- | gratis | vraagprijs
 */

const PRICE_PATTERNS = {
	euroSymbol: /€\s*([\d.,]+)/i,
	euroWord: /(\d[\d.,]*)\s*euro/i,
	numericOnly: /^[\d.,]+$/,
};

const SPECIAL_PRICES: Record<string, { display: string; cents: number | null }> = {
	gratis: { display: "€ 0", cents: 0 },
	free: { display: "€ 0", cents: 0 },
	vraagprijs: { display: "Price on request", cents: null },
	"op aanvraag": { display: "Price on request", cents: null },
	"n.o.t.k.": { display: "Price on request", cents: null },
	"n.o.t.k": { display: "Price on request", cents: null },
	bieden: { display: "Bieden", cents: null },
	"zie omschrijving": { display: "See description", cents: null },
};

interface ParsedPrice {
	display: string;
	cents: number | null;
}

/**
 * Parse Dutch/European price format to cents
 * Handles: 1.234,56 (thousands with dot, decimals with comma)
 */
function parseNumericPrice(priceStr: string): number | null {
	const cleaned = priceStr.replace(/[^\d.,]/g, "").trim();
	if (!cleaned) return null;

	const hasDot = cleaned.includes(".");
	const hasComma = cleaned.includes(",");

	let normalized: string;

	if (hasDot && hasComma) {
		// Both present: last separator is decimal (Dutch: 1.234,56)
		const lastDot = cleaned.lastIndexOf(".");
		const lastComma = cleaned.lastIndexOf(",");

		if (lastComma > lastDot) {
			// Comma is decimal: 1.234,56 -> 1234.56
			normalized = cleaned.replace(/\./g, "").replace(",", ".");
		} else {
			// Dot is decimal: 1,234.56 -> 1234.56
			normalized = cleaned.replace(/,/g, "");
		}
	} else if (hasComma) {
		// Only comma: check if decimal (99,99) or thousands (1,234)
		const parts = cleaned.split(",");
		const lastPart = parts[parts.length - 1];

		if (lastPart && lastPart.length === 2) {
			// Likely decimal: 99,99 -> 99.99
			normalized = cleaned.replace(",", ".");
		} else {
			// Likely thousands: 1,234 -> 1234
			normalized = cleaned.replace(/,/g, "");
		}
	} else if (hasDot) {
		// Only dot: check if decimal or thousands
		const parts = cleaned.split(".");
		const lastPart = parts[parts.length - 1];

		if (lastPart && lastPart.length === 2 && parts.length === 2) {
			// Likely decimal: 99.99
			normalized = cleaned;
		} else {
			// Likely thousands: 1.234 -> 1234
			normalized = cleaned.replace(/\./g, "");
		}
	} else {
		// No separators
		normalized = cleaned;
	}

	const parsed = Number.parseFloat(normalized);
	if (Number.isNaN(parsed)) return null;

	// Convert to cents (integer)
	return Math.round(parsed * 100);
}

/**
 * Parse a price string and return display format + cents value
 */
export function parsePrice(input: string): ParsedPrice {
	const lower = input.toLowerCase().trim();

	// Check special prices first
	for (const [key, value] of Object.entries(SPECIAL_PRICES)) {
		if (lower.includes(key)) {
			return value;
		}
	}

	// Try to extract price number
	let priceStr: string | null = null;

	// Match € symbol pattern
	const euroMatch = PRICE_PATTERNS.euroSymbol.exec(input);
	if (euroMatch?.[1]) {
		priceStr = euroMatch[1];
	}

	// Match "euro" word pattern
	if (!priceStr) {
		const wordMatch = PRICE_PATTERNS.euroWord.exec(input);
		if (wordMatch?.[1]) {
			priceStr = wordMatch[1];
		}
	}

	// Try numeric only
	if (!priceStr && PRICE_PATTERNS.numericOnly.test(input.trim())) {
		priceStr = input.trim();
	}

	if (!priceStr) {
		return { display: input, cents: null };
	}

	const cents = parseNumericPrice(priceStr);
	if (cents === null) {
		return { display: input, cents: null };
	}

	// Format display string
	const euros = cents / 100;
	const display = formatEuros(euros);

	return { display, cents };
}

/**
 * Format cents to Euro display string
 */
export function formatEuros(euros: number): string {
	return `€ ${euros.toLocaleString("nl-NL", {
		minimumFractionDigits: euros % 1 === 0 ? 0 : 2,
		maximumFractionDigits: 2,
	})}`;
}

/**
 * Convert euros to cents (integer)
 */
export function eurosToCents(euros: number): number {
	return Math.round(euros * 100);
}

/**
 * Convert cents to euros
 */
export function centsToEuros(cents: number): number {
	return cents / 100;
}
