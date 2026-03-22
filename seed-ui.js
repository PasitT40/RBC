const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));
const app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || "(default)";

const db = getFirestore(app, FIRESTORE_DATABASE_ID);
const TS = FieldValue.serverTimestamp;
console.log(`[seed] project_id=${serviceAccount.project_id} database_id=${FIRESTORE_DATABASE_ID}`);

// optional: whitelist owner
const OWNER_UID = process.env.OWNER_UID || "";
const OWNER_EMAIL = process.env.OWNER_EMAIL || "";
const OWNER_NAME = process.env.OWNER_NAME || "";

const soldChannels = ["FB", "LINE", "TIKTOK", "IG", "WALKIN"];
const conditions = ["NEW", "LIKE_NEW", "GOOD", "FAIR"];

function slugify(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function money(v) {
  return Math.round(v);
}
function yyyymmNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
async function commitInChunks(ops, chunkSize = 450) {
  const debugOps = process.env.DEBUG_SEED_OPS === "1";

  if (debugOps) {
    for (let i = 0; i < ops.length; i += 1) {
      const batch = db.batch();
      try {
        ops[i](batch);
        await batch.commit();
      } catch (err) {
        console.error(`❌ commit failed at op index ${i}`);
        throw err;
      }
    }
    return;
  }

  for (let i = 0; i < ops.length; i += chunkSize) {
    const batch = db.batch();
    ops.slice(i, i + chunkSize).forEach((fn) => fn(batch));
    await batch.commit();
  }
}

function computeGlobalStats(products, orders) {
  const s = {
    total_products: products.length,
    active_products: 0,
    reserved_products: 0,
    sold_products: 0,
    visible_products: 0,

    total_sales_count: 0,
    total_sales_amount: 0,
    total_cost_amount: 0,
    total_profit_amount: 0,
  };

  for (const p of products) {
    if (p.show) s.visible_products += 1;
    if (p.status === "ACTIVE") s.active_products += 1;
    if (p.status === "RESERVED") s.reserved_products += 1;
    if (p.status === "SOLD") s.sold_products += 1;
  }

  for (const o of orders) {
    if (o.status !== "CONFIRMED") continue;
    s.total_sales_count += 1;
    s.total_sales_amount += o.sold_price;
    s.total_cost_amount += o.cost_price_at_sale;
    s.total_profit_amount += o.profit;
  }

  return s;
}

function computeBrandStats(orders) {
  const map = new Map(); // brandId -> stats
  for (const o of orders) {
    if (o.status !== "CONFIRMED") continue;

    if (!map.has(o.brand_id)) {
      map.set(o.brand_id, {
        brand_id: o.brand_id,
        brand_name: o.brand_name,
        sales_count: 0,
        sales_amount: 0,
        cost_amount: 0,
        profit_amount: 0,
      });
    }
    const s = map.get(o.brand_id);
    s.sales_count += 1;
    s.sales_amount += o.sold_price;
    s.cost_amount += o.cost_price_at_sale;
    s.profit_amount += o.profit;
  }
  return map;
}

// -------------------- Seed Data --------------------
// categories
const categories = [
  { id: "camera", name: "CAMERA", order: 1 },
  { id: "lens", name: "LEN", order: 2 },
  { id: "accessories", name: "ACCESSORIES", order: 3 },
];

// brands (global)
const brands = [
  { name: "Canon", order: 1 },
  { name: "Nikon", order: 2 },
  { name: "Sony", order: 3 },
  { name: "Fujifilm", order: 4 },
  { name: "Sigma", order: 5 },
  { name: "Tamron", order: 6 },
  { name: "DJI", order: 7 },
  { name: "Godox", order: 8 },
];

// mapping category -> brands
const categoryBrandMap = {
  camera: ["Canon", "Nikon", "Sony", "Fujifilm", "DJI"],
  lens: ["Canon", "Nikon", "Sony", "Sigma", "Tamron"],
  accessories: ["Godox", "DJI", "Sony"],
};

async function seed() {
  const ops = [];

  // owners/{uid} optional
  if (OWNER_UID) {
    ops.push((b) =>
      b.set(
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

  // settings/site (UI)
  ops.push((b) =>
    b.set(
      db.collection("settings").doc("site"),
      {
        banner_auto_slide_sec: 5,
        banners: [
          { id: "banner1", image_url: "", order: 1, active: true },
          { id: "banner2", image_url: "", order: 2, active: true },
        ],
        credits: [{ id: "credit1", image_url: "", order: 1 }],
        updated_at: TS(),
      },
      { merge: true }
    )
  );

  // categories
  for (const c of categories) {
    ops.push((b) =>
      b.set(
        db.collection("categories").doc(c.id),
        {
          name: c.name,
          slug: slugify(c.name),
          image_url: "",
          order: c.order,
          is_active: true,
          created_at: TS(),
          updated_at: TS(),
        },
        { merge: true }
      )
    );
  }

  // brands (global)
  for (const br of brands) {
    const brandId = slugify(br.name);
    ops.push((b) =>
      b.set(
        db.collection("brands").doc(brandId),
        {
          name: br.name,
          slug: brandId,
          image_url: "",
          order: br.order,
          is_active: true,
          created_at: TS(),
          updated_at: TS(),
        },
        { merge: true }
      )
    );
  }

  // category_brands mapping (UI dropdown)
  for (const [categoryId, brandNames] of Object.entries(categoryBrandMap)) {
    const cat = categories.find((x) => x.id === categoryId);
    for (let i = 0; i < brandNames.length; i++) {
      const name = brandNames[i];
      const brandId = slugify(name);
      const docId = `${categoryId}__${brandId}`;

      ops.push((b) =>
        b.set(
          db.collection("category_brands").doc(docId),
          {
            category_id: categoryId,
            category_name: cat?.name ?? "",
            category_slug: slugify(cat?.name ?? categoryId),

            brand_id: brandId,
            brand_name: name,
            brand_image_url: "",

            order: i + 1,
            is_active: true,
            created_at: TS(),
            updated_at: TS(),
          },
          { merge: true }
        )
      );
    }
  }

  // products + orders + ledger (for dashboard/report)
  const productsArr = [];
  const ordersArr = [];

  const sampleProducts = 18;
  const monthKey = yyyymmNow();

  for (let i = 1; i <= sampleProducts; i++) {
    const cat = pick(categories);
    const brandName = pick(categoryBrandMap[cat.id]);
    const brandId = slugify(brandName);

    // distribute statuses
    let status = "ACTIVE";
    if (i % 6 === 0) status = "RESERVED";
    if (i % 4 === 0) status = "SOLD";

    const show = i % 7 !== 0;

    const cost = rand(4000, 35000);
    const sell = money(cost * (1.15 + Math.random() * 0.35));

    const pRef = db.collection("products").doc();
    const productId = pRef.id;

    const productDoc = {
      name: `${brandName} ${cat.name} ${100 + i}`,
      slug: `${brandId}-${cat.id}-${i}`,

      category_id: cat.id,
      category_name: cat.name,

      brand_id: brandId,
      brand_name: brandName,

      condition: pick(conditions),

      cost_price: cost,
      sell_price: sell,

      shutter: cat.id === "camera" ? rand(500, 120000) : null,

      defect_detail: i % 5 === 0 ? "มีรอยเล็กน้อย" : "",
      free_gift_detail: i % 4 === 0 ? "แถมฝาปิด/สายคล้อง" : "",

      cover_image: "",
      images: [],

      status,                // ACTIVE | RESERVED | SOLD
      show,                  // true/false
      is_sellable: status === "ACTIVE",

      last_status_before_sold: null,

      sold_at: null,
      sold_price: null,
      sold_channel: null,
      sold_ref: null,

      created_at: TS(),
      updated_at: TS(),
    };

    if (status === "SOLD") {
      const soldPrice = money(sell * (0.9 + Math.random() * 0.1));
      const fee = money(soldPrice * (Math.random() * 0.03));
      const profit = money(soldPrice - cost - fee);

      const oRef = db.collection("orders").doc();
      const orderId = oRef.id;

      const orderStatus = i % 12 === 0 ? "CANCELLED" : "CONFIRMED";
      const channel = pick(soldChannels);

      // product snapshot
      productDoc.last_status_before_sold = pick(["ACTIVE", "RESERVED"]);
      productDoc.status = "SOLD";
      productDoc.is_sellable = false;
      productDoc.sold_price = soldPrice;
      productDoc.sold_channel = channel;
      productDoc.sold_ref = orderId;
      productDoc.sold_at = TS();

      const orderDoc = {
        status: orderStatus,

        product_id: productId,

        category_id: cat.id,
        brand_id: brandId,
        brand_name: brandName,

        sold_channel: channel,
        sold_price: soldPrice,

        // for report filter
        sold_yyyymm: monthKey,

        cost_price_at_sale: cost,
        fee,
        profit,

        sold_at: TS(),
        created_at: TS(),
        updated_at: TS(),

        product_snapshot: {
          name: productDoc.name,
          slug: productDoc.slug,
          cover_image: "",
          category_name: cat.name,
          brand_name: brandName,
        },
      };

      ordersArr.push(orderDoc);

      ops.push((b) => b.set(oRef, orderDoc, { merge: true }));

      // ledger markers (illustration)
      ops.push((b) =>
        b.set(
          db.collection("stats_ledger").doc(`SALE_APPLIED_${orderId}`),
          { type: "SALE_APPLIED", ref_id: orderId, created_at: TS() },
          { merge: true }
        )
      );

      if (orderStatus === "CANCELLED") {
        ops.push((b) =>
          b.set(
            db.collection("stats_ledger").doc(`SALE_REVERTED_${orderId}`),
            { type: "SALE_REVERTED", ref_id: orderId, created_at: TS() },
            { merge: true }
          )
        );
      }
    }

    productsArr.push(productDoc);
    ops.push((b) => b.set(pRef, productDoc, { merge: true }));
  }

  // dashboard_stats/global computed
  const global = computeGlobalStats(productsArr, ordersArr);
  ops.push((b) =>
    b.set(
      db.collection("dashboard_stats").doc("global"),
      { ...global, updated_at: TS() },
      { merge: true }
    )
  );

  // dashboard_brand_stats/{brandId} computed (all categories)
  const brandStats = computeBrandStats(ordersArr);
  for (const [brandId, s] of brandStats.entries()) {
    ops.push((b) =>
      b.set(
        db.collection("dashboard_brand_stats").doc(brandId),
        { ...s, updated_at: TS() },
        { merge: true }
      )
    );
  }

  await commitInChunks(ops);
  console.log("✅ seed-final.js DONE");
}

seed().catch((e) => {
  console.error("❌ seed failed:", e);
  process.exit(1);
});
