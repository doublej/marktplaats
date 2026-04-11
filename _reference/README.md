# Marktplaats API Code Collection

Extracted from `/Users/jurrejan/Documents/development/python/MarktplaatsSearch/`

## Files

### Root Level
- `client.py` - HTML scraper (`MarktplaatsScraper` class) + legacy fetch functions
- `price_utils.py` - Price parsing (Dutch formats, cents conversion)
- `text_utils.py` - Text cleaning utilities

### providers/
- `base.py` - Abstract provider interface (`MarktplaatsProvider`, `SearchContext`, `ProviderResult`)
- `html_scraper.py` - HTML scraping provider (wraps client.py)
- `marktplaats_library.py` - Uses `marktplaats` PyPI package (older impl)
- `marktplaats_library_provider.py` - Uses `marktplaats` PyPI package (newer impl)
- `data_mappers.py` - Converts between marktplaats library objects and app models
- `manager.py` - Provider manager with failover, circuit breaker, health checks
- `__init__.py` - Package exports

## Key Classes

- `MarktplaatsScraper` - Direct HTML scraping from marktplaats.nl
- `MarktplaatsProvider` - Abstract base for all providers
- `HtmlScrapingProvider` - Provider using HTML scraping
- `MarktplaatsLibraryProvider` - Provider using `marktplaats` PyPI library
- `ListingProviderManager` - Manages multiple providers with failover

## Dependencies

```
httpx
beautifulsoup4
lxml
fake-useragent
pydantic
marktplaats>=0.3.1  # Optional - for library provider
```
