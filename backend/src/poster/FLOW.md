# Marktplaats SYI Flow — Phase 0 Recon

Captured: 2026-04-11 via `backend/scripts/recon-mp-syi.ts`. Hand-edited with analysis.

> Source of truth for the poster module's HTTP surface. Raw capture in `flow-raw.ndjson` (gitignored).

## TL;DR — what Phase 0 proved

Walking the real SYI flow (login → category → fill → submit → delete) recorded **539 HTTP events**. The "post an ad" surface is not a simple JSON POST:

- **Auth** is guarded by **ThreatMetrix** (`faas.marktplaats.nl`) anti-bot fingerprinting.
- **Every mutating call** carries an `x-mp-xsrf` header — a per-page token embedded in the SYI HTML, not a static cookie.
- **Final submit** (`POST /plaats/ads`) is `application/x-www-form-urlencoded`, not JSON, and includes **anti-bot signature fields** (`tmsid`, `timestamp`, `signature`) alongside the form data.
- The **real minimum field set** is larger than the plan assumed. A "naked" title/desc/price/category is rejected by required-attribute validation for most categories.

**Architecture implication:** raw `fetch` replay is fragile. A Playwright-backed submit is the only robust MVP. See [§6 Architecture pivot](#6-architecture-pivot) below.

---

## 1. Authentication

### Login endpoint

```
POST https://www.marktplaats.nl/identity/v2/api/login
Content-Type: application/json
X-Mp-Xsrf: <timestamp>.<sha256-hex>
```

Body (redacted):
```json
{
  "email": "<user email>",
  "password": "<user password>",
  "rememberMe": true,
  "threatMetrix": {
    "timestamp": 1775932xxxxxx,
    "signature": "<base64>",
    "uuid": "e65264dc-2556-41a3-b460-291d1b157fe6",
    "domain": "https://faas.marktplaats.nl",
    "pageID": 14
  }
}
```

**The `threatMetrix` object is computed by JavaScript loaded from `faas.marktplaats.nl`** during page load (fingerprint script at `/fp/check.js` + friends). It is not reproducible from raw HTTP without evaluating that script.

Response:
```
200 {}
```
Success signal = session cookies set via `Set-Cookie` (see next section).

### Session cookies (post-login)

Critical cookies (all `Lax`, `marktplaats.nl`):

| Cookie              | HttpOnly | Secure | Purpose                    |
|---------------------|----------|--------|----------------------------|
| `MpSession`         | yes      |        | Primary session identifier |
| `MpSecurity`        | yes      | yes    | Session security binding   |
| `MpSslSecurity`     | yes      | yes    | SSL session binding        |
| `luckynumber`       | yes      |        | Session nonce              |
| `__mpx`             |          |        | User/session correlator    |
| `persistentRandomID`|          |        | Long-lived device ID       |
| `aws-waf-token`     |          | yes    | AWS WAF bot check token    |

All need to travel with every authenticated request. `aws-waf-token` is WAF — missing it can cause 403s from the edge.

### Implication for the plan's "supervised browser login"

The plan said: open Chromium via claude-in-chrome, let user log in, extract `document.cookie`. That **will not work** for `MpSession`/`MpSecurity`/`MpSslSecurity`/`luckynumber` — all httpOnly. Must use Playwright `context.cookies()` (as the recon script does) to capture them.

---

## 2. XSRF token

Every mutating endpoint requires one of:
- `x-mp-xsrf` header (JSON POSTs)
- `xsrf.token=...` form field (the SYI submit POST)

Format: `<epoch-ms>.<64-hex>`, e.g.

```
1775932277102.5d0b5283e11ef8e039a1cba68a848af276eec88dc4ebbdad6643b8ca8cb839db
```

- A **new token per SYI page load** (5 distinct values observed across 5 navigations).
- Not stored in a cookie named `XSRF-TOKEN`.
- **Embedded in the SYI HTML page** (`GET /plaats/<L1>/<L2>?...`) — the token must be scraped from each fresh page load. Exact selector TBD (parse a `<meta>` / embedded `__NEXT_DATA__` — recon only stored first 4 KB of HTML responses so the anchor isn't in `flow-raw.ndjson`).

---

## 3. SYI navigation + data dependencies

Flow order (mutating endpoints in **bold**):

```
GET  /link/placead/start                               -> 302 /plaats
GET  /plaats                                           -> category picker
GET  /plaats/api/v1/category-aggregate                 -> category tree
GET  /plaats/<L1>/<L2>?bucketId=&title=<draft>         -> SYI form HTML (contains fresh xsrf.token + tmsid seed)
POST /plaats/api/v1/attribute-suggestions              -> [] (category-specific required attrs)
POST /plaats/api/v1/price-suggestion                   -> price hints
POST /plaats/api/image/upload                          -> uploaded image UUIDs (optional for MVP)
POST /plaats/ads                                       -> 302 /payments/orderOverview?orderId=<n>
GET  /payments/orderOverview/index.html?orderId=<n>    -> 302 /seller/view/m<adId>
GET  /seller/view/m<adId>                              -> final landing page
```

`<L1>` and `<L2>` are **numeric** category IDs (e.g. 504/518 for "Huis en Inrichting" / "Kasten | Kledingkasten"). The existing category tree scraper (`backend/src/categories.ts`) already fetches these — confirm the numeric IDs match what `/plaats/<L1>/<L2>` expects.

---

## 4. Final submit — `POST /plaats/ads`

```
POST https://www.marktplaats.nl/plaats/ads
Content-Type: application/x-www-form-urlencoded
Referer: https://www.marktplaats.nl/plaats/<L1>/<L2>?bucketId=<B>&title=<t>
Origin:  https://www.marktplaats.nl
Cookie: MpSession=...; MpSecurity=...; MpSslSecurity=...; luckynumber=...; __mpx=...; ...
```

### Body (observed — actually submitted a real ad)

```
images.ids          = <uuid from /plaats/api/image/upload>    # repeatable; one empty trailer observed
images.urls         = <fullsize image url>                    # repeatable alongside images.ids
title_nl-NL         = ikea kast
description_nl-NL   = beschrijving
url                 =                                         # external link (empty for MVP)
singleSelectAttribute[condition] = Gebruikt                   # REQUIRED (category-dependent)
singleSelectAttribute[height]    = 150 tot 200 cm             # REQUIRED
singleSelectAttribute[width]     = 150 tot 200 cm             # REQUIRED
singleSelectAttribute[depth]     = 75 cm of meer              # REQUIRED
textAttribute[style]             = style                      # optional
buyNowAllowed       = off
Dropdown-prijstype  = FIXED
price.value         = 100,00                                  # Dutch comma decimal
price.typeValue     = FIXED
previousPriceType   =
price.biddingEnabled= off
deliveryMethod      = Ophalen                                 # REQUIRED
contactInformation.sellerName    = Jurre
contactInformation.phoneNumberSwitch = false
syi-address-radio-home           = syi-address-nl
address-index-filter             = syi-address-nl
contactInformation.postCode      = 3522RA                     # REQUIRED
features.FREE       = true
selectedBundle      = FREE
xsrf.token          = <timestamp>.<hex>                       # from SYI HTML
l1                  = 504                                     # numeric category L1
bucket              = 135
l2                  = 518                                     # numeric category L2
l2CategoryFullName  = Kasten | Kledingkasten
tmsid               = 313e66e5-8ae9-4ad0-a162-e1f00d9ef6bf    # anti-bot seed (from SYI HTML or js-init?)
timestamp           = 1775932...
signature           = vge8aD7fUXUVS1zNTN1Bz+z4el8=            # short base64 HMAC-ish
```

### Response

```
302 Location: /payments/orderOverview/index.html?previousAction=freeAdPlacement&placedItemCategoryName=<url-encoded>&orderId=<orderId>
```

Following two redirects lands on `/seller/view/m<adId>`. **Extracting the adId requires following 2 redirects** and parsing the final URL (`m\d+`).

### What's actually minimum vs. what the plan assumed

The plan asserted the MVP field set is `{title, description, priceCents, categoryId}`. Recon proves that's insufficient. Actual minimum per-ad:

| Field                                    | Required | Note                                          |
|------------------------------------------|----------|-----------------------------------------------|
| `l1`, `l2`                               | yes      | Numeric, not slug                             |
| `bucket`                                 | yes      | Category bucket id — from category page       |
| `l2CategoryFullName`                     | yes      | Display string                                |
| `title_nl-NL`                            | yes      |                                               |
| `description_nl-NL`                      | yes      |                                               |
| `price.value`, `price.typeValue`         | yes      | Dutch formatting                              |
| `deliveryMethod`                         | yes      | `Ophalen` / `Verzenden` / `OphalenOfVerzenden`|
| `contactInformation.postCode`            | yes      | Per-user data, PII                            |
| `contactInformation.sellerName`          | yes      | Per-user data                                 |
| `features.FREE`, `selectedBundle=FREE`   | yes      | Free listing bundle                           |
| `singleSelectAttribute[...]`             | maybe    | Category-dependent required attrs             |
| `xsrf.token`                             | yes      | Per-page HTML                                 |
| `tmsid`, `timestamp`, `signature`        | yes      | Anti-bot — unknown derivation                 |
| `images.ids[]`                           | no       | Optional for MVP (deferred in plan)           |

The category-dependent `singleSelectAttribute[...]` fields are returned by `POST /plaats/api/v1/attribute-suggestions` — we'd need to call it first and pass through whatever it mandates, per category.

---

## 5. Anti-bot surface

### ThreatMetrix fingerprinting

- Host: `faas.marktplaats.nl`
- Observed endpoints: `/fp/tags.js`, `/fp/check.js`, `/fp/clear.png`, `/fp/ls_fp.html`, `/fp/top_fp.html`, `/fp/es.js`
- Used at login (`threatMetrix` JSON object) and at SYI submit (`tmsid`/`timestamp`/`signature` form fields).
- **Cannot be reproduced by raw HTTP** — the signature is computed client-side by TM's obfuscated JS.

### AWS WAF

- `aws-waf-token` cookie on `www.marktplaats.nl`.
- Missing/stale token -> 403 from the edge.

### Implication

Any programmatic submit must either:
1. Keep a real browser context alive (Playwright) and let the ThreatMetrix JS compute the tokens, OR
2. Forward the existing ThreatMetrix state captured in the original page load, hoping the server doesn't validate freshness/binding.

Option 1 is robust. Option 2 is "maybe works for a while, breaks silently when MP rotates anything."

---

## 6. Architecture pivot

The plan's stated library API was:

```ts
export async function submitAd(session: Session, input: CreateAdInput): Promise<CreatedAd>
```

…implemented via raw `fetch` against the XHR endpoints. Given §5, **that will not work in practice for submit**. Recommended pivot:

### Option A — Playwright-backed submit (recommended)

- `Session` stores the Playwright `storageState()` dump (cookies + localStorage + IndexedDB keys).
- `submitAd()` launches Playwright, applies `storageState`, navigates to `/plaats/<L1>/<L2>`, fills the DOM form, clicks submit, waits for `/seller/view/m*`.
- Anti-bot tokens computed by the real browser. No replay required.
- Server host needs Chromium — `bunx playwright install chromium` in deploy.
- Higher memory footprint (~200 MB per concurrent submit). MVP: serialise submits per account.

### Option B — Hybrid (risky)

- Use Playwright only to fetch a fresh SYI page per submit, then POST the form via `fetch` using scraped xsrf + tmsid + timestamp + signature.
- Requires reverse-engineering where `tmsid`/`signature` come from in the HTML. Possibly from a ThreatMetrix JS call at page load — harder than it sounds.
- Not recommended for MVP.

### Option C — Raw fetch only

- Not feasible without running ThreatMetrix JS somewhere. **Reject.**

### Impact on the plan

If **A**, the following parts of the plan change:

- `poster/auth.ts` removed (login is browser-interactive, we never POST /login ourselves).
- `poster/session-store.ts` stores encrypted `storageState` JSON (not just cookies).
- `poster/create-ad.ts` drives a Playwright page, not a fetch.
- Backend deployment gets a Chromium dependency.
- `isSessionValid()` = launch Playwright headless, navigate to `/mijn-marktplaats/`, check for redirect to login.
- Rate limit: 1 submit / 30 s per account (same) + global concurrency cap of 2–3 browser contexts.

Image uploads (deferred) would also ride the same browser page via file input.

---

## 7. Open questions for implementation phase

1. Where exactly is `xsrf.token` in the /plaats/<L1>/<L2> HTML? (Probably a `__NEXT_DATA__` field or hidden `<input>`.) Playwright can read it from the DOM without parsing.
2. `tmsid` — generated client-side at page load? Stable per session or per page?
3. `signature` — is it computed once per session or per submit? (Per-submit would mean we can't cache anything.)
4. What does the server return on invalid session — 401, 302 to /login, or a 200 with an error flag?
5. Free-bundle gating — is `features.FREE=true&selectedBundle=FREE` always valid, or does the user's account have a free-post quota?
6. Category-required `singleSelectAttribute[...]` — can we query them ahead of time (`/plaats/api/v1/attribute-suggestions`) and validate the caller's input server-side?
7. Postcode + seller name come from account profile — can we read them from `/identity/v2/api/user` instead of asking the user per submit?

---

## 8. Next steps

- **Gate:** this file documents the flow at a level sufficient to design the poster module. Phase 0 is done.
- Pivot decision (Option A / B / C) owed to user before any code in `backend/src/poster/` is written.
- Once decided, design:
  - `SessionStorageState` zod schema
  - `CreateAdInput` schema (expanded — include postcode, delivery method, category-specific attrs)
  - `submitAd` implementation sketch
