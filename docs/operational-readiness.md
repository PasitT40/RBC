# Operational Readiness

Project: Camera Marketplace Backoffice Phase 1

## Dashboard rebuild procedure

When cached dashboard aggregates are suspected to be stale:

1. Read all non-deleted `products`.
2. Recompute:
   - `total_products`
   - `active_products`
   - `reserved_products`
   - `sold_products`
   - `visible_products`
3. Read all `orders where status == "CONFIRMED"`.
4. Recompute:
   - `total_sales_count`
   - `total_sales_amount`
   - `total_cost_amount`
   - `total_profit_amount`
5. Group confirmed orders by `brand_id`.
6. Rebuild `dashboard_brand_stats/{brandId}` from those grouped totals.
7. Overwrite `dashboard_stats/global` and `dashboard_brand_stats/*` in one controlled admin operation.
8. Re-run [`scripts/verify-phase1.cjs`](../scripts/verify-phase1.cjs) to confirm no mismatches remain.

Recommended implementation:
- keep rebuild as an admin-only script using `firebase-admin`
- do not run rebuild from untrusted client code

## Toolchain note

The local environment previously showed an npm cache ownership issue during typecheck:
- `yarn -s nuxi typecheck` attempted to install `vue-tsc` through npm/npx
- the command failed because files under `~/.npm` were not writable by the current user

Operational workaround:
- run commands with a temporary writable cache, for example `env npm_config_cache=/tmp/npm-cache ...`

Permanent fix:
- repair ownership of the local npm cache on the workstation before relying on npx-backed commands

## Environment variables and targets

Development:
- use `.env.development`
- current Firestore database id: `ratchaburi-camera-dev`
- service account path is resolved from project root

Production:
- use `.env.production`
- set production Firebase project values explicitly
- set `FIRESTORE_DATABASE_ID` to the intended production database id
- keep `SERVICE_ACCOUNT_KEY_FILE` outside version control

Recommended deployment checks:
- Firestore indexes deployed
- Firestore rules deployed
- Storage rules deployed
- owner allowlist exists in the database used by backoffice auth checks
- Storage write authorization is verified against the same effective owner source

## Verification scripts

Useful scripts added during Phase 1:
- [`scripts/seed-final.cjs`](../scripts/seed-final.cjs): seed the dev database
- [`scripts/backfill-product-images.cjs`](../scripts/backfill-product-images.cjs): backfill placeholder product images for seeded data
- [`scripts/verify-phase1.cjs`](../scripts/verify-phase1.cjs): read-only invariant and counter audit
- [`scripts/verify-phase1-mutations.cjs`](../scripts/verify-phase1-mutations.cjs): live mutation verification for core business flows
- [`scripts/verify-image-flows.cjs`](../scripts/verify-image-flows.cjs): Storage-backed verification for image replacement and cleanup flows
