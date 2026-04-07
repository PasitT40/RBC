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

Not included yet:

- deploy wiring in root `firebase.json`
- production secret/config setup
- integration tests
- runtime-specific cache invalidation

## Expected runtime env

- `FIRESTORE_DATABASE_ID`
  - optional
  - defaults to `(default)`
- `FUNCTION_REGION`
  - optional
  - defaults to `asia-southeast1`

## Endpoints scaffolded

- `GET /api/products`
- `GET /api/products/:slug`
- `GET /api/categories`
- `GET /api/categories/:categorySlug`
- `GET /api/categories/:categorySlug/brands`
- `GET /api/categories/:categorySlug/:brandSlug/products`
