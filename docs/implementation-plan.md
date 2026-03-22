# Implementation Checklist And Delivery Plan

Project: Camera Marketplace Backoffice -> Public Catalog Readiness

This plan is ordered to keep scope pragmatic:
- stabilize the current backoffice first
- deploy a safe production-grade backoffice
- then build the public catalog on top of a stable data contract

## Phase 1: Backoffice Production Readiness

### 1. Data contract alignment
- [x] Align Firestore spec with current backoffice behavior
- [x] Align AGENTS rules with actual persisted product lifecycle
- [x] Add public catalog spec
- [x] Add official optional SEO fields to schema/types
- [x] Review all pages/composables against the updated spec
- [x] Remove or document any remaining schema ambiguity

Definition of done:
- docs and implementation describe the same lifecycle semantics
- no unresolved conflict between AGENTS, Firestore spec, and code

### 2. Core business flow verification
- [x] Verify create product end-to-end
- [x] Verify edit product end-to-end
- [x] Verify toggle show end-to-end
- [x] Verify set reserved end-to-end
- [x] Verify set active end-to-end
- [x] Verify soft delete end-to-end
- [x] Verify confirm sale end-to-end
- [x] Verify undo sale end-to-end
- [x] Verify dashboard counters after each write flow
- [x] Verify image upload/update/remove behavior

Definition of done:
- all required flows work from UI to Firestore
- dashboard counters remain consistent after mutations
- no orphaned image behavior in normal user flows

### 3. Data quality and publish guard
- [x] Define minimum public-ready product fields
- [x] Block or warn when `show=true` but required public fields are incomplete
- [x] Validate slug creation/update policy
- [x] Detect or prevent public slug collisions
- [x] Ensure category-brand mapping exists before publish
- [x] Ensure public products have at least one usable image

Minimum recommended public-ready product fields:
- name
- slug
- category_id
- brand_id
- sell_price
- cover_image or at least one product image

Definition of done:
- a product cannot accidentally become public with broken or incomplete data

### 4. SEO support in backoffice
- [x] Add optional SEO fields to product create form
- [x] Add optional SEO fields to product edit form
- [x] Add optional SEO fields to category form
- [x] Add optional SEO fields to brand form
- [x] Apply documented fallback rules when fields are blank

Definition of done:
- schema supports SEO now
- backoffice can manage SEO fields without making them mandatory

### 5. Security boundaries
- [x] Write `firestore.rules`
- [x] Write `storage.rules`
- [x] Restrict backoffice writes to owner accounts only
- [x] Prevent public reads to private collections
- [x] Decide whether public catalog will read via server/API only
- [x] Document admin-only collections and write paths

Collections that should not be public-readable by default:
- `owners`
- `orders`
- `dashboard_stats`
- `dashboard_brand_stats`
- `stats_ledger`

Definition of done:
- Firebase rules match the intended production architecture

Current caveat:
- Storage Rules owner checks should still be verified against the effective owner source when using a named Firestore database in development or production

### 6. Indexes and operational readiness
- [x] Create required Firestore composite indexes for backoffice queries
- [x] Prepare required indexes for public catalog queries
- [x] Document rebuild procedure for dashboard aggregates
- [x] Check for root-owned local cache or permission issues in the toolchain
- [x] Prepare production environment variables and Firebase targets

Definition of done:
- queries used by UI can run in production without missing-index surprises

### 7. Testing and release confidence
- [x] Add or document manual QA checklist
- [x] Add automated tests for critical business flows where practical
- [x] Test sale/undo sale idempotency behavior
- [x] Test hidden/deleted product behavior
- [x] Test reserved/active transitions
- [x] Test dashboard correctness after multiple mutations

Definition of done:
- critical flows have repeatable verification before deployment

## Phase 2: Deploy Backoffice

### 8. Backoffice deployment
- [ ] Set up Firebase Hosting target for backoffice
- [ ] Configure production auth settings
- [ ] Apply Firestore and Storage rules
- [ ] Deploy indexes
- [ ] Smoke-test production environment

Definition of done:
- backoffice is live and safe for production use

## Phase 3: Public Catalog Delivery

### 9. Public catalog backend contract
- [ ] Decide public access pattern:
  - recommended: server/API layer
- [ ] Define server routes for public reads
- [ ] Implement visibility enforcement in one place
- [ ] Add caching/revalidation strategy
- [ ] Return 404 for hidden/deleted/reserved/sold products

Recommended public API routes:
- [ ] `GET /api/products`
- [ ] `GET /api/products/[slug]`
- [ ] `GET /api/categories`
- [ ] `GET /api/categories/[categorySlug]`
- [ ] `GET /api/categories/[categorySlug]/brands`
- [ ] `GET /api/categories/[categorySlug]/[brandSlug]/products`

Definition of done:
- public app has a stable read contract independent from direct Firestore reads

### 10. Public catalog frontend
- [ ] Build product listing page
- [ ] Build product detail page
- [ ] Build category page
- [ ] Build category + brand page
- [ ] Implement pagination
- [ ] Implement launch filters
- [ ] Implement launch sorting
- [ ] Implement SEO metadata rendering
- [ ] Implement error/404 pages

Definition of done:
- public catalog can browse all public-visible products safely

### 11. Public catalog production hardening
- [ ] Add caching strategy
- [ ] Validate canonical URLs
- [ ] Validate SEO fallbacks
- [ ] Confirm no hidden/private data leaks
- [ ] Verify image fallback handling
- [ ] Verify performance on list/detail pages

Definition of done:
- public website is production-safe and SEO-ready

## Recommended execution order

### Immediate next tasks
1. Add SEO fields to backoffice forms
2. Write `firestore.rules`
3. Write `storage.rules`
4. Add publish/data-quality guard for public-visible products
5. Run full manual QA on required flows

### Before deploying backoffice
1. Complete Phase 1
2. Deploy rules and indexes
3. Smoke-test production

### Before starting public catalog
1. Backoffice production deployment is stable
2. Public-safe data is available
3. Visibility rules are enforced consistently
4. Public API contract is agreed

## Recommended owner sequence

### Backoffice-first plan
1. Finish schema/spec/rules alignment
2. Add missing backoffice fields and validation
3. Test and deploy backoffice
4. Seed and clean production data
5. Start public catalog implementation

This is the recommended path for the current project.
