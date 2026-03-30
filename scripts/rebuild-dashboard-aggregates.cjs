const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");

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

const envPath = resolveEnvPath(projectRoot);

function parseEnvFile(filePath) {
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

const env = parseEnvFile(envPath);
const databaseId = env.FIRESTORE_DATABASE_ID || "(default)";
const serviceAccountFile = env.SERVICE_ACCOUNT_KEY_FILE || "serviceAccountKey.json";
const serviceAccountPath = path.join(projectRoot, serviceAccountFile);

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error(`Missing service account file: ${serviceAccountPath}`);
}

const serviceAccount = require(serviceAccountPath);
const dryRun = process.argv.includes("--dry-run");

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || serviceAccount.project_id,
});

const db = getFirestore(app, databaseId);

function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function main() {
  const [productsSnap, ordersSnap, existingBrandStatsSnap] = await Promise.all([
    db.collection("products").get(),
    db.collection("orders").where("status", "==", "CONFIRMED").get(),
    db.collection("dashboard_brand_stats").get(),
  ]);

  const products = productsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const confirmedOrders = ordersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const existingBrandStatIds = existingBrandStatsSnap.docs.map((doc) => doc.id);

  const global = {
    total_products: 0,
    active_products: 0,
    reserved_products: 0,
    sold_products: 0,
    visible_products: 0,
    total_sales_count: 0,
    total_sales_amount: 0,
    total_cost_amount: 0,
    total_profit_amount: 0,
  };

  for (const product of products) {
    if (product.is_deleted) continue;

    global.total_products += 1;

    const status = String(product.status || "ACTIVE");
    if (status === "ACTIVE") global.active_products += 1;
    if (status === "RESERVED") global.reserved_products += 1;
    if (status === "SOLD") global.sold_products += 1;
    if (product.show === true) global.visible_products += 1;
  }

  const brandStats = new Map();

  for (const order of confirmedOrders) {
    const brandId = String(order.brand_id || "unknown");
    const brandName = String(order.brand_name || brandId || "Unknown");
    const salesAmount = asNumber(order.sold_price);
    const costAmount = asNumber(order.cost_price_at_sale);
    const profitAmount = typeof order.profit === "number" ? order.profit : salesAmount - costAmount;

    global.total_sales_count += 1;
    global.total_sales_amount += salesAmount;
    global.total_cost_amount += costAmount;
    global.total_profit_amount += profitAmount;

    if (!brandStats.has(brandId)) {
      brandStats.set(brandId, {
        brand_id: brandId,
        brand_name: brandName,
        sales_count: 0,
        sales_amount: 0,
        cost_amount: 0,
        profit_amount: 0,
      });
    }

    const stats = brandStats.get(brandId);
    stats.brand_name = stats.brand_name || brandName;
    stats.sales_count += 1;
    stats.sales_amount += salesAmount;
    stats.cost_amount += costAmount;
    stats.profit_amount += profitAmount;
  }

  const summary = {
    databaseId,
    dryRun,
    global,
    brandStats: Array.from(brandStats.values()).sort((left, right) => left.brand_id.localeCompare(right.brand_id)),
    deleteBrandStatIds: existingBrandStatIds.filter((id) => !brandStats.has(id)).sort(),
  };

  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const batch = db.batch();
  batch.set(
    db.collection("dashboard_stats").doc("global"),
    {
      ...global,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  for (const [brandId, stats] of brandStats.entries()) {
    batch.set(
      db.collection("dashboard_brand_stats").doc(brandId),
      {
        ...stats,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  for (const brandId of summary.deleteBrandStatIds) {
    batch.delete(db.collection("dashboard_brand_stats").doc(brandId));
  }

  await batch.commit();
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
