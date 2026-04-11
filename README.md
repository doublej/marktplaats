# marktplaats

Better UI for browsing marktplaats.nl, built on a custom scraper library.

Deployed at [marktplaats.jurrejan.com](https://marktplaats.jurrejan.com).

## Structure

```
backend/      marktplaats-js — TypeScript scraper lib + HTTP server + CLI
frontend/     SvelteKit 5 UI consuming the lib
_reference/   Python reference implementation + API spec (source material)
_archive/     Dead code kept for reference (gitignored)
```

## Layout

- **backend/** is a standalone package (`marktplaats-js`). It exposes a search/detail/category API, a provider layer with failover + circuit breaker, and an HTTP server for watches + notifications.
- **frontend/** imports backend as `file:../backend`, wraps it in SvelteKit server routes, and renders the UI.
- **_reference/** is the original Python scraper this project was ported from. Includes `MARKTPLAATS_API_SPEC.yaml`, the language-agnostic description of marktplaats.nl's HTML endpoints.

## Dev

```bash
# Backend (lib)
cd backend && bun install && bun run dev

# Frontend (app)
cd frontend && bun install && bun run dev
```

See `backend/README.md` and `frontend/README.md` for details.

## Deploy

Frontend runs on a QNAP behind Caddy via pm2. Configs live in `frontend/`:
- `ecosystem.config.js` — pm2 process definition
- `marktplaats.caddy` — Caddy reverse proxy block
