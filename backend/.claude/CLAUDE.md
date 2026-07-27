# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun test                      # Run all tests
bun test src/utils/price.test.ts  # Run single test file
bun run typecheck             # Type check (tsc --noEmit)
bun run lint                  # Lint with Biome
bun run lint:fix              # Auto-fix lint issues
bun run build                 # Build to dist/
```

## Architecture

### Provider Pattern
The core abstraction is `MarktplaatsProvider` (providers/base.ts):
- Abstract base with circuit breaker + rate limiting built-in
- `ProviderManager` (providers/manager.ts) tries providers in order with failover
- Currently only `HtmlScraperProvider`; designed for multiple provider backends

### Data Flow
```
search(options) → ProviderManager.fetchListings()
                      ↓
              HtmlScraperProvider.search()
                      ↓
              scraper.ts: fetchListings() → cheerio HTML parsing
                      ↓
              ListingItem[] (validated via Zod schema)

Other entry points:
- fetchSellerListings(sellerId) → seller page scraping
- fetchCategories() / fetchSubcategories() → category tree
- fetchListingDetail(id) → full listing page scrape
```

### Price Handling
- All prices stored as **integer cents** to avoid float precision issues
- Dutch locale: comma = decimal, dot = thousands (€ 1.234,56 = 123456 cents)
- Use `parsePrice()` for input, `formatEuros()` for display

### Type System
- `types.ts`: Zod schemas + inferred TypeScript types
- `ListingItem` (search results) vs `ListingDetail` (full page scrape)
- `ListingStatus`: "active" | "sold" | "reserved" | "expired"
- Custom errors: `MarktplaatsError`, `RateLimitError`, `ScrapingError`

### Key Modules
- `scraper.ts`: search + seller listings
- `detail.ts`: full listing page scrape
- `categories.ts`: category tree fetching
- `providers/`: provider abstraction layer
- `ops/`: shared operation layer — see below
- `cli/`, `mcp/`: adapters over `ops/`

### Ops Layer (CLI ↔ MCP parity)
`src/ops/` holds every operation as a plain async function over zod-validated
input. `src/cli/` formats those results as markdown/JSON; `src/mcp/` serialises
them as MCP tool results. Neither adapter contains business logic.

When adding or changing a command:
1. Put the logic and its input shape in `src/ops/`.
2. Add the entry to `COMMANDS` in `src/ops/overview.ts` (`command` = CLI name,
   `tool` = MCP name — MCP names use `_` since clients restrict them to
   `[a-zA-Z0-9_-]`).
3. Wire the CLI handler in `src/cli/index.ts` and the tool in `src/mcp/tools.ts`.

`src/mcp/server.test.ts` fails if the tool list and `COMMANDS` diverge.

Ops signal failure by throwing `OpsError` (never `process.exit`) so they can run
inside the long-lived MCP server. Both adapters render it as `{ error, code }`.

## Formatting
- Biome with tabs, 100 char line width
- `bunx @biomejs/biome check --fix src/` to auto-format
