# Implementation Plan

Project: Ratchaburi Camera Backoffice -> Production Backoffice -> Public Catalog

This plan restarts from Phase 1 and treats the backoffice as the source of truth that must be stabilized before public catalog rollout.

Planning constraints taken from `AGENTS.md`:
- brands stay global in `brands/{brandId}`
- category-to-brand selection uses `category_brands` only
- persisted product status is only `ACTIVE | RESERVED | SOLD`
- deleted state is derived from `is_deleted = true`
- `show = false` means hidden from frontend
- `confirmSale` and `undoSale` must use Firestore transactions
- stats idempotency must use `stats_ledger`
- dashboard docs are cached aggregates and must update on writes

## Phase 1: Domain Contract Lock

Objective:
- freeze one Firestore contract and one business lifecycle before more UI or deployment work continues

Scope:
- align code, docs, and operator expectations
- remove any remaining ambiguity around product status, deletion, visibility, and brand/category modeling

Work items:
- confirm every product lifecycle transition against the required flows:
  - `createProduct` as batch
  - `toggleShow` as batch
  - `setReserved` and `setActive` as batch
  - `confirmSale` as transaction
  - `undoSale` as transaction
- confirm that no code path persists `DELETED` into `products.status`
- confirm that all brand data comes from global `brands` and `category_brands`
- confirm dashboard documents are treated as cached aggregates, not source of truth
- align spec docs, QA docs, and inline code assumptions to the same vocabulary

Deliverables:
- updated Firestore specification
- updated implementation plan
- explicit lifecycle rules for operators and future contributors

Exit criteria:
- no unresolved mismatch between code, docs, and `AGENTS.md`
- the team can describe every required write flow without contradictory behavior

## Phase 2: Backoffice Write Flow Hardening

Objective:
- make all required write flows safe, deterministic, and compliant with Firestore rules

Scope:
- product lifecycle mutations
- sell / undo sale behavior
- aggregate updates and idempotency

Work items:
- verify `createProduct` initializes:
  - `status`
  - `show`
  - `is_sellable`
  - `is_deleted`
- verify `toggleShow` updates visibility counters correctly and rejects invalid publish cases
- verify `setReserved` only allows `ACTIVE -> RESERVED`
- verify `setActive` only allows `RESERVED -> ACTIVE`
- verify delete remains soft delete only and updates counters correctly
- verify `confirmSale` transaction:
  - reads product first
  - rejects deleted or unsellable products
  - creates order
  - updates product sold fields
  - updates `dashboard_stats`
  - updates `dashboard_brand_stats`
  - writes deterministic `stats_ledger`
- verify `undoSale` transaction:
  - reads order and product
  - cancels order
  - restores prior product status
  - rolls back cached aggregates
  - writes deterministic `stats_ledger`

Deliverables:
- compliant write flow implementation
- idempotent sale and undo sale behavior
- stable aggregate update behavior

Exit criteria:
- all required flows match the spec exactly
- repeated sale/undo requests do not corrupt product state or aggregates

## Phase 3: Data Quality And Publish Guardrails

Objective:
- prevent incomplete or invalid inventory from leaking into the frontend

Scope:
- product completeness
- slug integrity
- category-brand mapping validity
- visibility controls

Work items:
- define the minimum publishable product contract
- block or warn when `show = true` but required public fields are missing
- require valid `category_id + brand_id` mapping in `category_brands`
- prevent publish when no usable product image exists
- confirm slug creation and update policy is deterministic
- detect slug collisions before public exposure
- ensure deleted products cannot become visible again accidentally

Minimum publishable product fields:
- `name`
- `slug`
- `category_id`
- `brand_id`
- `sell_price`
- `cover_image` or at least one entry in `images`

Deliverables:
- publish guard rules in forms and write paths
- documented definition of public-ready inventory

Exit criteria:
- a product cannot become frontend-visible with broken mapping, broken slug, or missing core merchandising data

## Phase 4: Backoffice Management Surface Completion

Objective:
- ensure the backoffice can manage all required inventory and merchandising metadata without bypasses

Scope:
- product form coverage
- category and brand maintenance
- optional SEO fields
- site settings needed by frontend

Work items:
- verify create and edit product forms cover all persisted product fields that operators need
- verify category management follows global category rules
- verify brand management keeps brands global and never nests them under categories
- verify category-brand mapping is the only dropdown source for category-to-brand selection
- add or complete optional SEO fields for:
  - products
  - categories
  - brands
- verify frontend-facing settings are manageable from backoffice where intended

Deliverables:
- complete backoffice forms for production operation
- documented fallback behavior for optional SEO fields

Exit criteria:
- operators do not need ad hoc Firestore edits for normal merchandising work

## Phase 5: Security And Access Boundaries

Objective:
- make the production data boundary explicit and enforceable

Scope:
- Firestore rules
- Storage rules
- owner-only access model
- public-read strategy

Work items:
- restrict backoffice reads and writes to owner accounts
- confirm `owners/{uid}` remains the allowlist source
- keep admin-only collections private:
  - `owners`
  - `orders`
  - `dashboard_stats`
  - `dashboard_brand_stats`
  - `stats_ledger`
- confirm public catalog reads go through a controlled server/API layer
- verify Storage writes work with the chosen Firestore database setup
- document the named-database caveat if `(default)` is not used

Deliverables:
- production-ready `firestore.rules`
- production-ready `storage.rules`
- clear public/private collection posture

Exit criteria:
- owners can operate the backoffice
- public users cannot read or write private operational data

## Phase 6: Verification, Rebuild, And Operational Readiness

Objective:
- make the system supportable when data drifts, environments differ, or regressions appear

Scope:
- verification scripts
- rebuild flow for cached aggregates
- environment readiness
- release checklist

Work items:
- keep read-only invariant verification for products, orders, and counters
- keep mutation verification for required flows
- keep image-flow verification for upload, replace, and cleanup behavior
- document dashboard rebuild process for:
  - `dashboard_stats/global`
  - `dashboard_brand_stats/*`
- verify required indexes exist for backoffice and public queries
- document environment variables, deploy targets, and workstation caveats
- maintain a manual QA checklist for production smoke testing

Deliverables:
- repeatable verification scripts
- rebuild and recovery procedure
- release checklist for operators

Exit criteria:
- a release can be verified without relying on memory or manual guesswork
- aggregate drift can be diagnosed and repaired safely

## Phase 7: Production Backoffice Deployment

Objective:
- deploy the backoffice safely after Phase 1 to Phase 6 are complete

Scope:
- hosting
- indexes
- rules
- production smoke test

Work items:
- prepare `.env` and `.firebaserc`
- bind Firebase Hosting target for backoffice
- deploy Firestore indexes
- deploy Firestore and Storage rules
- deploy the generated Nuxt backoffice bundle
- smoke-test owner login and all critical flows in production

Deliverables:
- live production backoffice
- documented deployment procedure

Exit criteria:
- production backoffice is reachable, authenticated, and able to complete required flows safely

## Phase 8: Public Catalog Read Contract

Objective:
- expose only frontend-safe data through a stable backend contract

Scope:
- public read routes
- visibility enforcement
- filtering and lookup semantics
- caching strategy

Work items:
- define the server/API read layer for public catalog access
- centralize visibility rules for:
  - `show == true`
  - `is_deleted == false`
  - appropriate product status, usually `ACTIVE`
- return `404` for hidden, deleted, reserved, or sold products when required by the route contract
- define route contracts for:
  - `GET /api/products`
  - `GET /api/products/[slug]`
  - `GET /api/categories`
  - `GET /api/categories/[categorySlug]`
  - `GET /api/categories/[categorySlug]/brands`
  - `GET /api/categories/[categorySlug]/[brandSlug]/products`
- add caching and revalidation strategy

Deliverables:
- stable public read API contract
- one source of truth for frontend visibility rules

Exit criteria:
- public frontend no longer depends on raw direct reads of private operational collections

## Phase 9: Public Catalog Frontend Delivery

Objective:
- ship the public browsing experience on top of the locked read contract

Scope:
- listing pages
- detail pages
- category and brand navigation
- SEO rendering

Work items:
- build product list pages
- build product detail pages
- build category pages
- build category-plus-brand listing pages
- implement pagination, filter, and sort behavior
- render metadata and canonical URL behavior
- implement empty, error, and `404` states
- verify mobile and desktop behavior

Deliverables:
- production-capable public catalog frontend

Exit criteria:
- users can browse only valid public inventory with correct metadata and route behavior

## Phase 10: Public Catalog Hardening And Launch Readiness

Objective:
- validate that the public site is fast, correct, and leak-free before launch

Scope:
- SEO fallbacks
- performance
- cache correctness
- data exposure review

Work items:
- verify canonical URLs and SEO fallback rules
- confirm hidden or private data never appears in API responses or rendered pages
- verify image fallback handling
- validate performance of list and detail pages
- test production cache invalidation or revalidation behavior

Deliverables:
- launch checklist for the public catalog

Exit criteria:
- public catalog is safe to launch with predictable SEO and visibility behavior

## Recommended Execution Order

1. Complete Phase 1 before accepting more schema or lifecycle changes.
2. Complete Phase 2 and Phase 3 before broad production data entry.
3. Complete Phase 4 to Phase 6 before production deployment.
4. Deploy the backoffice in Phase 7.
5. Start public catalog work only after the production backoffice is stable.
6. Complete Phase 8 before building Phase 9 pages.
7. Finish Phase 10 before public launch.

## Immediate Next Focus

If work resumes from the current backoffice track, prioritize in this order:

1. Re-verify all required write flows against the locked Phase 1 contract.
2. Close any remaining gaps in transaction, idempotency, and aggregate updates.
3. Tighten publish guardrails so invalid products cannot become visible.
4. Finish deployment and operational checks for production backoffice.
5. Only then begin the public catalog API and frontend layers.
