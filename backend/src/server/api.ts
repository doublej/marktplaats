import { getProviderStatus } from "../index.js";
import {
	handleCreateAd,
	handleCreateMpAccount,
	handleDeleteMpAccount,
	handleListMpAccounts,
	handleUpdateMpAccount,
} from "./mp-routes.js";
import { openApiSpec } from "./openapi.js";
import type { Scheduler } from "./scheduler.js";
import type { StorageManager } from "./storage.js";
import {
	CreateWatchSchema,
	type ServerConfig,
	UpdateWatchSchema,
	type WatchConfig,
} from "./types.js";

const swaggerHtml = `<!DOCTYPE html>
<html><head>
<title>Marktplaats Watch API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: "/openapi.json", dom_id: "#swagger-ui" });</script>
</body></html>`;

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

async function handleCreateWatch(req: Request, storage: StorageManager): Promise<Response> {
	const body = await req.json();
	const parsed = CreateWatchSchema.safeParse(body);
	if (!parsed.success) return json({ error: parsed.error.message }, 400);

	const now = new Date().toISOString();
	const watch = {
		id: crypto.randomUUID(),
		...parsed.data,
		enabled: true,
		createdAt: now,
		updatedAt: now,
	};
	storage.addWatch(watch);
	return json(watch, 201);
}

async function handleUpdateWatch(
	req: Request,
	existing: WatchConfig,
	storage: StorageManager,
): Promise<Response> {
	const body = await req.json();
	const parsed = UpdateWatchSchema.safeParse(body);
	if (!parsed.success) return json({ error: parsed.error.message }, 400);

	const updates: Partial<typeof existing> = { updatedAt: new Date().toISOString() };
	if (parsed.data.name) updates.name = parsed.data.name;
	if (parsed.data.intervalMinutes) updates.intervalMinutes = parsed.data.intervalMinutes;
	if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;
	if (parsed.data.webhookUrl !== undefined)
		updates.webhookUrl = parsed.data.webhookUrl ?? undefined;
	if (parsed.data.searchOptions)
		updates.searchOptions = { ...existing.searchOptions, ...parsed.data.searchOptions };

	return json(storage.updateWatch(existing.id, updates));
}

type RouteHandler = (
	req: Request,
	storage: StorageManager,
	scheduler: Scheduler,
) => Promise<Response> | Response;

const routes: Record<string, RouteHandler> = {
	"GET /status": () => json({ ok: true, provider: getProviderStatus() }),
	"GET /watches": (_, storage) => json(storage.getWatches()),
	"POST /watches": (req, storage) => handleCreateWatch(req, storage),
	"GET /mp-accounts": (req, storage) => handleListMpAccounts(req, storage),
	"POST /mp-accounts": (req, storage) => handleCreateMpAccount(req, storage),
	"POST /ads": (req, storage) => handleCreateAd(req, storage),
	"GET /openapi.json": () => json(openApiSpec),
	"GET /docs": () => new Response(swaggerHtml, { headers: { "Content-Type": "text/html" } }),
};

function handleWatchRoute(
	method: string,
	id: string,
	isPoll: boolean,
	req: Request,
	storage: StorageManager,
	scheduler: Scheduler,
): Promise<Response> | Response {
	const watch = storage.getWatch(id);

	if (method === "GET" && !isPoll) {
		if (!watch) return json({ error: "Watch not found" }, 404);
		return json({ watch, state: storage.getState(id) });
	}
	if (method === "DELETE" && !isPoll) {
		if (!storage.deleteWatch(id)) return json({ error: "Watch not found" }, 404);
		return json({ deleted: true });
	}
	if (!watch) return json({ error: "Watch not found" }, 404);
	if (method === "PUT" && !isPoll) return handleUpdateWatch(req, watch, storage);
	if (method === "POST" && isPoll)
		return scheduler.pollWatch(watch).then((c) => json({ polled: true, eventsCount: c }));

	return json({ error: "Not found" }, 404);
}

export function createServer(config: ServerConfig, storage: StorageManager, scheduler: Scheduler) {
	return Bun.serve({
		port: config.port,
		hostname: config.host,
		fetch: async (req) => {
			const { pathname } = new URL(req.url);
			const key = `${req.method} ${pathname}`;

			const handler = routes[key];
			if (handler) return handler(req, storage, scheduler);

			const match = /^\/watches\/([^/]+)(\/poll)?$/.exec(pathname);
			if (match?.[1])
				return handleWatchRoute(
					req.method,
					match[1],
					match[2] === "/poll",
					req,
					storage,
					scheduler,
				);

			const mpMatch = /^\/mp-accounts\/([^/]+)$/.exec(pathname);
			if (mpMatch?.[1]) {
				if (req.method === "DELETE") return handleDeleteMpAccount(req, mpMatch[1], storage);
				if (req.method === "PATCH") return handleUpdateMpAccount(req, mpMatch[1], storage);
			}

			return json({ error: "Not found" }, 404);
		},
	});
}
