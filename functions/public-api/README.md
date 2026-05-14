# Public API Scaffold

This package scaffolds the Phase 8 public catalog read API described in [`docs/phase8-public-api-contract.md`](../../docs/phase8-public-api-contract.md).

## Scope

Included:

- Firebase Functions v2 HTTP entrypoint
- route dispatch for the Phase 8 read endpoints
- centralized public visibility rules
- category and brand resolution helpers
- response serializers for public-safe payloads
- cursor pagination helpers
- CORS/preflight handling for public read clients
- launch cache headers matching the Phase 8 contract

Not included yet:

- production secret/config setup
- integration tests
- runtime-specific cache invalidation

## Runtime model

This package now exports separate Functions v2 HTTP entrypoints per environment:

- `publicApi`
  - legacy stable alias for production
  - used by the current Firebase Hosting rewrite on `/api/**`
- `publicApiProd`
  - pinned to Firestore database `ratchaburi-camera-prod`
- `publicApiDev`
  - pinned to Firestore database `ratchaburi-camera-dev`

The database binding is explicit in code and no longer depends on a single shared
runtime `FIRESTORE_DATABASE_ID` value during deploy.

## Expected runtime env

- `FUNCTION_REGION`
  - optional
  - defaults to `asia-southeast1`

## Endpoints scaffolded

- `GET /api/health`
- `GET /api/products`
- `GET /api/products/:slug`
- `GET /api/categories`
- `GET /api/categories/:categorySlug`
- `GET /api/categories/:categorySlug/brands`
- `GET /api/categories/:categorySlug/:brandSlug/products`

All read endpoints also allow `HEAD` and `OPTIONS`.

Price filters default to `sell_price_asc` when no sort is provided. If a client
explicitly requests `sort=updated_at_desc` together with `minPrice` or
`maxPrice`, the API returns `400` because Firestore requires price-range queries
to order by `sell_price`.
