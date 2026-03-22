# Ratchaburi Camera Backoffice

Nuxt backoffice for inventory, category/brand management, sales flows, and dashboard reporting on Firebase.

## Local development

1. Copy environment values into `.env.development`.
2. Install dependencies.
3. Start the dev server.

```bash
yarn install
yarn dev
```

## Firebase configuration

Client and admin scripts read values from:
- `.env.development`
- `.env.production`

Important variables:
- `NUXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NUXT_PUBLIC_FIRESTORE_DATABASE_ID`
- `FIRESTORE_DATABASE_ID`
- `SERVICE_ACCOUNT_KEY_FILE`

The browser app uses `NUXT_PUBLIC_FIRESTORE_DATABASE_ID` when present, otherwise falls back to `FIRESTORE_DATABASE_ID`.

## Verification scripts

Phase 1 verification helpers:
- `node scripts/seed-final.cjs`
- `node scripts/backfill-product-images.cjs`
- `node scripts/verify-phase1.cjs`
- `node scripts/verify-phase1-mutations.cjs`
- `node scripts/verify-image-flows.cjs`

## Production build

Generate the static backoffice bundle for Firebase Hosting:

```bash
yarn generate:prod
```

## Firebase deploy

Prepare:
- copy `.firebaserc.example` to `.firebaserc`
- set your Firebase project id
- bind the `backoffice` hosting target to the correct hosting site id

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
