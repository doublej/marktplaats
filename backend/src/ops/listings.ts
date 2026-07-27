import { z } from "zod";
import type { Category, CategoryTree } from "../categories.js";
import {
	fetchCategoryTree,
	fetchListingDetail,
	fetchSellerListings,
	fetchSubcategories,
	getProviderStatus,
	search,
} from "../index.js";
import type { ListingDetail, ListingItem } from "../types.js";

export const searchInputShape = {
	query: z.string().min(1).describe("Search terms, e.g. 'macbook pro 14'"),
	limit: z.number().int().positive().max(100).optional().describe("Max results (default 10)"),
	zipCode: z.string().optional().describe("Dutch postcode to search around, e.g. '1012AB'"),
	distance: z.number().int().positive().optional().describe("Radius in km around zipCode"),
	priceFromCents: z
		.number()
		.int()
		.nonnegative()
		.optional()
		.describe("Min price in CENTS (€50 = 5000)"),
	priceToCents: z
		.number()
		.int()
		.nonnegative()
		.optional()
		.describe("Max price in CENTS (€500 = 50000)"),
	sortBy: z.enum(["price", "date"]).optional().describe("Sort field"),
	sortOrder: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
	categorySlug: z.string().optional().describe("Restrict to a category slug (see categories)"),
	page: z.number().int().positive().optional().describe("Result page, 1-based"),
	fuel: z.string().optional().describe("Cars only: Benzine | Diesel | Hybride | Elektrisch | LPG"),
	body: z
		.string()
		.optional()
		.describe("Cars only: Stationwagon | Hatchback | SUV | MPV | Sedan | Cabriolet"),
} as const;

export const SearchInputSchema = z.object(searchInputShape);
export type SearchInput = z.infer<typeof SearchInputSchema>;

export interface SearchResult {
	query: string;
	count: number;
	listings: ListingItem[];
}

export async function searchListings(input: SearchInput): Promise<SearchResult> {
	const { query, limit, ...rest } = SearchInputSchema.parse(input);
	const listings = await search({ query, limit: limit ?? 10, ...rest });
	return { query, count: listings.length, listings };
}

export const detailInputShape = {
	id: z.string().min(1).describe("Listing ID (e.g. 'm2312345678') or full listing URL"),
} as const;

export const DetailInputSchema = z.object(detailInputShape);
export type DetailInput = z.infer<typeof DetailInputSchema>;

export async function getListingDetail(input: DetailInput): Promise<ListingDetail> {
	const { id } = DetailInputSchema.parse(input);
	return fetchListingDetail(id);
}

export const sellerInputShape = {
	sellerId: z.string().min(1).describe("Seller ID from a listing's seller field"),
	limit: z.number().int().positive().max(200).optional().describe("Max listings (default 30)"),
} as const;

export const SellerInputSchema = z.object(sellerInputShape);
export type SellerInput = z.infer<typeof SellerInputSchema>;

export interface SellerResult {
	sellerId: string;
	count: number;
	listings: ListingItem[];
}

export async function getSellerListings(input: SellerInput): Promise<SellerResult> {
	const { sellerId, limit } = SellerInputSchema.parse(input);
	const listings = await fetchSellerListings({ sellerId, limit: limit ?? 30 });
	return { sellerId, count: listings.length, listings };
}

export const categoriesInputShape = {
	slug: z.string().optional().describe("Parent category slug — omit for the full top-level tree"),
} as const;

export const CategoriesInputSchema = z.object(categoriesInputShape);
export type CategoriesInput = z.infer<typeof CategoriesInputSchema>;

export type CategoriesResult =
	| { parentSlug: string; count: number; categories: Category[] }
	| { count: number; categories: CategoryTree["categories"] };

export async function getCategories(input: CategoriesInput = {}): Promise<CategoriesResult> {
	const { slug } = CategoriesInputSchema.parse(input);
	if (slug) {
		const categories = await fetchSubcategories(slug);
		return { parentSlug: slug, count: categories.length, categories };
	}
	const tree = await fetchCategoryTree();
	return { count: tree.categories.length, categories: tree.categories };
}

export function getStatus(): ReturnType<typeof getProviderStatus> {
	return getProviderStatus();
}
