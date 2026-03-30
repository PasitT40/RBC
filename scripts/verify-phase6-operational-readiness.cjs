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

function normalizeFields(fields) {
  return fields
    .map((field) => `${field.fieldPath}:${field.order || field.arrayConfig || ""}`)
    .join("|");
}

function assertIndexExists(indexes, collectionGroup, expectedFields, label) {
  const expected = expectedFields.join("|");
  const found = indexes.some((index) =>
    index.collectionGroup === collectionGroup &&
    normalizeFields(index.fields || []) === expected
  );
  if (!found) {
    throw new Error(`Missing ${label}: ${collectionGroup} ${expected}`);
  }
}

function main() {
  const readinessDoc = read("docs/operational-readiness.md");
  const readme = read("README.md");
  const handoff = read("docs/codex-handoff.md");
  const indexesJson = JSON.parse(read("firestore.indexes.json"));
  const rebuildScript = read("scripts/rebuild-dashboard-aggregates.cjs");

  assertIncludes(readinessDoc, "Dashboard rebuild procedure", "dashboard rebuild documentation");
  assertIncludes(readinessDoc, "rebuild-dashboard-aggregates.cjs", "rebuild script documentation");
  assertIncludes(readinessDoc, "verify-phase1.cjs", "read-only verification documentation");
  assertIncludes(readinessDoc, "verify-phase2-mutations.cjs", "mutation verification documentation");
  assertIncludes(readinessDoc, "verify-phase3-guardrails.cjs", "publish guardrail verification documentation");
  assertIncludes(readinessDoc, "verify-phase5-security-boundaries.cjs", "security verification documentation");
  assertIncludes(readinessDoc, "npm_config_cache=/tmp/npm-cache", "workstation caveat workaround");
  assertIncludes(readinessDoc, "Single environment", "environment readiness section");

  assertIncludes(readme, "rebuild-dashboard-aggregates.cjs", "README rebuild command");
  assertIncludes(readme, "verify-phase6-operational-readiness.cjs", "README phase 6 verifier");
  assertIncludes(handoff, "Phase 6", "handoff phase 6 summary");

  assertIncludes(rebuildScript, "SERVICE_ACCOUNT_KEY_FILE", "rebuild script env support");
  assertIncludes(rebuildScript, "--dry-run", "rebuild script dry-run support");
  assertIncludes(rebuildScript, 'db.collection("dashboard_stats").doc("global")', "rebuild global stats write");
  assertIncludes(rebuildScript, 'db.collection("dashboard_brand_stats").doc(brandId)', "rebuild brand stats write");

  const indexes = indexesJson.indexes || [];
  assertIndexExists(indexes, "products", [
    "show:ASCENDING",
    "is_deleted:ASCENDING",
    "status:ASCENDING",
    "updated_at:DESCENDING",
  ], "public product visibility index");
  assertIndexExists(indexes, "products", [
    "category_id:ASCENDING",
    "show:ASCENDING",
    "is_deleted:ASCENDING",
    "status:ASCENDING",
    "updated_at:DESCENDING",
  ], "public category product index");
  assertIndexExists(indexes, "products", [
    "category_id:ASCENDING",
    "brand_id:ASCENDING",
    "show:ASCENDING",
    "is_deleted:ASCENDING",
    "status:ASCENDING",
    "updated_at:DESCENDING",
  ], "public category-brand product index");
  assertIndexExists(indexes, "products", [
    "category_id:ASCENDING",
    "show:ASCENDING",
    "is_deleted:ASCENDING",
    "status:ASCENDING",
    "sell_price:ASCENDING",
  ], "public category price index");
  assertIndexExists(indexes, "products", [
    "category_id:ASCENDING",
    "brand_id:ASCENDING",
    "show:ASCENDING",
    "is_deleted:ASCENDING",
    "status:ASCENDING",
    "sell_price:ASCENDING",
  ], "public category-brand price index");

  console.log("Phase 6 operational readiness checks passed");
}

main();
