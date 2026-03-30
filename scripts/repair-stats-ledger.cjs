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
const serviceAccount = require(path.join(projectRoot, "serviceAccountKey.json"));

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

const env = parseEnvFile(envPath);
const databaseId = env.FIRESTORE_DATABASE_ID || "(default)";
const app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = getFirestore(app, databaseId);
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

const dryRun = process.argv.includes("--dry-run");

function buildLedgerPayload(type, orderId, productId, existingCreatedAt) {
  return {
    type,
    ref_id: orderId,
    entity_type: "order",
    entity_id: orderId,
    operation_key: `${type}_${orderId}`,
    product_id: productId || null,
    created_at: existingCreatedAt ?? serverTimestamp(),
  };
}

async function commitInChunks(ops, chunkSize = 450) {
  for (let i = 0; i < ops.length; i += chunkSize) {
    const batch = db.batch();
    ops.slice(i, i + chunkSize).forEach((op) => op(batch));
    await batch.commit();
  }
}

async function main() {
  const [ordersSnap, ledgersSnap] = await Promise.all([
    db.collection("orders").get(),
    db.collection("stats_ledger").get(),
  ]);

  const orders = new Map(ordersSnap.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]));
  const ledgers = new Map(ledgersSnap.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]));
  const ops = [];
  const repairs = [];

  for (const order of orders.values()) {
    const candidates = [
      { type: "SALE_APPLIED", required: true },
      { type: "SALE_REVERTED", required: order.status === "CANCELLED" },
    ];

    for (const candidate of candidates) {
      const ledgerId = `${candidate.type}_${order.id}`;
      const existing = ledgers.get(ledgerId);
      if (!existing && !candidate.required) continue;

      const targetPayload = buildLedgerPayload(
        candidate.type,
        order.id,
        String(order.product_id || ""),
        existing?.created_at
      );

      const changedFields = [];
      if (!existing) {
        changedFields.push("create");
      } else {
        for (const [key, value] of Object.entries(targetPayload)) {
          const current = existing[key];
          if (key === "created_at") continue;
          if (current !== value) changedFields.push(key);
        }
        if (!existing.created_at) changedFields.push("created_at");
      }

      if (changedFields.length === 0) continue;

      repairs.push({
        ledgerId,
        orderId: order.id,
        type: candidate.type,
        changedFields,
      });

      if (!dryRun) {
        ops.push((batch) => {
          batch.set(
            db.collection("stats_ledger").doc(ledgerId),
            targetPayload,
            { merge: true }
          );
        });
      }
    }
  }

  if (!dryRun && ops.length > 0) {
    await commitInChunks(ops);
  }

  console.log(JSON.stringify({
    databaseId,
    dryRun,
    orders: orders.size,
    ledgers: ledgers.size,
    repairs: repairs.length,
    details: repairs,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
