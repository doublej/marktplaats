import { SessionExpiredError, SubmitRejectedError } from "./errors.js";
import { type UploadedImage, prepareSyi } from "./token-extractor.js";
import {
	type CreateAdInput,
	CreateAdInputSchema,
	type CreatedAd,
	CreatedAdSchema,
	type MpUserProfile,
	type StorageState,
	type SyiPageTokens,
} from "./types.js";

const SUBMIT_URL = "https://www.marktplaats.nl/plaats/ads";

function priceToDutch(cents: number | null): string {
	if (cents === null) return "";
	const whole = Math.floor(cents / 100);
	const frac = cents % 100;
	return `${whole},${frac.toString().padStart(2, "0")}`;
}

function cookieHeader(cookies: SyiPageTokens["cookies"]): string {
	return cookies
		.filter((c) => c.domain.endsWith("marktplaats.nl"))
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");
}

function buildFormBody(
	input: CreateAdInput,
	tokens: SyiPageTokens,
	profile: Pick<MpUserProfile, "postCode" | "nickname">,
	images: UploadedImage[],
): URLSearchParams {
	const body = new URLSearchParams();
	if (images.length === 0) {
		body.append("images.ids", "");
		body.append("images.urls", "");
	} else {
		for (const img of images) {
			body.append("images.ids", img.id);
			body.append("images.urls", img.url);
		}
	}
	body.set("title_nl-NL", input.title);
	body.set("description_nl-NL", input.description);
	body.set("url", "");
	for (const [k, v] of Object.entries(input.attributes)) {
		body.set(`singleSelectAttribute[${k}]`, v);
	}
	body.set("buyNowAllowed", "off");
	body.set("Dropdown-prijstype", input.priceType);
	body.set("price.value", priceToDutch(input.priceCents));
	body.set("price.typeValue", input.priceType);
	body.set("previousPriceType", "");
	body.set("price.biddingEnabled", "off");
	body.set("deliveryMethod", input.deliveryMethod);
	const sellerName = input.sellerName ?? profile.nickname ?? "";
	body.set("contactInformation.sellerName", sellerName);
	body.set("contactInformation.phoneNumberSwitch", "false");
	body.set("syi-address-radio-home", "syi-address-nl");
	body.set("address-index-filter", "syi-address-nl");
	const postCode = input.postCode ?? profile.postCode ?? "";
	body.set("contactInformation.postCode", postCode);
	body.set("features.FREE", "true");
	body.set("selectedBundle", "FREE");
	body.set("xsrf.token", tokens.xsrfToken);
	body.set("l1", input.l1CategoryId);
	if (input.bucketId) body.set("bucket", input.bucketId);
	body.set("l2", input.l2CategoryId);
	body.set("l2CategoryFullName", input.l2CategoryFullName);
	body.set("tmsid", tokens.tmsid);
	body.set("timestamp", tokens.timestamp);
	body.set("signature", tokens.signature);
	return body;
}

async function followAdIdRedirect(location: string, cookieStr: string): Promise<string> {
	let url = location.startsWith("http") ? location : `https://www.marktplaats.nl${location}`;
	for (let hops = 0; hops < 4; hops++) {
		const match = url.match(/\/seller\/view\/m(\d+)/);
		if (match?.[1]) return match[1];
		const res = await fetch(url, {
			method: "GET",
			headers: { Cookie: cookieStr },
			redirect: "manual",
		});
		const next = res.headers.get("location");
		if (!next) {
			throw new SubmitRejectedError(`redirect chain ended at ${url} without adId`);
		}
		url = next.startsWith("http") ? next : `https://www.marktplaats.nl${next}`;
	}
	throw new SubmitRejectedError("redirect chain exceeded 4 hops");
}

export interface SubmitAdOptions {
	state: StorageState;
	input: CreateAdInput;
	profile: Pick<MpUserProfile, "postCode" | "nickname">;
	imagePaths?: string[];
	onStateUpdate?: (next: StorageState) => void;
}

export async function submitAd(opts: SubmitAdOptions): Promise<CreatedAd> {
	const input = CreateAdInputSchema.parse(opts.input);
	const { tokens, images, nextStorageState } = await prepareSyi(
		opts.state,
		input.l1CategoryId,
		input.l2CategoryId,
		{ bucketId: input.bucketId, title: input.title, imagePaths: opts.imagePaths },
	);
	if (opts.onStateUpdate) opts.onStateUpdate(nextStorageState);
	const cookieStr = cookieHeader(tokens.cookies);
	const body = buildFormBody(input, tokens, opts.profile, images);
	const referer = `https://www.marktplaats.nl/plaats/${input.l1CategoryId}/${input.l2CategoryId}?${
		input.bucketId ? `bucketId=${input.bucketId}&` : ""
	}title=${encodeURIComponent(input.title)}`;
	const res = await fetch(SUBMIT_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Cookie: cookieStr,
			Referer: referer,
			Origin: "https://www.marktplaats.nl",
			"x-mp-xsrf": tokens.xsrfToken,
			"User-Agent":
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
		},
		body: body.toString(),
		redirect: "manual",
	});
	if (res.status === 401) throw new SessionExpiredError();
	if (res.status !== 302) {
		const text = await res.text().catch(() => "");
		throw new SubmitRejectedError(
			`unexpected status ${res.status}: ${text.slice(0, 200)}`,
			res.status,
		);
	}
	const location = res.headers.get("location");
	if (!location) throw new SubmitRejectedError("302 without Location header");
	const adId = await followAdIdRedirect(location, cookieStr);
	return CreatedAdSchema.parse({
		adId,
		url: `https://www.marktplaats.nl/v/m${adId}`,
		createdAt: new Date().toISOString(),
	});
}

export async function isSessionValid(state: StorageState): Promise<boolean> {
	const cookieStr = state.cookies
		.filter((c) => c.domain.endsWith("marktplaats.nl"))
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");
	const res = await fetch("https://www.marktplaats.nl/mijn-marktplaats/", {
		headers: { Cookie: cookieStr },
		redirect: "manual",
	});
	if (res.status === 200) return true;
	if (res.status === 302) {
		const loc = res.headers.get("location") ?? "";
		return !/login/i.test(loc);
	}
	return false;
}
