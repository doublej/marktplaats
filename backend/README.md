# marktplaats-js

TypeScript scraper library for [marktplaats.nl](https://www.marktplaats.nl), plus a watch/notification server, a CLI, and an MCP server. Runtime: Bun.

## Install (workspace-local)

```json
{ "dependencies": { "marktplaats-js": "file:../backend" } }
```

## Library Usage

```ts
import { search, fetchListingDetail, fetchCategories } from "marktplaats-js";

const listings = await search({ query: "iphone 15", limit: 20 });
const detail   = await fetchListingDetail(listings[0].url);
const cats     = await fetchCategories();
```

### Search options

```ts
search({
  query: "macbook pro",
  categorySlug: "computers-en-software",
  zipCode: "1012AB",
  distance: 10,            // km
  priceFromCents: 5000,    // €50
  priceToCents: 50000,     // €500
  page: 1,
  sortBy: "price",         // "price" | "date"
  sortOrder: "asc",        // "asc" | "desc"
  limit: 20,
  timeout: 15000,
});
```

### Prices are always in cents

Filters (`priceFromCents`, `priceToCents`) and results (`priceCents`) are integer cents to avoid float drift. Display string is kept in `price`. Use `centsToEuros` / `formatEuros` for rendering.

| `price` | `priceCents` | Meaning |
|---|---|---|
| `"€ 500"` | `50000` | Fixed |
| `"€ 0"` | `0` | Free |
| `"Bieden"` | `null` | Make offer |

### Errors

```ts
import { search, RateLimitError, ScrapingError } from "marktplaats-js";

try { await search({ query: "x" }); }
catch (e) {
  if (e instanceof RateLimitError) { /* e.retryAfter */ }
  if (e instanceof ScrapingError)  { /* blocked or parse failed */ }
}
```

## Architecture

### Provider pattern
`MarktplaatsProvider` (providers/base.ts) is the abstract base with circuit breaker + rate limiting. `ProviderManager` tries providers in order with failover. Only `HtmlScraperProvider` exists today; the layer is there so a future API provider can slot in.

### Data flow
```
search(opts) → ProviderManager → HtmlScraperProvider
                                       ↓
                          scraper.ts (cheerio) → ListingItem[] (zod-validated)
```

Other entry points: `fetchSellerListings`, `fetchListingDetail`, `fetchCategories`, `fetchSubcategories`.

### Rate limits
Marktplaats allows ~30 req/min with bursts of 5. Circuit breaker opens after 5 consecutive failures. Callers should still cache aggressively and debounce.

## Server

The `/server` subpath exposes a watch/notification daemon:

```ts
import { Watcher, Scheduler, StorageManager, Notifier } from "marktplaats-js/server";
```

Run the HTTP API:

```bash
bun run server       # one-shot
bun run server:dev   # watch mode
```

Modules:
- `api.ts` — HTTP routes
- `watcher.ts` — runs a saved search, diffs results
- `scheduler.ts` — interval runner
- `storage.ts` — JSON file persistence
- `notifier.ts` — notification sink
- `openapi.ts` — spec for the server's own API

## CLI

```bash
bun run cli -- prime                    # project overview (default command)
bun run cli -- search "iphone" --limit 5
bun run cli -- watches
```

Every command takes `--json` for machine-readable output. `--quiet`, `--no-color`
and `--no-progress` are also accepted.

## MCP server

The same commands are exposed as MCP tools over stdio, so an agent can drive the
scraper without shelling out.

```bash
bun run mcp        # stdio server
bun run mcp:dev    # watch mode
```

Register it with a client (Claude Code shown):

```bash
claude mcp add marktplaats -- bun /abs/path/to/backend/src/mcp/index.ts
```

```json
{
  "mcpServers": {
    "marktplaats": {
      "command": "bun",
      "args": ["/abs/path/to/backend/src/mcp/index.ts"],
      "env": {
        "WATCH_STORAGE_PATH": "/abs/path/to/backend/marktplaats-watches.json",
        "MP_SESSION_KEY": "<32-byte base64 key>"
      }
    }
  }
}
```

`WATCH_STORAGE_PATH` should be **absolute** — an MCP client's working directory
is not the project root, so the CLI's relative default would resolve elsewhere and
the server would see an empty store. `MP_SESSION_KEY` is only needed for the
`mp_*` tools.

### Tools

One tool per CLI command. Call `prime` first — it returns provider health, the
resolved storage path, existing watches and accounts, and the tool catalogue.

| Tool | CLI equivalent | Notes |
|---|---|---|
| `prime` | `prime` | Overview + catalogue |
| `search` | `search` | Read-only, hits the network |
| `detail` | `detail` | Read-only |
| `seller` | `seller` | Read-only |
| `categories` | `categories` | Read-only |
| `status` | `status` | Read-only, local |
| `watches` | `watches` | Read-only, local |
| `watch_create` | `watch:create` | Writes storage |
| `watch_poll` | `watch:poll` | Writes storage, hits the network |
| `watch_delete` | `watch:delete` | Destructive |
| `mp_accounts` | `mp:accounts` | Never returns the stored session |
| `mp_link` | `mp:link` | **Opens a headed browser on the host**, waits up to 5 min |
| `mp_update_account` | `mp:update-account` | Writes storage |
| `mp_create_ad` | `mp:create-ad` | **Publishes a real, public ad** |

Tool names use `_` instead of `:` because most clients restrict names to
`[a-zA-Z0-9_-]`. Results are JSON text matching the CLI's `--json` payload;
failures come back as `{ error, code }` with `isError` set rather than as a
transport error.

### Parity

CLI commands and MCP tools are thin adapters over `src/ops/` — the CLI formats
the result, the MCP server serialises it. Adding an op wires up both. A test in
`src/mcp/server.test.ts` asserts the tool list matches the command catalogue, so
the two cannot drift silently.

## Scripts

```bash
bun test                    # tests
bun run typecheck           # tsc --noEmit
bun run lint                # biome check
bun run lint:fix            # biome --fix
bun run build               # bun build → dist/
```

## Layout

```
src/
├── index.ts           # public exports
├── scraper.ts         # search + seller listings
├── detail.ts          # full listing page
├── categories.ts      # category tree
├── types.ts           # zod schemas + inferred types
├── ops/               # shared operations — the CLI and MCP both call these
├── providers/         # provider abstraction + html scraper
├── server/            # watch daemon + HTTP API
├── poster/            # ad creation via a linked account
├── cli/               # CLI adapter (formats ops results)
├── mcp/               # MCP stdio server (serialises ops results)
└── utils/             # price + text parsing (with tests)
```

Formatted with Biome — tabs, 100 char width.
