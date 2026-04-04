# Codex Handoff

Project: Ratchaburi Camera Backoffice

## Current objective

Execute [`docs/implementation-plan.md`](./implementation-plan.md) phase by phase and summarize the result after each phase.

## Latest completed phase

- Phase 6: Verification, Rebuild, And Operational Readiness

## Latest session update

- Confirmed local toolchain and build path are healthy on Node `v22.22.1`
- Confirmed Firebase Hosting config is aligned for real deploy:
  - `firebase.json` hosting target `backoffice` publishes from `.output/public`
  - `.firebaserc` maps hosting target `backoffice` to project `ratchaburi-camera`
- Added Prettier baseline config for the repo:
  - `.prettierrc.json`
  - `.prettierignore`
  - `.editorconfig`
  - `package.json` scripts `format` and `format:check`
- Refactored product create/edit into a shared editor surface and fixed edit hydration issues so existing product values populate correctly
- Aligned product validation, publish guardrails, and labels so non-SEO merchandising fields now match operator expectations
- Allowed slug/name reuse when the previous product is soft-deleted (`is_deleted=true`)
- Centered the global loading overlay in `app/app.vue`
- Standardized the main backoffice surfaces toward a shared Vuetify-first desktop layout and friendlier Thai copy:
  - dashboard
  - products
  - report
  - settings
  - login
- Added image upload guidance and storage controls:
  - resized WebP upload profiles tuned down to reduce storage growth
  - file-size limits surfaced in upload UI
  - recommended resolution hints surfaced in upload UI
  - browser `alert()` usage replaced with existing app toast flow
- Added dev dataset reset helpers:
  - `scripts/cleanup-dev-dataset.cjs`
  - `scripts/reseed-dev-dataset.cjs`
  - package scripts:
    - `yarn cleanup:dev-data`
    - `yarn cleanup:dev-data:apply`
    - `yarn reseed:dev-data`
    - `yarn reseed:dev-data:verify`
- Updated `scripts/seed-final.cjs` and `scripts/seed-final.js` so products without images are seeded with `show=false`, which keeps Phase 1 integrity checks clean for demo data

## Latest verification status

- Passed:
  - `npm_config_cache=/tmp/rbc-npm-cache yarn -s nuxi typecheck`
  - `yarn generate:hosting`
  - `APP_ENV=development node scripts/verify-phase1.cjs`
  - `APP_ENV=development node scripts/verify-phase2-mutations.cjs`
  - `APP_ENV=development node scripts/verify-phase3-guardrails.cjs`
  - `APP_ENV=development node scripts/verify-image-flows.cjs`
- Current dev database after reseed:
  - Firestore database id: `ratchaburi-camera-dev`
  - Demo data reseeded successfully
  - Phase 1 dev-data debt is cleared

## Current deploy status

- Repo is ready for Firebase Hosting deploy in build terms
- Dev verification suite is green after reseeding the demo dataset
- Recommended production deploy command remains:
  - `firebase deploy --only hosting:backoffice`

## Phase 1 result

- Locked the product lifecycle contract to persisted statuses `ACTIVE | RESERVED | SOLD`
- Confirmed `DELETED` is a UI/display state derived from `is_deleted = true`
- Confirmed brands remain global in `brands/{brandId}`
- Confirmed category-to-brand selection and visibility checks use `category_brands` only
- Clarified that `subcategory` is only a backoffice UI label for global `brands` plus `category_brands`, not a persisted Firestore collection
- Aligned `stats_ledger` payload with the Firestore spec so sale and undo-sale entries now include:
  - `type`
  - `ref_id`
  - `entity_type`
  - `entity_id`
  - `operation_key`
  - `product_id`

## Phase 2 result

- Hardened product lifecycle transitions so `setReserved` only allows `ACTIVE -> RESERVED`
- Hardened product lifecycle transitions so `setActive` only allows `RESERVED -> ACTIVE`
- Kept delete as soft delete only and made cached counter deltas derive from the product's actual persisted status
- Added a dedicated Phase 2 mutation verifier covering:
  - create defaults for `status`, `show`, `is_sellable`, and `is_deleted`
  - `toggleShow` counter updates
  - invalid reserve/activate transition rejection
  - delete counter updates
  - confirm-sale aggregate updates and deterministic ledger writes
  - undo-sale rollback behavior and idempotency

## Phase 3 result

- Centralized product publishability rules into one shared publication helper for slug normalization, slug validation, image sanitization, and minimum public-readiness checks
- Hardened product writes so `createProduct` and `updateProduct` now normalize slug deterministically before write and reject duplicate slugs against the final normalized value
- Kept public visibility guarded in all paths:
  - visible create requires a publish-ready product
  - visible update requires a publish-ready product
  - `toggleShow(true)` requires a publish-ready product and valid `category_brands` mapping
  - soft-deleted products still cannot be made visible again
- Updated the create product screen so operators can save hidden drafts with `show=false` and see publish-readiness warnings plus slug preview before publishing
- Updated the edit product screen to surface current frontend visibility state and warn when a visible product no longer satisfies the public content contract
- Added a dedicated Phase 3 verifier covering deterministic slug normalization, hidden draft saves, visible-product image requirements, duplicate slug rejection, publish-time guardrails, and deleted-product visibility protection

## Files touched in Phase 3

- `app/composables/firestore/publication.ts`
- `app/composables/useProductsFirestore.ts`
- `docs/codex-handoff.md`
- `docs/firestore.spec.md`
- `docs/manual-qa-checklist.md`
- `app/pages/products/create.vue`
- `app/pages/products/edit-[id].vue`
- `scripts/verify-phase3-guardrails.cjs`

## Verification run

- `node --check scripts/verify-phase3-guardrails.cjs`

## Phase 4 result

- Completed backoffice management coverage for operator-managed merchandising fields instead of relying on ad hoc Firestore edits:
  - category display `order`
  - global brand `order`
  - per-category brand mapping `category_brands.order`
  - product `cover_image` management through ordered product images
- Kept the brand model aligned with `AGENTS.md` by making the management surface explicitly describe the real persistence model:
  - global `brands/{brandId}`
  - per-category mapping `category_brands/{categoryId__brandId}`
  - no brand subcollections under categories
- Kept category-to-brand product selection aligned with the mapping model by surfacing that product brand dropdown ordering comes from `category_brands.order`
- Completed optional SEO management guidance in the backoffice so operators can leave SEO fields blank and rely on the documented public fallback behavior for:
  - products
  - categories
  - brands
- Confirmed site-wide frontend settings remain manageable from backoffice through `settings/site`

## Files touched in Phase 4

- `app/pages/categories/index.vue`
- `app/pages/products/create.vue`
- `app/pages/products/edit-[id].vue`
- `docs/codex-handoff.md`
- `docs/firestore.spec.md`
- `docs/manual-qa-checklist.md`
- `scripts/verify-phase4-management-surface.cjs`

## Verification run

- `node --check scripts/verify-phase4-management-surface.cjs`
- `node scripts/verify-phase4-management-surface.cjs`

## Phase 5 result

- Confirmed the owner-only access model stays anchored to `owners/{uid}` across both Security Rules and browser-side backoffice gating
- Kept admin-only operational collections private to owners in Firestore Rules:
  - `owners`
  - `orders`
  - `dashboard_stats`
  - `dashboard_brand_stats`
  - `stats_ledger`
- Kept public catalog posture explicit: current Firestore documents remain private and any future public catalog should read through a controlled server/API layer rather than direct browser access
- Documented the current Storage authorization model:
  - Storage writes use Firebase Auth custom claim `backoffice_owner=true`
  - Firestore owner allowlist and Storage owner authorization are separate controls
  - deployment docs and env guidance now call out the required auth-session refresh after claim changes
- Added a dedicated Phase 5 verifier that checks the expected Firestore Rules, Storage Rules, owner allowlist lookup, middleware gating, and storage-boundary documentation copy

## Files touched in Phase 5

- `.env.example`
- `README.md`
- `app/layouts/default.vue`
- `docs/backoffice-deployment.md`
- `docs/codex-handoff.md`
- `docs/security-boundaries.md`
- `scripts/verify-phase5-security-boundaries.cjs`

## Verification run

- `node --check scripts/verify-phase5-security-boundaries.cjs`
- `node scripts/verify-phase5-security-boundaries.cjs`

## Phase 6 result

- Added an admin-only aggregate rebuild helper so cached dashboard documents can be repaired deterministically from source-of-truth data:
  - `dashboard_stats/global` rebuilt from non-deleted `products` plus confirmed `orders`
  - `dashboard_brand_stats/*` rebuilt from confirmed `orders`
  - supports `--dry-run` preview before writes
  - respects `SERVICE_ACCOUNT_KEY_FILE` from `.env`
- Expanded operational readiness documentation so release and incident handling no longer depend on memory:
  - dashboard rebuild procedure
  - verification script inventory by purpose
  - index readiness expectations
  - workstation caveat for npm cache ownership
  - single-environment variable guidance
- Added a dedicated Phase 6 verifier that checks:
  - rebuild script presence and expected behavior markers
  - operational-readiness documentation coverage
  - README coverage for rebuild/verification commands
  - minimum Firestore composite indexes required by the public catalog spec
- Follow-up repair hardening after Phase 6 verification:
  - identified legacy `stats_ledger` documents created by `seed-ui.js` with only `type`, `ref_id`, and `created_at`
  - updated `seed-ui.js` so new seed data writes the full deterministic ledger payload
  - added `scripts/repair-stats-ledger.cjs` to backfill legacy ledger fields from existing `orders`
  - repaired 10 legacy ledger documents in `ratchaburi-camera-dev`
  - re-ran `node scripts/verify-phase1.cjs` and confirmed zero remaining issues

## Files touched in Phase 6

- `README.md`
- `docs/codex-handoff.md`
- `docs/operational-readiness.md`
- `docs/manual-qa-checklist.md`
- `scripts/rebuild-dashboard-aggregates.cjs`
- `scripts/repair-stats-ledger.cjs`
- `seed-ui.js`
- `scripts/verify-phase6-operational-readiness.cjs`

## Verification run

- `node --check scripts/rebuild-dashboard-aggregates.cjs`
- `node --check scripts/verify-phase6-operational-readiness.cjs`
- `node scripts/verify-phase6-operational-readiness.cjs`

## Known limitation

- `yarn -s nuxi typecheck` could not complete in the current environment because `nuxi` attempted to install missing typecheck packages and the local package-manager cache/tooling state did not provide a clean non-interactive run

## Important working context

- Follow `AGENTS.md` strictly for Firestore rules and required flows
- Do not introduce brand subcollections under categories
- Sell and undo sale must stay Firestore transactions
- Dashboard documents are cached aggregates and must update on writes
- The repo has unrelated existing worktree changes; do not revert unrelated user changes

## Next target

Start Phase 7 from [`docs/implementation-plan.md`](./implementation-plan.md):

- prepare `.env` and `.firebaserc`
- bind Firebase Hosting target for backoffice
- deploy Firestore indexes
- deploy Firestore and Storage rules
- deploy the generated Nuxt backoffice bundle
- smoke-test owner login and all critical flows in production

## Suggested prompt for the next Codex session

Read `AGENTS.md` and [`docs/codex-handoff.md`](./codex-handoff.md) first, then continue Phase 7 from [`docs/implementation-plan.md`](./implementation-plan.md) and summarize the phase result when done.
