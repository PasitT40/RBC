const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

function resolveEnvPath(rootDir) {
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
  const candidates = appEnv === "production" ? [".env.production", ".env"] : [".env.development", ".env"];
  for (const name of candidates) {
    const fullPath = path.join(rootDir, name);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return path.join(rootDir, ".env");
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
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

const argv = new Set(process.argv.slice(2));
const dryRun = !argv.has("--execute");
const allowProduction = argv.has("--allow-production");
const deleteSettings = !argv.has("--keep-settings");
const envPath = resolveEnvPath(projectRoot);
const env = parseEnvFile(envPath);
const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";

if (appEnv === "production" && !allowProduction) {
  throw new Error("cleanup-dev-dataset.cjs blocks production by default. Use APP_ENV=development or pass --allow-production explicitly.");
}

const serviceAccountFile = env.SERVICE_ACCOUNT_KEY_FILE || "serviceAccountKey.json";
const serviceAccountPath = path.join(projectRoot, serviceAccountFile);

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error(`Missing service account file: ${serviceAccountPath}`);
}

const serviceAccount = require(serviceAccountPath);
const databaseId = env.FIRESTORE_DATABASE_ID || "(default)";

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || serviceAccount.project_id,
  storageBucket: env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`,
});

const db = getFirestore(app, databaseId);
const bucket = admin.storage().bucket();

const collectionNames = [
  "orders",
  "stats_ledger",
  "products",
  "category_brands",
  "brands",
  "categories",
  "dashboard_brand_stats",
];

async function batchDeleteDocs(refs, chunkSize = 450) {
  for (let index = 0; index < refs.length; index += chunkSize) {
    const batch = db.batch();
    refs.slice(index, index + chunkSize).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function deleteCollection(name) {
  const snap = await db.collection(name).get();
  const refs = snap.docs.map((doc) => doc.ref);
  if (!dryRun && refs.length) await batchDeleteDocs(refs);
  return { name, count: refs.length };
}

async function deleteNamedDoc(collectionName, docId) {
  const ref = db.collection(collectionName).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return { path: `${collectionName}/${docId}`, deleted: false };
  if (!dryRun) await ref.delete();
  return { path: `${collectionName}/${docId}`, deleted: true };
}

async function deleteStoragePrefix(prefix) {
  const [files] = await bucket.getFiles({ prefix });
  if (!dryRun && files.length) {
    await Promise.all(files.map((file) => file.delete().catch(() => undefined)));
  }
  return { prefix, count: files.length };
}

async function main() {
  const collectionResults = [];
  for (const name of collectionNames) {
    collectionResults.push(await deleteCollection(name));
  }

  const docResults = [
    await deleteNamedDoc("dashboard_stats", "global"),
  ];

  if (deleteSettings) {
    docResults.push(await deleteNamedDoc("settings", "site"));
  }

  const storagePrefixes = [
    "products/",
    "brands/",
    "categories/",
    "settings/site/banners/",
    "settings/site/credits/",
  ];

  const storageResults = [];
  for (const prefix of storagePrefixes) {
    storageResults.push(await deleteStoragePrefix(prefix));
  }

  console.log(JSON.stringify({
    databaseId,
    appEnv,
    dryRun,
    deleteSettings,
    collections: collectionResults,
    docs: docResults,
    storage: storageResults,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
