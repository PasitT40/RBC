const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");
const { formatProductSku, PRODUCT_SKU_PREFIX } = require("./lib/product-sku.cjs");

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

async function commitInChunks(db, ops, chunkSize = 400) {
  for (let index = 0; index < ops.length; index += chunkSize) {
    const batch = db.batch();
    ops.slice(index, index + chunkSize).forEach((op) => op(batch));
    await batch.commit();
  }
}

function parseSkuSequence(value) {
  const match = /^RBC-(\d+)$/.exec(String(value ?? "").trim());
  return match ? Number(match[1]) : null;
}

async function main() {
  const env = parseEnvFile(resolveEnvPath(projectRoot));
  const databaseId = env.FIRESTORE_DATABASE_ID || "(default)";
  const serviceAccountFile = env.SERVICE_ACCOUNT_KEY_FILE || "serviceAccountKey.json";
  const serviceAccountPath = path.join(projectRoot, serviceAccountFile);
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Missing service account file: ${serviceAccountPath}`);
  }

  const dryRun = process.argv.includes("--dry-run");
  const serviceAccount = require(serviceAccountPath);
  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || serviceAccount.project_id,
  });
  const db = getFirestore(app, databaseId);
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

  const [productsSnap, counterSnap] = await Promise.all([
    db.collection("products").get(),
    db.collection("counters").doc("products").get(),
  ]);

  const products = productsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const existingCounterSeq = Number(counterSnap.data()?.last_sku_seq ?? 0);

  const byCreatedAt = [...products].sort((left, right) => {
    const leftDate = typeof left.created_at?.toDate === "function" ? left.created_at.toDate().getTime() : 0;
    const rightDate = typeof right.created_at?.toDate === "function" ? right.created_at.toDate().getTime() : 0;
    if (leftDate !== rightDate) return leftDate - rightDate;
    return String(left.id).localeCompare(String(right.id));
  });

  let nextSequence = 0;
  const seenSkuValues = new Set();
  const updates = [];

  for (const product of byCreatedAt) {
    const currentSku = String(product.sku ?? "").trim();
    const currentSkuSeq = Number(product.sku_seq);
    const parsedFromSku = parseSkuSequence(currentSku);
    const hasValidSku = Boolean(parsedFromSku && Number.isInteger(currentSkuSeq) && currentSkuSeq === parsedFromSku);

    if (hasValidSku && !seenSkuValues.has(currentSku)) {
      seenSkuValues.add(currentSku);
      nextSequence = Math.max(nextSequence, currentSkuSeq);
      continue;
    }

    nextSequence += 1;
    const nextSku = formatProductSku(nextSequence);
    seenSkuValues.add(nextSku);
    updates.push({
      productId: product.id,
      previousSku: currentSku || null,
      previousSkuSeq: Number.isInteger(currentSkuSeq) ? currentSkuSeq : null,
      nextSku,
      nextSkuSeq: nextSequence,
    });
  }

  const targetCounterSeq = Math.max(existingCounterSeq, nextSequence);

  const summary = {
    databaseId,
    dryRun,
    products: products.length,
    updates: updates.length,
    counter: {
      previous: existingCounterSeq,
      next: targetCounterSeq,
      prefix: PRODUCT_SKU_PREFIX,
    },
    details: updates.slice(0, 50),
    details_truncated: updates.length > 50,
  };

  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const ops = updates.map((item) => (batch) => {
    batch.set(
      db.collection("products").doc(item.productId),
      {
        sku: item.nextSku,
        sku_seq: item.nextSkuSeq,
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
  });

  ops.push((batch) => {
    batch.set(
      db.collection("counters").doc("products"),
      {
        prefix: PRODUCT_SKU_PREFIX,
        last_sku_seq: targetCounterSeq,
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
  });

  await commitInChunks(db, ops);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
