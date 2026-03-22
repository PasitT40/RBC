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

- `.env.production`
- `.firebaserc`
- `firebase.json`
- `firestore.rules`
- `storage.rules`
- `firestore.indexes.json`

## One-time setup

1. Copy `.firebaserc.example` to `.firebaserc`.
2. Set the default Firebase project id.
3. Bind hosting target `backoffice` to the intended Firebase Hosting site.
4. Fill `.env.production` with production Firebase values.
5. Make sure the production owner allowlist exists in `owners/{uid}`.

Example target binding:

```bash
firebase target:apply hosting backoffice your-hosting-site-id
```

## Build

```bash
yarn generate:prod
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
- category list loads
- brand/subcategory list loads
- product list loads
- create/edit product works
- toggle show works
- reserve/active works
- confirm sale / undo sale works
- image upload and replacement work

## Important caveat

If production uses a named Firestore database instead of `(default)`, verify Storage Rules owner checks carefully.

Current Storage Rules use:
- `firestore.exists(/databases/(default)/documents/owners/$(request.auth.uid))`

That can diverge from a named Firestore database setup. Do not treat production rollout as complete until Storage writes are verified with a real owner account.
