# Security Boundaries

Project: Camera Marketplace Backoffice / Public Catalog

## Current access model
- Backoffice writes are owner-only.
- Backoffice reads are also owner-only except the owner self-read path needed to resolve allowlist status.
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
- [`storage.rules`](../storage.rules) restrict writes to users with Firebase Auth custom claim `backoffice_owner=true` and allow public reads only for product/category/brand media paths.
- [`app/middleware/auth.global.ts`](../app/middleware/auth.global.ts) and [`app/composables/useOwnerAccess.ts`](../app/composables/useOwnerAccess.ts) enforce the same `owners/{uid}` allowlist in the browser before normal backoffice navigation continues.

## Public catalog boundary
- The current backoffice should not be treated as a public-read surface.
- Public catalog reads should move through server routes or another controlled backend layer before any direct browser access is considered.
- Until that read contract exists, keep product, category, brand, order, dashboard, and ledger Firestore documents private to owners in Security Rules.

## Important operational note
- `storage.rules` do not depend on a Firestore database id anymore.
- Storage write authorization is controlled by Firebase Auth custom claim `backoffice_owner=true`.
- Firestore owner allowlist and Storage owner claim are separate controls:
  - Firestore browser access uses `owners/{uid}`
  - Storage writes use the auth claim

Operational guidance:
- after granting or revoking the storage-owner claim, force the user to refresh their auth session by signing out and signing in again
- use [`scripts/set-storage-owner-claim.cjs`](../scripts/set-storage-owner-claim.cjs) to manage the claim from a trusted admin environment
