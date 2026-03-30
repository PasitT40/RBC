# Operational Readiness

Project: Camera Marketplace Backoffice Phase 6

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

Admin helper:
- use [`scripts/rebuild-dashboard-aggregates.cjs`](../scripts/rebuild-dashboard-aggregates.cjs)
- preview the derived result without writes:
  - `node scripts/rebuild-dashboard-aggregates.cjs --dry-run`
- apply the rebuild:
  - `node scripts/rebuild-dashboard-aggregates.cjs`

Recommended implementation:
- keep rebuild as an admin-only script using `firebase-admin`
- do not run rebuild from untrusted client code

## Stats ledger repair procedure

When `verify-phase1` reports ledger-shape errors such as invalid `entity_type`, `entity_id`, or `operation_key`, treat that as `stats_ledger` schema drift rather than dashboard aggregate drift.

Admin helper:
- use [`scripts/repair-stats-ledger.cjs`](../scripts/repair-stats-ledger.cjs)
- preview the repair set first:
  - `node scripts/repair-stats-ledger.cjs --dry-run`
- apply the repair:
  - `node scripts/repair-stats-ledger.cjs`
- re-run the invariant audit after repair:
  - `node scripts/verify-phase1.cjs`

Repair behavior:
- derives the canonical ledger payload from existing `orders`
- backfills deterministic fields required by the Firestore contract:
  - `entity_type`
  - `entity_id`
  - `operation_key`
  - `product_id`
- preserves existing `created_at` when present
- only repairs `SALE_APPLIED_{orderId}` and `SALE_REVERTED_{orderId}` documents implied by current orders

Operational note:
- rebuilding `dashboard_stats` does not repair malformed `stats_ledger`
- run aggregate rebuild and ledger repair independently based on the verifier output

## Toolchain note

The local environment previously showed an npm cache ownership issue during typecheck:
- `yarn -s nuxi typecheck` attempted to install `vue-tsc` through npm/npx
- the command failed because files under `~/.npm` were not writable by the current user

Operational workaround:
- run commands with a temporary writable cache, for example `env npm_config_cache=/tmp/npm-cache ...`

Permanent fix:
- repair ownership of the local npm cache on the workstation before relying on npx-backed commands

## Environment variables and targets

Single environment:
- use `.env`
- set Firebase project values explicitly
- set `FIRESTORE_DATABASE_ID` to `(default)` unless a named database is intentionally required
- keep `SERVICE_ACCOUNT_KEY_FILE` outside version control
- make sure the file referenced by `SERVICE_ACCOUNT_KEY_FILE` actually exists locally before running admin scripts

Recommended deployment checks:
- Firestore indexes deployed
- Firestore rules deployed
- Storage rules deployed
- owner allowlist exists in the database used by backoffice auth checks
- Storage write authorization is verified against the same effective owner source

## Verification scripts

Core scripts:
- [`scripts/seed-final.cjs`](../scripts/seed-final.cjs): seed the dev database
- [`scripts/backfill-product-images.cjs`](../scripts/backfill-product-images.cjs): backfill placeholder product images for seeded data
- [`scripts/rebuild-dashboard-aggregates.cjs`](../scripts/rebuild-dashboard-aggregates.cjs): rebuild cached dashboard aggregates from source-of-truth documents
- [`scripts/repair-stats-ledger.cjs`](../scripts/repair-stats-ledger.cjs): repair legacy `stats_ledger` documents to the deterministic ledger contract

Verification coverage:
- [`scripts/verify-phase1.cjs`](../scripts/verify-phase1.cjs): read-only invariant and counter audit
- [`scripts/verify-phase2-mutations.cjs`](../scripts/verify-phase2-mutations.cjs): required mutation flow verification
- [`scripts/verify-phase3-guardrails.cjs`](../scripts/verify-phase3-guardrails.cjs): publishability, slug, and visibility guardrails
- [`scripts/verify-phase4-management-surface.cjs`](../scripts/verify-phase4-management-surface.cjs): backoffice management surface coverage
- [`scripts/verify-phase5-security-boundaries.cjs`](../scripts/verify-phase5-security-boundaries.cjs): owner-only access boundary and named-database caveat checks
- [`scripts/verify-phase6-operational-readiness.cjs`](../scripts/verify-phase6-operational-readiness.cjs): rebuild/index/doc readiness checks
- [`scripts/verify-image-flows.cjs`](../scripts/verify-image-flows.cjs): Storage-backed verification for image replacement and cleanup flows

## Index readiness

`firestore.indexes.json` currently covers:
- backoffice category, brand, product, and order query patterns used by this repo
- public catalog minimum listing/index combinations documented in [`docs/public-catalog.spec.md`](./public-catalog.spec.md)

Before release:
- deploy `firestore.indexes.json`
- open the backoffice and confirm no missing-index errors appear in browser console
- if public listing queries change, update both `docs/public-catalog.spec.md` and `firestore.indexes.json` together
