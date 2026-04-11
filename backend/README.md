# marktplaats-js

TypeScript scraper library for [marktplaats.nl](https://www.marktplaats.nl), plus a watch/notification server and CLI. Runtime: Bun.

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
bun run cli -- search "iphone"
bun run cli -- prime        # warm caches
bun run cli -- watches list
```

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
├── providers/         # provider abstraction + html scraper
├── server/            # watch daemon + HTTP API
├── cli/               # commands
└── utils/             # price + text parsing (with tests)
```

Formatted with Biome — tabs, 100 char width.
