import { PosterError } from "./errors.js";
import type { StorageState } from "./types.js";

const DELETE_URL = "https://www.marktplaats.nl/seller/api/delete-ad";

export type DeleteReason = "NO_DEAL_VIA_MP" | "SOLD" | "OTHER";

export async function deleteAd(
	state: StorageState,
	adId: string,
	reason: DeleteReason = "NO_DEAL_VIA_MP",
): Promise<void> {
	const itemId = adId.startsWith("m") ? adId : `m${adId}`;
	const cookieStr = state.cookies
		.filter((c) => c.domain.endsWith("marktplaats.nl"))
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");

	// The SPA posts a fresh xsrf token with each delete; grab one by loading
	// the seller-view page of the ad and scraping it.
	const playwright = await import("playwright");
	const browser = await playwright.chromium.launch({ headless: true });
	let xsrf: string | null = null;
	try {
		const ctx = await browser.newContext({
			storageState: {
				cookies: state.cookies,
				origins: state.origins.map((o) => ({
					origin: o.origin,
					localStorage: o.localStorage ?? [],
				})),
			},
		});
		const page = await ctx.newPage();
		await page.goto(`https://www.marktplaats.nl/seller/view/${itemId}`, {
			waitUntil: "domcontentloaded",
			timeout: 30_000,
		});
		xsrf = await page.evaluate(() => {
			const el = document.querySelector<HTMLInputElement>('input[name="xsrf.token"]');
			if (el?.value) return el.value;
			for (const s of Array.from(document.querySelectorAll("script"))) {
				const m = s.textContent?.match(/\b(\d{13}\.[a-f0-9]{64})\b/);
				if (m?.[1]) return m[1];
			}
			return null;
		});
	} finally {
		await browser.close();
	}
	if (!xsrf) throw new PosterError("could not extract xsrf for delete");

	const res = await fetch(DELETE_URL, {
		method: "DELETE",
		headers: {
			"Content-Type": "application/json",
			Cookie: cookieStr,
			"x-mp-xsrf": xsrf,
			Origin: "https://www.marktplaats.nl",
			Referer: `https://www.marktplaats.nl/seller/view/${itemId}`,
			"User-Agent":
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
		},
		body: JSON.stringify({ itemId, reason }),
	});
	if (res.status !== 200) {
		const txt = await res.text().catch(() => "");
		throw new PosterError(`delete failed ${res.status}: ${txt.slice(0, 200)}`);
	}
}
