# Backoffice Deployment

Project: Camera Marketplace Backoffice

## Deployment target

Recommended current deployment path:
- static Nuxt build via `nuxt generate`
- Firebase Hosting target: `backoffice`

Reasoning:
- the backoffice currently reads and writes directly to Firebase from the client
- no server routes are required for the current backoffice feature set
- Firebase Hosting is sufficient for static asset delivery

## Required files

- `.env`
- `.firebaserc`
- `firebase.json`
- `firestore.rules`
- `storage.rules`
- `firestore.indexes.json`

## One-time setup

1. Copy `.firebaserc.example` to `.firebaserc`.
2. Set the default Firebase project id.
3. Bind hosting target `backoffice` to the intended Firebase Hosting site.
4. Fill `.env` with the real Firebase values for the single environment.
5. Make sure the production owner allowlist exists in `owners/{uid}`.
6. If `NUXT_PUBLIC_FIRESTORE_DATABASE_ID` is not `(default)`, plan a real owner upload smoke test before release because Storage Rules still check `owners/{uid}` in `(default)`.
7. Set storage bucket envs to match the Firestore database policy:
   - `(default)` Firestore -> `NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET_PROD`
   - named Firestore database -> `NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEV`

Recommended values for this project:
- Firebase project id: `ratchaburi-camera`
- Firestore database id: `(default)`
- Storage bucket: `ratchaburi-camera`

Example target binding:

```bash
firebase target:apply hosting backoffice your-hosting-site-id
```

## Build

```bash
yarn generate:hosting
```

Expected output:
- static files in `.output/public`
- `index.html` present for Hosting deployment

## Deploy

Rules and indexes:

```bash
yarn deploy:indexes
yarn deploy:rules
```

Hosting:

```bash
yarn deploy:hosting
```

All at once:

```bash
yarn deploy:backoffice
```

## Production smoke test

After deploy, verify:
- hosting site loads without console build errors
- owner login succeeds
- non-owner login is rejected and redirected back to `/login?denied=1`
- category list loads
- brand list loads and the backoffice `subcategory` view still resolves from global `brands` plus `category_brands`
- product list loads
- create/edit product works
- toggle show works
- reserve/active works
- confirm sale / undo sale works
- image upload and replacement work

## Important caveat

This rollout should prefer Firestore `(default)` for the current project to minimize rule and integration risk.

If the single environment uses a named Firestore database instead of `(default)`, verify Storage Rules owner checks carefully.

Current Storage Rules use:
- `firestore.exists(/databases/(default)/documents/owners/$(request.auth.uid))`

That can diverge from a named Firestore database setup. Do not treat production rollout as complete until Storage writes are verified with a real owner account.
