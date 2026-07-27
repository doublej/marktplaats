import { createAd, linkAccount, listAccounts, updateAccount } from "../ops/index.js";
import { PosterError } from "../poster/index.js";
import { type Ctx, fail, num } from "./output.js";

export async function runMpLink(ctx: Ctx): Promise<void> {
	const account = await linkAccount(
		{
			label: ctx.flag("label"),
			userId: ctx.flag("user"),
			postcode: ctx.flag("postcode"),
			nickname: ctx.flag("nickname"),
			email: ctx.flag("email"),
		},
		undefined,
		(msg) => ctx.out.write(msg),
	);

	if (ctx.flags.json) {
		ctx.out.json(account);
		return;
	}
	ctx.out.write(
		`Linked mp account **${account.label}** (\`${account.id}\`) — nickname=${account.nickname ?? "—"} postcode=${account.postCode ?? "—"}`,
	);
}

export async function runMpUpdateAccount(ctx: Ctx): Promise<void> {
	const accountId = ctx.flag("account") ?? fail(ctx, "Missing: --account", "MISSING_ARG");

	const updated = updateAccount({
		accountId,
		userId: ctx.flag("user"),
		label: ctx.flag("label"),
		nickname: ctx.flag("nickname"),
		email: ctx.flag("email"),
		postcode: ctx.flag("postcode"),
	});

	if (ctx.flags.json) {
		ctx.out.json(updated);
		return;
	}
	ctx.out.write(
		`Updated **${updated.label}** (\`${updated.id}\`) — nickname=${updated.nickname ?? "—"} postcode=${updated.postCode ?? "—"} email=${updated.email ?? "—"}`,
	);
}

export async function runMpAccounts(ctx: Ctx): Promise<void> {
	const result = listAccounts({ userId: ctx.flag("user") });

	if (ctx.flags.json) {
		ctx.out.json(result);
		return;
	}

	ctx.out.heading(`MP accounts — ${result.count}`, 1);
	if (result.count === 0) {
		ctx.out.write("No accounts. Link with `mp:link`.");
		return;
	}
	ctx.out.table(
		["ID", "Label", "Nickname", "Postcode", "Linked"],
		result.accounts.map((a) => [
			a.id.slice(0, 8),
			a.label,
			a.nickname ?? "—",
			a.postCode ?? "—",
			a.linkedAt.slice(0, 10),
		]),
	);
}

export async function runMpCreateAd(ctx: Ctx): Promise<void> {
	const accountId = ctx.flag("account") ?? fail(ctx, "Missing: --account", "MISSING_ARG");
	const title = ctx.flag("title") ?? fail(ctx, "Missing: --title", "MISSING_ARG");
	const description = ctx.flag("description") ?? fail(ctx, "Missing: --description", "MISSING_ARG");
	const l1CategoryId = ctx.flag("l1") ?? fail(ctx, "Missing: --l1", "MISSING_ARG");
	const l2CategoryId = ctx.flag("l2") ?? fail(ctx, "Missing: --l2", "MISSING_ARG");
	const l2CategoryFullName = ctx.flag("l2-name") ?? fail(ctx, "Missing: --l2-name", "MISSING_ARG");

	try {
		const created = await createAd({
			accountId,
			userId: ctx.flag("user"),
			title,
			description,
			priceCents: num(ctx.flag("price")) ?? null,
			l1CategoryId,
			l2CategoryId,
			l2CategoryFullName,
			bucketId: ctx.flag("bucket"),
			deliveryMethod: ctx.flag("delivery") as
				| "Ophalen"
				| "Verzenden"
				| "OphalenOfVerzenden"
				| undefined,
		});

		if (ctx.flags.json) {
			ctx.out.json(created);
			return;
		}
		ctx.out.write(`Created ad \`${created.adId}\` — ${created.url}`);
	} catch (err) {
		if (err instanceof PosterError) {
			fail(ctx, `${err.code ?? "POSTER_ERROR"}: ${err.message}`, err.code ?? "POSTER_ERROR");
		}
		throw err;
	}
}
