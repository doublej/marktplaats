import { z } from "zod";

export const DeliveryMethodSchema = z.enum(["Ophalen", "Verzenden", "OphalenOfVerzenden"]);
export type DeliveryMethod = z.infer<typeof DeliveryMethodSchema>;

export const PriceTypeSchema = z.enum([
	"FIXED",
	"BIDDING_FROM",
	"FREE",
	"RESERVED",
	"SWAP",
	"SEE_DESCRIPTION",
]);
export type PriceType = z.infer<typeof PriceTypeSchema>;

export const PlaywrightCookieSchema = z.object({
	name: z.string(),
	value: z.string(),
	domain: z.string(),
	path: z.string(),
	expires: z.number(),
	httpOnly: z.boolean(),
	secure: z.boolean(),
	sameSite: z.enum(["Strict", "Lax", "None"]),
});
export type PlaywrightCookie = z.infer<typeof PlaywrightCookieSchema>;

export const StorageStateSchema = z.object({
	cookies: z.array(PlaywrightCookieSchema),
	origins: z
		.array(
			z.object({
				origin: z.string(),
				localStorage: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
			}),
		)
		.default([]),
});
export type StorageState = z.infer<typeof StorageStateSchema>;

export const MpUserProfileSchema = z.object({
	userId: z.string(),
	nickname: z.string().nullable(),
	email: z.string().nullable(),
	postCode: z.string().nullable(),
});
export type MpUserProfile = z.infer<typeof MpUserProfileSchema>;

export const CreateAdInputSchema = z.object({
	title: z.string().min(3).max(60),
	description: z.string().min(10).max(4000),
	priceCents: z.number().int().nonnegative().nullable(),
	priceType: PriceTypeSchema.default("FIXED"),
	l1CategoryId: z.string().regex(/^\d+$/),
	l2CategoryId: z.string().regex(/^\d+$/),
	bucketId: z.string().regex(/^\d+$/).optional(),
	l2CategoryFullName: z.string().min(1),
	deliveryMethod: DeliveryMethodSchema.default("Ophalen"),
	attributes: z.record(z.string(), z.string()).default({}),
	postCode: z
		.string()
		.regex(/^\d{4}\s?[A-Z]{2}$/i)
		.optional(),
	sellerName: z.string().min(1).optional(),
});
export type CreateAdInput = z.infer<typeof CreateAdInputSchema>;

export const CreatedAdSchema = z.object({
	adId: z.string(),
	url: z.string().url(),
	createdAt: z.string().datetime(),
});
export type CreatedAd = z.infer<typeof CreatedAdSchema>;

export const SyiPageTokensSchema = z.object({
	xsrfToken: z.string(),
	tmsid: z.string(),
	timestamp: z.string(),
	signature: z.string(),
	cookies: z.array(PlaywrightCookieSchema),
});
export type SyiPageTokens = z.infer<typeof SyiPageTokensSchema>;
