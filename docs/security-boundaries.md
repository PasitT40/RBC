# Security Boundaries

Project: Camera Marketplace Backoffice / Public Catalog

## Current access model
- Backoffice writes are owner-only.
- `owners/{uid}` is the allowlist source for backoffice access.
- Public catalog should prefer a server/API read layer rather than direct browser reads to private collections.

## Admin-only collections
- `owners`
- `orders`
- `dashboard_stats`
- `dashboard_brand_stats`
- `stats_ledger`

## Backoffice-managed collections
- `settings/site`
- `categories`
- `brands`
- `category_brands`
- `products`
- `orders`
- `dashboard_stats`
- `dashboard_brand_stats`
- `stats_ledger`

Expected write path:
- authenticated owner user -> backoffice UI -> Firestore / Storage

## Public-read posture
- Current `firestore.rules` keep the listed collections private to owners only.
- Public catalog should read through server routes or another controlled backend layer before direct public Firestore access is considered.

## Rules status
- [`firestore.rules`](../firestore.rules) restrict reads and writes to owner accounts for all backoffice collections except the owner self-read path.
- [`storage.rules`](../storage.rules) restrict writes to signed-in owners and allow public reads only for product/category/brand media paths.

## Important operational note
- The app currently uses a named Firestore database in development (`ratchaburi-camera-dev`).
- `storage.rules` owner checks reference Firestore via `firestore.exists(...)`, which is typically evaluated against the default Firestore database in Storage Rules.
- If owner allowlist documents only exist in the named database and not in the default database, Storage writes can fail even for valid owners.

Recommended production resolution:
- either keep the owner allowlist mirrored in the default Firestore database for Storage Rules checks
- or move Storage write authorization to a server/admin path
- or replace the owner-check mechanism with an auth claim based policy

Do not treat Storage Rules as production-ready until this named-database interaction is explicitly verified.
