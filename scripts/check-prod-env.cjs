const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env.production");
const firebasercPath = path.join(projectRoot, ".firebaserc");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing env file: ${filePath}`);
  }

  const text = fs.readFileSync(filePath, "utf8");
  const result = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch. Expected "${expected}" but got "${actual || ""}"`);
  }
}

function assertTruthy(value, label) {
  if (!String(value || "").trim()) {
    throw new Error(`Missing ${label}`);
  }
}

function main() {
  const env = parseEnvFile(envPath);
  const firebaserc = fs.existsSync(firebasercPath)
    ? JSON.parse(fs.readFileSync(firebasercPath, "utf8"))
    : null;

  const expectedProjectId = "ratchaburi-camera";
  const expectedDatabaseId = "ratchaburi-camera-prod";
  const expectedBucket = "gs://ratchaburi-camera-prod";

  assertEqual(env.NUXT_PUBLIC_FIREBASE_PROJECT_ID, expectedProjectId, "NUXT_PUBLIC_FIREBASE_PROJECT_ID");
  assertEqual(env.NUXT_PUBLIC_FIRESTORE_DATABASE_ID, expectedDatabaseId, "NUXT_PUBLIC_FIRESTORE_DATABASE_ID");
  assertEqual(env.FIRESTORE_DATABASE_ID, expectedDatabaseId, "FIRESTORE_DATABASE_ID");
  assertEqual(env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET, expectedBucket, "NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  assertEqual(env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET_PROD, expectedBucket, "NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET_PROD");
  assertTruthy(env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEV, "NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEV");
  assertTruthy(env.NUXT_PUBLIC_FIREBASE_API_KEY, "NUXT_PUBLIC_FIREBASE_API_KEY");
  assertTruthy(env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN, "NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  assertTruthy(env.NUXT_PUBLIC_FIREBASE_APP_ID, "NUXT_PUBLIC_FIREBASE_APP_ID");

  const serviceAccountFile = env.SERVICE_ACCOUNT_KEY_FILE || "serviceAccountKey.json";
  const serviceAccountPath = path.join(projectRoot, serviceAccountFile);
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Missing SERVICE_ACCOUNT_KEY_FILE target: ${serviceAccountPath}`);
  }

  if (firebaserc) {
    assertEqual(firebaserc.projects?.default, expectedProjectId, ".firebaserc projects.default");
    const hostingTargets = firebaserc.targets?.[expectedProjectId]?.hosting?.backoffice || [];
    if (!Array.isArray(hostingTargets) || hostingTargets.length === 0) {
      throw new Error('Missing hosting target binding for "backoffice" in .firebaserc');
    }
  }

  console.log(JSON.stringify({
    status: "ok",
    projectId: expectedProjectId,
    databaseId: expectedDatabaseId,
    storageBucket: expectedBucket,
    serviceAccountFile,
    firebasercChecked: Boolean(firebaserc),
  }, null, 2));
}

main();
