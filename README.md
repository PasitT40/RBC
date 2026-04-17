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

## Recommended scripts

Use these as the default command set for day-to-day work:

- `yarn dev` - run the backoffice with `.env.development`
- `yarn dev:prod` - run the backoffice locally against `.env.production`
- `yarn typecheck` - run Nuxt typecheck with a safe temporary npm cache
- `yarn deploy:check:prod` - verify the production env, hosting target, and service-account file before deploy
- `yarn data:cleanup:dry-run` - preview dev-data cleanup
- `yarn data:cleanup:apply` - execute dev-data cleanup
- `yarn data:reseed` - reseed the dev dataset
- `yarn data:reseed:verify` - reseed dev data and run verification steps
- `yarn deploy:hosting:prod` - build and deploy Hosting
- `yarn deploy:backoffice:prod` - build and deploy Hosting + public API + indexes + rules + storage
- `yarn deploy:hosting:dev` - build and deploy Hosting for the dev environment
- `yarn deploy:backoffice:dev` - build and deploy Hosting + public API for the dev environment

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

The browser app requires `NUXT_PUBLIC_FIRESTORE_DATABASE_ID` explicitly and does not fall back to `FIRESTORE_DATABASE_ID`.
Storage bucket selection now follows the Firestore database id explicitly:
- Firestore `ratchaburi-camera-prod` uses `NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET_PROD`
- Firestore `ratchaburi-camera-dev` uses `NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEV`
- `NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET` remains as a backward-compatible fallback for any other database id

Recommended rollout for this repository:
- keep the existing Firebase project `ratchaburi-camera`
- use Firestore database `ratchaburi-camera-prod` for production
- use Firestore database `ratchaburi-camera-dev` for development
- use Storage bucket `gs://ratchaburi-camera-prod` with the prod database
- use Storage bucket `gs://ratchaburi-camera-dev` with the dev database

Security boundary notes:
- backoffice access is allowlisted from `owners/{uid}`
- Firestore data remains private to owners; this repo does not treat Firestore as a public catalog read surface
- Storage writes are authorized by Firebase Auth custom claim `backoffice_owner=true`
- after granting or revoking the storage-owner claim, force the user to sign out and sign in again before testing uploads

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

Production Hosting deploy builds the static bundle automatically.

## Firebase deploy

Prepare:
- copy `.firebaserc.example` to `.firebaserc`
- set your Firebase project id
- bind the `backoffice` hosting target to the correct hosting site id
- fill `.env.production` with the real production Firebase values

Deploy commands:

```bash
yarn deploy:check:prod
yarn deploy:hosting:prod
```

Or deploy all backoffice artifacts together:

```bash
yarn deploy:check:prod
yarn deploy:backoffice:prod
```

## Docs

Operational and rollout docs:
- [`docs/implementation-plan.md`](./docs/implementation-plan.md)
- [`docs/backoffice-user-guide.md`](./docs/backoffice-user-guide.md)
- [`docs/backoffice-system-flows.md`](./docs/backoffice-system-flows.md)
- [`docs/firestore.spec.md`](./docs/firestore.spec.md)
- [`docs/public-catalog.spec.md`](./docs/public-catalog.spec.md)
- [`docs/manual-qa-checklist.md`](./docs/manual-qa-checklist.md)
- [`docs/security-boundaries.md`](./docs/security-boundaries.md)
- [`docs/operational-readiness.md`](./docs/operational-readiness.md)
- [`docs/backoffice-deployment.md`](./docs/backoffice-deployment.md)
