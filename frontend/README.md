# Marktplaats UI

SvelteKit frontend for browsing marktplaats.nl listings via the marktplaats-js scraper library.

## Stack

- **Framework**: SvelteKit 5 + Svelte 5
- **Styling**: UnoCSS
- **Backend**: marktplaats-js (via SvelteKit server routes)

## Structure

```
src/
├── routes/
│   ├── +page.svelte           # Search + results
│   ├── +layout.svelte         # App shell, dark mode
│   ├── api/                   # API endpoints
│   │   ├── search/            # Search listings
│   │   ├── listing/           # Listing details
│   │   ├── categories/        # Category list
│   │   ├── seller/            # Seller listings
│   │   └── watches/           # Watch CRUD
│   ├── listing/[id]/          # Listing detail page
│   ├── seller/[id]/           # Seller page
│   └── watches/               # Watch management
└── lib/
    ├── api/client.ts          # API client
    ├── types.ts               # Type definitions
    ├── components/            # UI components
    ├── stores/                # Svelte stores
    └── server/                # Server utilities
```

## Dev

```bash
bun install
bun run dev
```

## API Reference

See `MARKTPLAATS_API_SPEC.yaml` for scraping patterns and data models.
