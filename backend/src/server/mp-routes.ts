import { z } from "zod";
import {
	CreateAdInputSchema,
	PosterError,
	StorageStateSchema,
	decryptStorageState,
	encryptStorageState,
	loadKeyFromEnv,
	submitAd,
} from "../poster/index.js";
import type { StorageManager } from "./storage.js";
import type { MpAccount } from "./types.js";

const POSTCODE_RE = /^(\d{4})\s?([A-Z]{2})$/i;
const UpdateMpAccountSchema = z.object({
	label: z.string().min(1).optional(),
	nickname: z.string().nullable().optional(),
	email: z.string().nullable().optional(),
	postCode: z
		.string()
		.regex(POSTCODE_RE)
		.transform((v) => {
			const m = POSTCODE_RE.exec(v.trim());
			return m?.[1] && m[2] ? `${m[1]} ${m[2].toUpperCase()}` : v;
		})
		.nullable()
		.optional(),
});

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function appUserFromReq(req: Request): string | null {
	return req.headers.get("x-app-user") || null;
}

function redactAccount(a: MpAccount) {
	return {
		id: a.id,
		label: a.label,
		mpUserId: a.mpUserId,
		nickname: a.nickname,
		email: a.email,
		postCode: a.postCode,
		linkedAt: a.linkedAt,
		lastUsedAt: a.lastUsedAt,
	};
}

export async function handleListMpAccounts(
	req: Request,
	storage: StorageManager,
): Promise<Response> {
	const appUser = appUserFromReq(req);
	if (!appUser) return json({ error: "missing x-app-user header" }, 401);
	return json(storage.getMpAccounts(appUser).map(redactAccount));
}

export async function handleCreateMpAccount(
	req: Request,
	storage: StorageManager,
): Promise<Response> {
	const appUser = appUserFromReq(req);
	if (!appUser) return json({ error: "missing x-app-user header" }, 401);
	const body = (await req.json()) as Record<string, unknown>;
	const stateParsed = StorageStateSchema.safeParse(body.storageState);
	if (!stateParsed.success) return json({ error: stateParsed.error.message }, 400);
	const label = typeof body.label === "string" ? body.label : "default";
	const profile = body.profile as
		| {
				userId?: string;
				nickname?: string | null;
				email?: string | null;
				postCode?: string | null;
		  }
		| undefined;
	if (!profile?.userId) return json({ error: "profile.userId required" }, 400);
	const key = loadKeyFromEnv();
	const encryptedStorageState = encryptStorageState(stateParsed.data, key);
	const account: MpAccount = {
		id: crypto.randomUUID(),
		appUserId: appUser,
		label,
		mpUserId: profile.userId,
		nickname: profile.nickname ?? null,
		email: profile.email ?? null,
		postCode: profile.postCode ?? null,
		encryptedStorageState,
		linkedAt: new Date().toISOString(),
		lastUsedAt: null,
	};
	storage.addMpAccount(account);
	return json(redactAccount(account), 201);
}

export async function handleUpdateMpAccount(
	req: Request,
	id: string,
	storage: StorageManager,
): Promise<Response> {
	const appUser = appUserFromReq(req);
	if (!appUser) return json({ error: "missing x-app-user header" }, 401);
	const existing = storage.getMpAccount(id, appUser);
	if (!existing) return json({ error: "not found" }, 404);
	const body = (await req.json()) as Record<string, unknown>;
	const parsed = UpdateMpAccountSchema.safeParse(body);
	if (!parsed.success) return json({ error: parsed.error.message }, 400);
	const updates: Partial<MpAccount> = {};
	if (parsed.data.label !== undefined) updates.label = parsed.data.label;
	if (parsed.data.nickname !== undefined) updates.nickname = parsed.data.nickname;
	if (parsed.data.email !== undefined) updates.email = parsed.data.email;
	if (parsed.data.postCode !== undefined) updates.postCode = parsed.data.postCode;
	if (Object.keys(updates).length === 0) return json({ error: "no fields to update" }, 400);
	const updated = storage.updateMpAccount(id, updates);
	if (!updated) return json({ error: "update failed" }, 500);
	return json(redactAccount(updated));
}

export async function handleDeleteMpAccount(
	req: Request,
	id: string,
	storage: StorageManager,
): Promise<Response> {
	const appUser = appUserFromReq(req);
	if (!appUser) return json({ error: "missing x-app-user header" }, 401);
	if (!storage.deleteMpAccount(id, appUser)) return json({ error: "not found" }, 404);
	return json({ deleted: true });
}

export async function handleCreateAd(req: Request, storage: StorageManager): Promise<Response> {
	const appUser = appUserFromReq(req);
	if (!appUser) return json({ error: "missing x-app-user header" }, 401);
	const body = (await req.json()) as Record<string, unknown>;
	const accountId = body.accountId;
	if (typeof accountId !== "string") return json({ error: "accountId required" }, 400);
	const account = storage.getMpAccount(accountId, appUser);
	if (!account) return json({ error: "account not found" }, 404);
	const inputParsed = CreateAdInputSchema.safeParse(body.input);
	if (!inputParsed.success) return json({ error: inputParsed.error.message }, 400);
	const key = loadKeyFromEnv();
	const state = decryptStorageState(account.encryptedStorageState, key);
	try {
		const created = await submitAd({
			state,
			input: inputParsed.data,
			profile: { postCode: account.postCode, nickname: account.nickname },
			onStateUpdate: (next) => {
				storage.updateMpAccount(account.id, {
					encryptedStorageState: encryptStorageState(next, key),
					lastUsedAt: new Date().toISOString(),
				});
			},
		});
		return json(created, 201);
	} catch (err) {
		if (err instanceof PosterError) {
			return json({ error: err.message, code: err.code }, 400);
		}
		throw err;
	}
}
