# marktplaats (frontend)

SvelteKit 5 UI for browsing marktplaats.nl. Consumes [`marktplaats-js`](../backend) via `file:../backend` for scraping, watches, and notifications.

## Stack

- **SvelteKit 5** + **Svelte 5** (runes)
- **UnoCSS** (svelte-scoped)
- **@auth/sveltekit** for auth
- **adapter-node** for deploy
- **Bun** as package manager

## Dev

```bash
bun install
bun run dev       # vite dev on :5173
bun run check     # svelte-check + tsc
bun run build     # production build → build/
bun run preview   # run built app locally
```

Copy `.env.example` → `.env` and fill in auth secrets before first run.

## Layout

```
src/
├── app.html / app.css / app.d.ts
├── auth.ts                    # @auth/sveltekit config
├── hooks.server.ts            # auth handle
├── marktplaats-js.d.ts        # ambient types for the lib
├── routes/
│   ├── +layout.svelte         # app shell, dark mode
│   ├── +page.svelte           # search + results
│   ├── api/                   # server routes
│   │   ├── search/            #   search listings
│   │   ├── listing/           #   listing detail
│   │   ├── categories/        #   category tree
│   │   ├── seller/            #   seller listings
│   │   └── watches/           #   watch CRUD
│   ├── listing/[id]/          # listing detail page
│   ├── seller/[id]/           # seller page
│   └── watches/               # watch management
└── lib/
    ├── api/client.ts          # typed fetch client
    ├── types.ts
    ├── components/
    ├── stores/
    └── server/
```

## Deploy

Runs under pm2 on a QNAP, fronted by Caddy.

- `ecosystem.config.js` — pm2 app: `build/index.js` on port 3101, origin `marktplaats.jurrejan.com`
- `marktplaats.caddy` — reverse proxy block

```bash
bun run build
pm2 start ecosystem.config.js
```

## Reference

- Backend API (marktplaats-js): [`../backend/README.md`](../backend/README.md)
- Scraping target (marktplaats.nl endpoints + selectors): [`../_reference/MARKTPLAATS_API_SPEC.yaml`](../_reference/MARKTPLAATS_API_SPEC.yaml)
