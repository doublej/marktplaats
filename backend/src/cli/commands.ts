import {
	fetchCategoryTree,
	fetchListingDetail,
	fetchSellerListings,
	fetchSubcategories,
	getProviderStatus,
	search,
} from "../index.js";
import { centsToEuros, formatEuros } from "../utils/price.js";
import type { Ctx } from "./output.js";
import { fail } from "./output.js";

export async function runSearch(ctx: Ctx): Promise<void> {
	const query =
		ctx.flag("query") ?? ctx.positionals[1] ?? fail(ctx, "Missing: query", "MISSING_ARG");

	const listings = await search({
		query,
		limit: num(ctx.flag("limit")) ?? 10,
		zipCode: ctx.flag("zip"),
		distance: num(ctx.flag("distance")),
		priceFromCents: num(ctx.flag("min-price")),
		priceToCents: num(ctx.flag("max-price")),
		sortBy: ctx.flag("sort") as "price" | "date" | undefined,
		sortOrder: ctx.flag("order") as "asc" | "desc" | undefined,
		categorySlug: ctx.flag("category"),
		page: num(ctx.flag("page")),
		fuel: ctx.flag("fuel"),
		body: ctx.flag("body"),
	});

	if (ctx.flags.json) {
		ctx.out.json({ query, count: listings.length, listings });
		return;
	}

	ctx.out.heading(`Search: "${query}" — ${listings.length} results`, 1);
	ctx.out.table(
		["ID", "Price", "Title", "Location", "Status"],
		listings.map((l) => [
			l.sourceListingId,
			fmtPrice(l.priceCents, l.price),
			truncate(l.title, 80),
			l.location ?? "—",
			l.status ?? "—",
		]),
	);
}

export async function runDetail(ctx: Ctx): Promise<void> {
	const id = ctx.positionals[1] ?? fail(ctx, "Missing: listing ID", "MISSING_ARG");
	const detail = await fetchListingDetail(id);

	if (ctx.flags.json) {
		ctx.out.json(detail);
		return;
	}

	ctx.out.heading(detail.title, 1);
	ctx.out.kv("ID", detail.id);
	ctx.out.kv("Price", fmtPrice(detail.priceCents, detail.price));
	ctx.out.kv("Location", detail.location ?? "—");
	ctx.out.kv("Seller", detail.seller.name ?? "—");
	ctx.out.kv("Condition", detail.condition ?? "—");
	ctx.out.kv("Views", String(detail.views ?? "—"));
	ctx.out.kv("Favorites", String(detail.favorites ?? "—"));
	ctx.out.kv("URL", detail.url);

	if (Object.keys(detail.attributes).length > 0) {
		ctx.out.heading("Attributes");
		for (const [k, v] of Object.entries(detail.attributes)) {
			ctx.out.kv(k, v);
		}
	}

	if (detail.description) {
		ctx.out.heading("Description");
		ctx.out.write(detail.description.slice(0, 500));
	}
}

export async function runSeller(ctx: Ctx): Promise<void> {
	const sellerId = ctx.positionals[1] ?? fail(ctx, "Missing: seller ID", "MISSING_ARG");
	const limit = num(ctx.flag("limit")) ?? 30;
	const listings = await fetchSellerListings({ sellerId, limit });

	if (ctx.flags.json) {
		ctx.out.json({ sellerId, count: listings.length, listings });
		return;
	}

	ctx.out.heading(`Seller ${sellerId} — ${listings.length} listings`, 1);
	ctx.out.table(
		["ID", "Price", "Title", "Location", "Status"],
		listings.map((l) => [
			l.sourceListingId,
			fmtPrice(l.priceCents, l.price),
			truncate(l.title, 80),
			l.location ?? "—",
			l.status ?? "—",
		]),
	);
}

export async function runCategories(ctx: Ctx): Promise<void> {
	const slug = ctx.flag("slug");

	if (slug) {
		const subcats = await fetchSubcategories(slug);
		if (ctx.flags.json) {
			ctx.out.json({ parentSlug: slug, count: subcats.length, categories: subcats });
			return;
		}
		ctx.out.heading(`Subcategories: ${slug}`, 1);
		ctx.out.table(
			["Slug", "Name"],
			subcats.map((c) => [c.slug, c.name]),
		);
		return;
	}

	const tree = await fetchCategoryTree();
	if (ctx.flags.json) {
		ctx.out.json({ count: tree.categories.length, categories: tree.categories });
		return;
	}

	ctx.out.heading(`Categories — ${tree.categories.length} found`, 1);
	ctx.out.table(
		["Slug", "Name", "Subcategories"],
		tree.categories.map((c) => [c.slug, c.name, String(c.children?.length ?? 0)]),
	);
}

export async function runStatus(ctx: Ctx): Promise<void> {
	const status = getProviderStatus();

	if (ctx.flags.json) {
		ctx.out.json(status);
		return;
	}

	ctx.out.heading("Provider Status", 1);
	ctx.out.table(
		["Name", "Type", "Status", "Requests", "Failures"],
		status.providers.map((p) => [
			p.name,
			p.type,
			p.status,
			String(p.requestCount),
			String(p.consecutiveFailures),
		]),
	);
}

function num(v: string | undefined): number | undefined {
	if (v === undefined) return undefined;
	const n = Number(v);
	return Number.isNaN(n) ? undefined : n;
}

function fmtPrice(cents: number | null, fallback: string): string {
	return cents !== null ? formatEuros(centsToEuros(cents)) : fallback;
}

function truncate(s: string, max: number): string {
	return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
