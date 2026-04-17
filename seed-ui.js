const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const path = require("path");
const { PRODUCT_SKU_PREFIX } = require("./scripts/lib/product-sku.cjs");

const serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));
const app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || "(default)";

const db = getFirestore(app, FIRESTORE_DATABASE_ID);
const TS = FieldValue.serverTimestamp;
console.log(`[seed] baseline project_id=${serviceAccount.project_id} database_id=${FIRESTORE_DATABASE_ID}`);

const OWNER_UID = process.env.OWNER_UID || "";
const OWNER_EMAIL = process.env.OWNER_EMAIL || "";
const OWNER_NAME = process.env.OWNER_NAME || "";

async function commitInChunks(ops, chunkSize = 450) {
  for (let i = 0; i < ops.length; i += chunkSize) {
    const batch = db.batch();
    ops.slice(i, i + chunkSize).forEach((fn) => fn(batch));
    await batch.commit();
  }
}

async function seed() {
  const ops = [];

  if (OWNER_UID) {
    ops.push((batch) =>
      batch.set(
        db.collection("owners").doc(OWNER_UID),
        {
          email: OWNER_EMAIL,
          display_name: OWNER_NAME,
          created_at: TS(),
        },
        { merge: true }
      )
    );
  }

  ops.push((batch) =>
    batch.set(
      db.collection("settings").doc("site"),
      {
        banner_auto_slide_sec: 5,
        banners: [],
        credits: [],
        updated_at: TS(),
      },
      { merge: true }
    )
  );

  ops.push((batch) =>
    batch.set(
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
    )
  );

  ops.push((batch) =>
    batch.set(
      db.collection("counters").doc("products"),
      {
        prefix: PRODUCT_SKU_PREFIX,
        last_sku_seq: 0,
        updated_at: TS(),
      },
      { merge: true }
    )
  );

  await commitInChunks(ops);
  console.log("✅ baseline seed DONE");
}

seed().catch((error) => {
  console.error("❌ seed failed:", error);
  process.exit(1);
});
