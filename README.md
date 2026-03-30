# Ratchaburi Camera Backoffice

Nuxt backoffice for inventory, category/brand management, sales flows, and dashboard reporting on Firebase.

## Local development

1. Fill `.env.development` or `.env.production`.
2. Install dependencies.
3. Start the dev server.

```bash
yarn install
yarn dev
```

## Firebase configuration

Client and admin scripts read values directly from `.env.development` or `.env.production` depending on the script.

Important variables:
- `NUXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET_PROD`
- `NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEV`
- `NUXT_PUBLIC_FIRESTORE_DATABASE_ID`
- `FIRESTORE_DATABASE_ID`
- `SERVICE_ACCOUNT_KEY_FILE`

The browser app uses `NUXT_PUBLIC_FIRESTORE_DATABASE_ID` when present, otherwise falls back to `FIRESTORE_DATABASE_ID`.
Storage bucket selection now follows the Firestore database:
- Firestore `(default)` uses `NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET_PROD`
- any named Firestore database uses `NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEV`
- `NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET` remains as a backward-compatible fallback

Recommended rollout for this repository:
- keep the existing Firebase project `ratchaburi-camera`
- use Firestore database `(default)`
- use Storage bucket `gs://ratchaburi-camera`
- avoid named Firestore databases unless there is a strong operational reason

Security boundary notes:
- backoffice access is allowlisted from `owners/{uid}`
- Firestore data remains private to owners; this repo does not treat Firestore as a public catalog read surface
- current Storage Rules owner checks read from Firestore `(default)`, so named Firestore database rollouts require explicit owner-upload verification

## Verification scripts

Operational helpers:
- `node scripts/seed-final.cjs`
- `node scripts/backfill-product-images.cjs`
- `node scripts/rebuild-dashboard-aggregates.cjs --dry-run`
- `node scripts/rebuild-dashboard-aggregates.cjs`
- `node scripts/repair-stats-ledger.cjs --dry-run`
- `node scripts/repair-stats-ledger.cjs`

Verification helpers:
- `node scripts/verify-phase1.cjs`
- `node scripts/verify-phase2-mutations.cjs`
- `node scripts/verify-phase3-guardrails.cjs`
- `node scripts/verify-phase4-management-surface.cjs`
- `node scripts/verify-image-flows.cjs`
- `node scripts/verify-phase5-security-boundaries.cjs`
- `node scripts/verify-phase6-operational-readiness.cjs`

If `verify-phase1.cjs` reports `stats_ledger` shape errors, run `repair-stats-ledger.cjs`; if it reports dashboard counter mismatches, run `rebuild-dashboard-aggregates.cjs`.

## Hosting build

Generate the static backoffice bundle for Firebase Hosting:

```bash
yarn generate:hosting
```

## Firebase deploy

Prepare:
- copy `.firebaserc.example` to `.firebaserc`
- set your Firebase project id
- bind the `backoffice` hosting target to the correct hosting site id
- fill `.env.production` with the real production Firebase values

Deploy commands:

```bash
yarn deploy:indexes
yarn deploy:rules
yarn deploy:hosting
```

Or deploy all backoffice artifacts together:

```bash
yarn deploy:backoffice
```

## Docs

Operational and rollout docs:
- [`docs/implementation-plan.md`](./docs/implementation-plan.md)
- [`docs/firestore.spec.md`](./docs/firestore.spec.md)
- [`docs/public-catalog.spec.md`](./docs/public-catalog.spec.md)
- [`docs/manual-qa-checklist.md`](./docs/manual-qa-checklist.md)
- [`docs/security-boundaries.md`](./docs/security-boundaries.md)
- [`docs/operational-readiness.md`](./docs/operational-readiness.md)
- [`docs/backoffice-deployment.md`](./docs/backoffice-deployment.md)
