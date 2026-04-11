# marktplaats-js Frontend Integration Guide

## Quick Start

```ts
import { search, fetchListingDetail } from "marktplaats-js";

// Search for listings
const listings = await search({ query: "iphone 15" });

// Get full details for a listing
const detail = await fetchListingDetail(listings[0].url);
```

## Search API

### Basic Search

```ts
const listings = await search({
  query: "macbook pro",
  limit: 20,  // default: 10
});
```

### Filtered Search

```ts
const listings = await search({
  query: "fiets",
  categorySlug: "fietsen-en-brommers",  // filter by category
  zipCode: "1012AB",      // Dutch postal code
  distance: 10,           // km radius
  priceFromCents: 5000,   // €50 in cents
  priceToCents: 50000,    // €500 in cents
  page: 1,                // pagination (1-indexed)
  sortBy: "price",        // "price" | "date"
  sortOrder: "asc",       // "asc" | "desc"
  timeout: 15000,         // ms, default: 30000
});
```

### ListingItem Shape

```ts
interface ListingItem {
  sourceListingId: string;    // "m1234567890"
  title: string;
  price: string;              // "€ 500" or "Bieden" (display string)
  priceCents: number | null;  // 50000 = €500 (in cents!) or null
  url: string;
  descriptionSnippet: string | null;
  imageUrl: string | null;
  location: string | null;
  seller: string | null;
  views: number | null;
  condition: string | null;
  datePosted: Date | null;
  status: "active" | "sold" | "reserved" | "expired" | null;
}
```

## Detail API

### Fetch Full Listing

```ts
// By URL (preferred - always works)
const detail = await fetchListingDetail(listing.url);

// By ID (may fail if redirect doesn't work)
const detail = await fetchListingDetail("m1234567890");
```

### ListingDetail Shape

```ts
interface ListingDetail {
  id: string;
  title: string;
  description: string;        // Full description
  price: string;              // Display string
  priceCents: number | null;  // In cents (50000 = €500)
  url: string;
  images: string[];           // All image URLs
  location: string | null;
  seller: {
    name: string | null;
    id: string | null;
    memberSince: string | null;
    responseTime: string | null;
  };
  attributes: Record<string, string>;  // {"Merk": "Apple", ...}
  views: number | null;
  favorites: number | null;
  condition: string | null;
  datePosted: Date | null;
  category: string | null;
  breadcrumbs: string[];
}
```

## Price Handling

**All prices are in cents** to avoid floating-point issues.
- Filters: `priceFromCents`, `priceToCents`
- Results: `priceCents`

```ts
// Convert cents to euros for display
const euros = listing.priceCents ? listing.priceCents / 100 : null;

// Or use the utility
import { centsToEuros, formatEuros } from "marktplaats-js";

const euros = centsToEuros(listing.priceCents);  // 500
const display = formatEuros(euros);               // "€ 500"
```

### Special Prices

| `price` value | `priceCents` | Meaning |
|---------------|----------------|---------|
| `"€ 500"` | `50000` | Fixed price |
| `"€ 0"` | `0` | Free (gratis) |
| `"Bieden"` | `null` | Make an offer |
| `"Price on request"` | `null` | Contact seller |

## Error Handling

```ts
import { search, ScrapingError, RateLimitError } from "marktplaats-js";

try {
  const listings = await search({ query: "test" });
} catch (e) {
  if (e instanceof RateLimitError) {
    // Wait and retry
    console.log("Rate limited, retry after:", e.retryAfter);
  } else if (e instanceof ScrapingError) {
    // Blocked or parsing failed
    console.log("Scraping failed:", e.message);
  }
}
```

## Best Practices

### 1. Cache Results

Marktplaats rate-limits aggressively. Cache search results for at least 5 minutes.

```ts
const cache = new Map<string, { data: ListingItem[]; expires: number }>();

async function cachedSearch(query: string) {
  const key = query.toLowerCase();
  const cached = cache.get(key);

  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const data = await search({ query });
  cache.set(key, { data, expires: Date.now() + 5 * 60 * 1000 });
  return data;
}
```

### 2. Lazy-Load Details

Don't fetch details for all listings upfront. Fetch on user interaction.

```ts
// In your listing card component
async function onViewDetails(listing: ListingItem) {
  setLoading(true);
  const detail = await fetchListingDetail(listing.url);
  setSelectedListing(detail);
  setLoading(false);
}
```

### 3. Handle Missing Data

Many fields can be `null`. Always provide fallbacks.

```ts
// Bad
<img src={listing.imageUrl} />

// Good
<img src={listing.imageUrl ?? "/placeholder.png"} />

// Price display
{listing.priceCents
  ? `€ ${(listing.priceCents / 100).toFixed(2)}`
  : listing.price}
```

### 4. Debounce Search Input

```ts
import { useDebouncedCallback } from "use-debounce";

const debouncedSearch = useDebouncedCallback(
  (query: string) => search({ query }),
  500
);
```

### 5. Use TypeScript

All types are exported. Use them for type safety.

```ts
import type { ListingItem, ListingDetail, SearchOptions } from "marktplaats-js";

function renderListing(listing: ListingItem) {
  // Full autocomplete and type checking
}
```

## Common Patterns

### Search with Filters Component

```ts
interface FilterState {
  query: string;
  zipCode?: string;
  distance?: number;
  priceFromCents?: number;  // in cents (5000 = €50)
  priceToCents?: number;    // in cents (50000 = €500)
  sortBy?: "price" | "date";
}

async function handleSearch(filters: FilterState) {
  const listings = await search({
    ...filters,
    limit: 20,
  });
  return listings;
}
```

### Pagination

```ts
// Use page parameter for server-side pagination
const page1 = await search({ query, limit: 20, page: 1 });
const page2 = await search({ query, limit: 20, page: 2 });
```

### Image Gallery from Detail

```ts
const detail = await fetchListingDetail(url);

// detail.images is already an array of URLs
<ImageGallery images={detail.images} />
```

## Categories API

```ts
import { fetchCategories, fetchSubcategories } from "marktplaats-js";

// Get L1 categories
const categories = await fetchCategories();
// → [{ name: "Computers en Software", slug: "computers-en-software", ... }]

// Get subcategories for a category
const subs = await fetchSubcategories("computers-en-software");

// Search within a category
const laptops = await search({
  query: "thinkpad",
  categorySlug: "computers-en-software",
});
```

## Seller Listings API

```ts
import { fetchSellerListings } from "marktplaats-js";

// Get all listings from a seller (ID from listing detail)
const sellerItems = await fetchSellerListings({
  sellerId: "12345",
  limit: 30,
  page: 1,
});
```

## Rate Limits

- ~30 requests/minute
- Bursts of 5 requests allowed
- Circuit breaker opens after 5 consecutive failures

The library handles rate limiting internally, but you should still:
- Cache aggressively
- Debounce user input
- Show loading states (requests can take 2-5 seconds)
