// seed-final.cjs
// Baseline seed only: no demo categories, brands, products, or orders.
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");
const { PRODUCT_SKU_PREFIX } = require("./lib/product-sku.cjs");

const projectRoot = path.resolve(__dirname, "..");

function resolveEnvPath(rootDir) {
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
  const candidates = appEnv === "production"
    ? [".env.production", ".env"]
    : [".env.development", ".env"];
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

async function commitInChunks(db, ops, size = 450) {
  for (let i = 0; i < ops.length; i += size) {
    const batch = db.batch();
    ops.slice(i, i + size).forEach((fn) => fn(batch));
    await batch.commit();
  }
}

const envPath = resolveEnvPath(projectRoot);
const env = parseEnvFile(envPath);
const serviceAccount = require(path.join(projectRoot, "serviceAccountKey.json"));
const databaseId = env.FIRESTORE_DATABASE_ID || "(default)";
const app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = getFirestore(app, databaseId);
const TS = admin.firestore.FieldValue.serverTimestamp;

const OWNER_UID = process.env.OWNER_UID || "";
const OWNER_EMAIL = process.env.OWNER_EMAIL || "";
const OWNER_NAME = process.env.OWNER_NAME || "";

async function seed() {
  const ops = [];

  if (OWNER_UID) {
    ops.push((batch) => batch.set(
      db.collection("owners").doc(OWNER_UID),
      {
        email: OWNER_EMAIL,
        display_name: OWNER_NAME,
        created_at: TS(),
      },
      { merge: true }
    ));
  }

  ops.push((batch) => batch.set(
    db.collection("settings").doc("site"),
    {
      banner_auto_slide_sec: 5,
      banners: [],
      credits: [],
      updated_at: TS(),
    },
    { merge: true }
  ));

  ops.push((batch) => batch.set(
    db.collection("dashboard_stats").doc("global"),
    {
      total_products: 0,
      active_products: 0,
      reserved_products: 0,
      sold_products: 0,
      visible_products: 0,
      total_sales_count: 0,
      total_sales_amount: 0,
      total_cost_amount: 0,
      total_profit_amount: 0,
      updated_at: TS(),
    },
    { merge: true }
  ));

  ops.push((batch) => batch.set(
    db.collection("counters").doc("products"),
    {
      prefix: PRODUCT_SKU_PREFIX,
      last_sku_seq: 0,
      updated_at: TS(),
    },
    { merge: true }
  ));

  await commitInChunks(db, ops);
  console.log(`seed-final baseline done for database ${databaseId}`);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
