import { TokenExtractionError } from "./errors.js";
import {
	type StorageState,
	StorageStateSchema,
	type SyiPageTokens,
	SyiPageTokensSchema,
} from "./types.js";

export interface UploadedImage {
	id: string;
	url: string;
}

interface PrepareResult {
	tokens: SyiPageTokens;
	images: UploadedImage[];
	nextStorageState: StorageState;
}

export async function prepareSyi(
	state: StorageState,
	l1: string,
	l2: string,
	opts: { bucketId?: string; title: string; imagePaths?: string[] },
): Promise<PrepareResult> {
	const playwright = await import("playwright");
	const browser = await playwright.chromium.launch({ headless: true });
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
		const params = new URLSearchParams();
		if (opts.bucketId) params.set("bucketId", opts.bucketId);
		params.set("title", opts.title);
		const url = `https://www.marktplaats.nl/plaats/${l1}/${l2}?${params.toString()}`;
		const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
		if (!resp || !resp.ok()) {
			throw new TokenExtractionError(`SYI page returned ${resp?.status()}`);
		}
		try {
			await page.waitForFunction(
				() => {
					const el = document.querySelector<HTMLInputElement>('input[name="xsrf.token"]');
					return !!el && !!el.value;
				},
				{ timeout: 20_000 },
			);
		} catch {
			throw new TokenExtractionError("xsrf.token input never populated (form did not hydrate)");
		}

		const images: UploadedImage[] = [];
		if (opts.imagePaths?.length) {
			for (const [i, path] of opts.imagePaths.entries()) {
				const waitForUpload = page.waitForResponse(
					(r) => r.url().includes("/plaats/api/image/upload") && r.request().method() === "POST",
					{ timeout: 45_000 },
				);
				await page.setInputFiles("#imageUploader-hiddenInput", path);
				const res = await waitForUpload;
				if (res.status() !== 200) {
					throw new TokenExtractionError(`image upload #${i + 1} failed: status=${res.status()}`);
				}
				const body = (await res.json()) as {
					id?: string;
					valid?: boolean;
					imageUrl?: string;
					largeImageUrl?: string;
				};
				if (!body.valid || !body.id || !body.largeImageUrl) {
					throw new TokenExtractionError(
						`image upload #${i + 1} rejected: ${JSON.stringify(body).slice(0, 200)}`,
					);
				}
				images.push({ id: body.id, url: body.largeImageUrl });
				// Small pause so the SPA can settle before the next file is attached.
				await page.waitForTimeout(300);
			}
		}

		const raw = await page.evaluate(() => {
			const byName = (name: string) => {
				const el = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
				return el?.value ?? null;
			};
			return {
				xsrfToken: byName("xsrf.token"),
				tmsid: byName("tmsid"),
				timestamp: byName("timestamp"),
				signature: byName("signature"),
			};
		});
		if (!raw.xsrfToken || !raw.tmsid || !raw.timestamp || !raw.signature) {
			throw new TokenExtractionError(
				`missing tokens: ${Object.entries(raw)
					.filter(([, v]) => !v)
					.map(([k]) => k)
					.join(",")}`,
			);
		}
		const nextState = StorageStateSchema.parse(await ctx.storageState());
		const tokens = SyiPageTokensSchema.parse({
			xsrfToken: raw.xsrfToken,
			tmsid: raw.tmsid,
			timestamp: raw.timestamp,
			signature: raw.signature,
			cookies: nextState.cookies,
		});
		return { tokens, images, nextStorageState: nextState };
	} finally {
		await browser.close();
	}
}

// Backward-compat: simpler wrapper that doesn't upload images.
export async function extractSyiTokens(
	state: StorageState,
	l1: string,
	l2: string,
	opts: { bucketId?: string; title: string },
): Promise<{ tokens: SyiPageTokens; nextStorageState: StorageState }> {
	const { tokens, nextStorageState } = await prepareSyi(state, l1, l2, opts);
	return { tokens, nextStorageState };
}
