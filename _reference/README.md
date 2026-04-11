# _reference

Source material the TypeScript `backend/` was ported from. **Not built or run** — kept for reference when porting new features or debugging scraping behavior.

Original location: `~/Documents/development/python/MarktplaatsSearch/`

## Contents

### Scraping spec
- `MARKTPLAATS_API_SPEC.yaml` — language-agnostic description of marktplaats.nl URL patterns, query parameters, HTML selectors, and data shapes. **Start here** when porting new endpoints.

### Python implementation
- `client.py` — HTML scraper (`MarktplaatsScraper`) + legacy fetch functions
- `price_utils.py` — Dutch price parsing (comma decimal, cents conversion)
- `text_utils.py` — text cleaning utilities

### providers/
- `base.py` — abstract provider interface (`MarktplaatsProvider`, `SearchContext`, `ProviderResult`)
- `html_scraper.py` — HTML scraping provider (wraps `client.py`)
- `marktplaats_library.py` / `marktplaats_library_provider.py` — providers using the `marktplaats` PyPI package
- `data_mappers.py` — conversions between library objects and app models
- `manager.py` — provider manager with failover, circuit breaker, health checks

## Porting map

| Python | TypeScript |
|---|---|
| `client.py` | `backend/src/scraper.ts` + `backend/src/detail.ts` |
| `providers/base.py` | `backend/src/providers/base.ts` |
| `providers/html_scraper.py` | `backend/src/providers/html-scraper.ts` |
| `providers/manager.py` | `backend/src/providers/manager.ts` |
| `price_utils.py` | `backend/src/utils/price.ts` |
| `text_utils.py` | `backend/src/utils/text.ts` |
