const fs = require("fs");
const path = require("path");

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

function main() {
  const firestoreRules = read("firestore.rules");
  const storageRules = read("storage.rules");
  const authMiddleware = read("app/middleware/auth.global.ts");
  const ownerAccess = read("app/composables/useOwnerAccess.ts");
  const layout = read("app/layouts/default.vue");
  const securityDoc = read("docs/security-boundaries.md");

  assertIncludes(firestoreRules, "exists(/databases/$(database)/documents/owners/$(request.auth.uid))", "Firestore owner allowlist check");
  assertIncludes(firestoreRules, "match /owners/{ownerId}", "owners collection rule");
  assertIncludes(firestoreRules, "allow read: if isSignedIn() && request.auth.uid == ownerId;", "owner self-read rule");
  assertIncludes(firestoreRules, "match /orders/{docId}", "orders private rule");
  assertIncludes(firestoreRules, "match /dashboard_stats/{docId}", "dashboard stats private rule");
  assertIncludes(firestoreRules, "match /dashboard_brand_stats/{docId}", "dashboard brand stats private rule");
  assertIncludes(firestoreRules, "match /stats_ledger/{docId}", "stats ledger private rule");
  assertIncludes(firestoreRules, "match /counters/{docId}", "counters private rule");
  assertIncludes(firestoreRules, "match /{document=**}", "Firestore deny-all fallback");
  assertIncludes(firestoreRules, "allow read, write: if false;", "Firestore deny-all fallback policy");

  assertIncludes(storageRules, "request.auth.token.backoffice_owner == true", "Storage owner custom claim check");
  assertIncludes(storageRules, "match /products/{productId}/{allPaths=**}", "product media rule");
  assertIncludes(storageRules, "match /categories/{categoryId}/{allPaths=**}", "category media rule");
  assertIncludes(storageRules, "match /brands/{brandId}/{allPaths=**}", "brand media rule");
  assertIncludes(storageRules, "match /{allPaths=**}", "Storage deny-all fallback");

  assertIncludes(authMiddleware, "ensureOwnerAccess()", "middleware owner access check");
  assertIncludes(authMiddleware, 'navigateTo("/login?denied=1")', "middleware denied redirect");
  assertIncludes(ownerAccess, 'doc($db, "owners", uid)', "owner allowlist source");

  assertIncludes(layout, "backoffice_owner=true", "storage claim guidance copy");
  assertIncludes(securityDoc, "backoffice_owner", "storage claim guidance doc");

  console.log("Phase 5 security boundary checks passed");
}

main();
