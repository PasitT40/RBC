const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env.development");
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
const db = databaseId === "(default)" ? admin.firestore(app) : admin.firestore(app, databaseId);
const TS = admin.firestore.FieldValue.serverTimestamp;

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function placeholder(label) {
  return `https://placehold.co/1200x800.webp?text=${encodeURIComponent(label)}`;
}

function cloneCounters(raw) {
  return {
    total_products: Number(raw?.total_products || 0),
    active_products: Number(raw?.active_products || 0),
    reserved_products: Number(raw?.reserved_products || 0),
    sold_products: Number(raw?.sold_products || 0),
    visible_products: Number(raw?.visible_products || 0),
    total_sales_count: Number(raw?.total_sales_count || 0),
    total_sales_amount: Number(raw?.total_sales_amount || 0),
    total_cost_amount: Number(raw?.total_cost_amount || 0),
    total_profit_amount: Number(raw?.total_profit_amount || 0),
  };
}

function diffCounters(before, after) {
  const out = {};
  for (const key of Object.keys(before)) {
    out[key] = Number(after[key] || 0) - Number(before[key] || 0);
  }
  return out;
}

function assertDelta(actual, expected, label) {
  for (const [key, value] of Object.entries(expected)) {
    if (Number(actual[key] || 0) !== Number(value || 0)) {
      throw new Error(`${label}: counter ${key} expected delta ${value} but got ${actual[key]}`);
    }
  }
}

async function readDashboard() {
  const snap = await db.collection("dashboard_stats").doc("global").get();
  return cloneCounters(snap.exists ? snap.data() : {});
}

async function getActiveMappings() {
  const snap = await db.collection("category_brands").where("is_active", "==", true).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function getUniqueSlug(baseSlug) {
  let candidate = baseSlug;
  let attempt = 0;
  while (true) {
    const snap = await db.collection("products").where("slug", "==", candidate).limit(1).get();
    if (snap.empty) return candidate;
    attempt += 1;
    candidate = `${baseSlug}-${attempt}`;
  }
}

async function createProduct(payload) {
  const mappingRef = db.collection("category_brands").doc(`${payload.category_id}__${payload.brand_id}`);
  const mappingSnap = await mappingRef.get();
  if (!mappingSnap.exists) throw new Error("Product category-brand mapping not found");
  const mapping = mappingSnap.data();
  if (mapping.is_active === false) throw new Error("Product category-brand mapping is inactive");

  if (payload.show) {
    if (!payload.name?.trim()) throw new Error("Public products require a name");
    if (!payload.slug?.trim()) throw new Error("Public products require a slug");
    if (!payload.sell_price && payload.sell_price !== 0) throw new Error("Public products require a valid sell price");
    const hasImage = typeof payload.cover_image === "string" && payload.cover_image.trim().length > 0;
    if (!hasImage) throw new Error("Public products require at least one image");
  }

  const productRef = db.collection("products").doc();
  const status = payload.status || "ACTIVE";
  const show = payload.show ?? true;

  const batch = db.batch();
  batch.set(productRef, {
    name: payload.name,
    slug: payload.slug,
    category_id: payload.category_id,
    category_name: payload.category_name,
    brand_id: payload.brand_id,
    brand_name: payload.brand_name,
    seo_title: payload.seo_title || "",
    seo_description: payload.seo_description || "",
    seo_image: payload.seo_image || "",
    cost_price: payload.cost_price,
    sell_price: payload.sell_price,
    condition: payload.condition || "GOOD",
    shutter: payload.shutter ?? null,
    defect_detail: payload.defect_detail || "",
    free_gift_detail: payload.free_gift_detail || "",
    cover_image: payload.cover_image || "",
    images: payload.images || [],
    status,
    show,
    is_sellable: status === "ACTIVE",
    last_status_before_sold: null,
    sold_at: null,
    sold_price: null,
    sold_channel: null,
    sold_ref: null,
    is_deleted: false,
    deleted_at: null,
    created_at: TS(),
    updated_at: TS(),
  });
  batch.set(db.collection("dashboard_stats").doc("global"), {
    total_products: admin.firestore.FieldValue.increment(1),
    active_products: admin.firestore.FieldValue.increment(status === "ACTIVE" ? 1 : 0),
    reserved_products: admin.firestore.FieldValue.increment(status === "RESERVED" ? 1 : 0),
    sold_products: admin.firestore.FieldValue.increment(status === "SOLD" ? 1 : 0),
    visible_products: admin.firestore.FieldValue.increment(show ? 1 : 0),
    updated_at: TS(),
  }, { merge: true });
  await batch.commit();
  return productRef.id;
}

async function updateProduct(productId, patch) {
  const productRef = db.collection("products").doc(productId);
  const snap = await productRef.get();
  if (!snap.exists) throw new Error("Product not found");
  const current = snap.data();
  if (current.is_deleted) throw new Error("Product not found");

  const next = { ...current, ...patch };
  if (current.show) {
    const mappingSnap = await db.collection("category_brands").doc(`${next.category_id}__${next.brand_id}`).get();
    if (!mappingSnap.exists || mappingSnap.data().is_active === false) throw new Error("Product category-brand mapping invalid");
    const hasImage = (typeof next.cover_image === "string" && next.cover_image.trim()) || (Array.isArray(next.images) && next.images.length > 0);
    if (!hasImage) throw new Error("Public products require at least one image");
  }

  await productRef.update({
    ...patch,
    updated_at: TS(),
  });
}

async function toggleShow(productId, nextShow) {
  const productRef = db.collection("products").doc(productId);
  const snap = await productRef.get();
  if (!snap.exists) throw new Error("Product not found");
  const current = snap.data();
  if (current.is_deleted) throw new Error("Product not found");
  if (Boolean(current.show) === nextShow) return;
  if (nextShow) {
    const mappingSnap = await db.collection("category_brands").doc(`${current.category_id}__${current.brand_id}`).get();
    if (!mappingSnap.exists || mappingSnap.data().is_active === false) throw new Error("Product category-brand mapping invalid");
    const hasImage = (typeof current.cover_image === "string" && current.cover_image.trim()) || (Array.isArray(current.images) && current.images.length > 0);
    if (!hasImage) throw new Error("Public products require at least one image");
  }
  const batch = db.batch();
  batch.update(productRef, { show: nextShow, updated_at: TS() });
  batch.set(db.collection("dashboard_stats").doc("global"), {
    visible_products: admin.firestore.FieldValue.increment(nextShow ? 1 : -1),
    updated_at: TS(),
  }, { merge: true });
  await batch.commit();
}

async function setReserved(productId) {
  const productRef = db.collection("products").doc(productId);
  const snap = await productRef.get();
  if (!snap.exists) throw new Error("Product not found");
  const current = snap.data();
  if (current.is_deleted) throw new Error("Cannot reserve deleted product");
  if (current.status === "SOLD") throw new Error("Cannot reserve sold product");
  if (current.status === "RESERVED") return;
  const batch = db.batch();
  batch.update(productRef, { status: "RESERVED", is_sellable: false, updated_at: TS() });
  batch.set(db.collection("dashboard_stats").doc("global"), {
    active_products: admin.firestore.FieldValue.increment(-1),
    reserved_products: admin.firestore.FieldValue.increment(1),
    updated_at: TS(),
  }, { merge: true });
  await batch.commit();
}

async function setActive(productId) {
  const productRef = db.collection("products").doc(productId);
  const snap = await productRef.get();
  if (!snap.exists) throw new Error("Product not found");
  const current = snap.data();
  if (current.is_deleted) throw new Error("Cannot activate deleted product");
  if (current.status === "SOLD") throw new Error("Cannot set active for sold product");
  if (current.status === "ACTIVE") return;
  const batch = db.batch();
  batch.update(productRef, { status: "ACTIVE", is_sellable: true, updated_at: TS() });
  batch.set(db.collection("dashboard_stats").doc("global"), {
    active_products: admin.firestore.FieldValue.increment(1),
    reserved_products: admin.firestore.FieldValue.increment(-1),
    updated_at: TS(),
  }, { merge: true });
  await batch.commit();
}

async function deleteProduct(productId) {
  const productRef = db.collection("products").doc(productId);
  const snap = await productRef.get();
  if (!snap.exists) throw new Error("Product not found");
  const current = snap.data();
  if (current.is_deleted) return;
  if ((current.status || "ACTIVE") !== "ACTIVE") throw new Error("Only active products can be deleted");
  const batch = db.batch();
  batch.update(productRef, {
    is_deleted: true,
    deleted_at: TS(),
    show: false,
    is_sellable: false,
    updated_at: TS(),
  });
  batch.set(db.collection("dashboard_stats").doc("global"), {
    total_products: admin.firestore.FieldValue.increment(-1),
    active_products: admin.firestore.FieldValue.increment(-1),
    reserved_products: admin.firestore.FieldValue.increment(0),
    sold_products: admin.firestore.FieldValue.increment(0),
    visible_products: admin.firestore.FieldValue.increment(current.show ? -1 : 0),
    updated_at: TS(),
  }, { merge: true });
  await batch.commit();
}

async function confirmSale(productId, soldPrice, soldChannel, fee = 0, idempotencyKey) {
  const orderRef = idempotencyKey ? db.collection("orders").doc(idempotencyKey) : db.collection("orders").doc();
  await db.runTransaction(async (tx) => {
    const ledgerRef = db.collection("stats_ledger").doc(`SALE_APPLIED_${orderRef.id}`);
    const ledgerSnap = await tx.get(ledgerRef);
    if (ledgerSnap.exists) return;

    const existingOrderSnap = await tx.get(orderRef);
    if (existingOrderSnap.exists) {
      if (existingOrderSnap.data().status === "CONFIRMED") return;
      throw new Error("Order already exists");
    }

    const productRef = db.collection("products").doc(productId);
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists) throw new Error("Product not found");
    const product = productSnap.data();
    if (product.is_deleted) throw new Error("Cannot sell deleted product");
    if (product.is_sellable === false) throw new Error("Product is not sellable");
    const status = product.status || "ACTIVE";
    if (status !== "ACTIVE" && status !== "RESERVED") throw new Error("Unsupported product status");

    const prevStatus = status;
    const costAtSale = Number(product.cost_price || 0);
    const profit = Number(soldPrice) - costAtSale - Number(fee || 0);

    tx.set(orderRef, {
      status: "CONFIRMED",
      product_id: productId,
      previous_product_status: prevStatus,
      category_id: product.category_id,
      brand_id: product.brand_id,
      brand_name: product.brand_name,
      sold_channel: soldChannel,
      sold_price: Number(soldPrice),
      sold_yyyymm: monthKey(),
      cost_price_at_sale: costAtSale,
      fee: Number(fee || 0),
      profit,
      sold_at: TS(),
      created_at: TS(),
      updated_at: TS(),
      product_snapshot: {
        name: product.name,
        slug: product.slug,
        cover_image: product.cover_image || "",
        category_name: product.category_name,
        brand_name: product.brand_name,
      },
    });
    tx.update(productRef, {
      status: "SOLD",
      is_sellable: false,
      last_status_before_sold: prevStatus,
      sold_at: TS(),
      sold_price: Number(soldPrice),
      sold_channel: soldChannel,
      sold_ref: orderRef.id,
      updated_at: TS(),
    });
    tx.set(db.collection("dashboard_stats").doc("global"), {
      sold_products: admin.firestore.FieldValue.increment(1),
      active_products: admin.firestore.FieldValue.increment(prevStatus === "ACTIVE" ? -1 : 0),
      reserved_products: admin.firestore.FieldValue.increment(prevStatus === "RESERVED" ? -1 : 0),
      total_sales_count: admin.firestore.FieldValue.increment(1),
      total_sales_amount: admin.firestore.FieldValue.increment(Number(soldPrice)),
      total_cost_amount: admin.firestore.FieldValue.increment(costAtSale),
      total_profit_amount: admin.firestore.FieldValue.increment(profit),
      updated_at: TS(),
    }, { merge: true });
    tx.set(db.collection("dashboard_brand_stats").doc(String(product.brand_id)), {
      brand_id: product.brand_id,
      brand_name: product.brand_name,
      sales_count: admin.firestore.FieldValue.increment(1),
      sales_amount: admin.firestore.FieldValue.increment(Number(soldPrice)),
      cost_amount: admin.firestore.FieldValue.increment(costAtSale),
      profit_amount: admin.firestore.FieldValue.increment(profit),
      updated_at: TS(),
    }, { merge: true });
    tx.set(ledgerRef, { type: "SALE_APPLIED", ref_id: orderRef.id, created_at: TS() }, { merge: true });
  });
  return orderRef.id;
}

async function undoSale(orderId) {
  await db.runTransaction(async (tx) => {
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new Error("Order not found");
    const order = orderSnap.data();
    if (order.status === "CANCELLED") return;

    const ledgerRef = db.collection("stats_ledger").doc(`SALE_REVERTED_${orderId}`);
    const ledgerSnap = await tx.get(ledgerRef);
    if (ledgerSnap.exists) return;

    const productRef = db.collection("products").doc(String(order.product_id));
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists) throw new Error("Product not found");
    const product = productSnap.data();
    const restoreStatus = order.previous_product_status || product.last_status_before_sold || "ACTIVE";

    tx.update(orderRef, { status: "CANCELLED", updated_at: TS() });
    tx.update(productRef, {
      status: restoreStatus,
      is_sellable: restoreStatus === "ACTIVE",
      last_status_before_sold: null,
      sold_at: null,
      sold_price: null,
      sold_channel: null,
      sold_ref: null,
      updated_at: TS(),
    });
    tx.set(db.collection("dashboard_stats").doc("global"), {
      sold_products: admin.firestore.FieldValue.increment(-1),
      active_products: admin.firestore.FieldValue.increment(restoreStatus === "ACTIVE" ? 1 : 0),
      reserved_products: admin.firestore.FieldValue.increment(restoreStatus === "RESERVED" ? 1 : 0),
      total_sales_count: admin.firestore.FieldValue.increment(-1),
      total_sales_amount: admin.firestore.FieldValue.increment(-Number(order.sold_price || 0)),
      total_cost_amount: admin.firestore.FieldValue.increment(-Number(order.cost_price_at_sale || 0)),
      total_profit_amount: admin.firestore.FieldValue.increment(-Number(order.profit || 0)),
      updated_at: TS(),
    }, { merge: true });
    tx.set(db.collection("dashboard_brand_stats").doc(String(order.brand_id)), {
      brand_id: order.brand_id,
      brand_name: order.brand_name,
      sales_count: admin.firestore.FieldValue.increment(-1),
      sales_amount: admin.firestore.FieldValue.increment(-Number(order.sold_price || 0)),
      cost_amount: admin.firestore.FieldValue.increment(-Number(order.cost_price_at_sale || 0)),
      profit_amount: admin.firestore.FieldValue.increment(-Number(order.profit || 0)),
      updated_at: TS(),
    }, { merge: true });
    tx.set(ledgerRef, { type: "SALE_REVERTED", ref_id: orderId, created_at: TS() }, { merge: true });
  });
}

async function main() {
  const results = [];
  const prefix = `phase1-${Date.now()}`;
  const mappings = await getActiveMappings();
  if (mappings.length < 2) throw new Error("Need at least two active category-brand mappings");
  const primary = mappings[0];
  const alternate = mappings.find((item) => item.id !== primary.id) || mappings[0];

  const dashboardStart = await readDashboard();
  const createSlug = await getUniqueSlug(`${prefix}-create`);
  const createdProductId = await createProduct({
    name: `${prefix}-create`,
    slug: createSlug,
    category_id: primary.category_id,
    category_name: primary.category_name,
    brand_id: primary.brand_id,
    brand_name: primary.brand_name,
    cost_price: 10000,
    sell_price: 15000,
    condition: "GOOD",
    cover_image: placeholder(`${prefix}-cover-a`),
    images: [placeholder(`${prefix}-detail-a`), placeholder(`${prefix}-detail-b`)],
    show: true,
    status: "ACTIVE",
  });
  let dashboardAfter = await readDashboard();
  assertDelta(diffCounters(dashboardStart, dashboardAfter), {
    total_products: 1,
    active_products: 1,
    reserved_products: 0,
    sold_products: 0,
    visible_products: 1,
  }, "createProduct");
  results.push({ flow: "createProduct", status: "passed", productId: createdProductId });

  await updateProduct(createdProductId, {
    name: `${prefix}-edited`,
    slug: await getUniqueSlug(`${prefix}-edited`),
    category_id: alternate.category_id,
    category_name: alternate.category_name,
    brand_id: alternate.brand_id,
    brand_name: alternate.brand_name,
    cover_image: placeholder(`${prefix}-cover-b`),
    images: [placeholder(`${prefix}-detail-b`), placeholder(`${prefix}-detail-c`)],
    seo_title: `${prefix} seo`,
    condition: "LIKE_NEW",
  });
  const updatedSnap = await db.collection("products").doc(createdProductId).get();
  const updated = updatedSnap.data();
  if (updated.name !== `${prefix}-edited`) throw new Error("editProduct: name not updated");
  if (updated.brand_id !== alternate.brand_id) throw new Error("editProduct: brand mapping not updated");
  if (!Array.isArray(updated.images) || updated.images.length !== 2 || !String(updated.images[1]).includes("detail-c")) {
    throw new Error("editProduct: image ordering not updated");
  }
  dashboardAfter = await readDashboard();
  assertDelta(diffCounters(dashboardStart, dashboardAfter), {
    total_products: 1,
    active_products: 1,
    reserved_products: 0,
    sold_products: 0,
    visible_products: 1,
    total_sales_count: 0,
  }, "editProduct");
  results.push({ flow: "editProduct", status: "passed", productId: createdProductId });

  const beforeHide = await readDashboard();
  await toggleShow(createdProductId, false);
  const afterHide = await readDashboard();
  assertDelta(diffCounters(beforeHide, afterHide), { visible_products: -1 }, "toggleShow(false)");
  const hidden = (await db.collection("products").doc(createdProductId).get()).data();
  if (hidden.show !== false) throw new Error("toggleShow(false): product.show not updated");
  results.push({ flow: "toggleShowFalse", status: "passed", productId: createdProductId });

  const beforeShow = await readDashboard();
  await toggleShow(createdProductId, true);
  const afterShow = await readDashboard();
  assertDelta(diffCounters(beforeShow, afterShow), { visible_products: 1 }, "toggleShow(true)");
  const visibleAgain = (await db.collection("products").doc(createdProductId).get()).data();
  if (visibleAgain.show !== true) throw new Error("toggleShow(true): product.show not updated");
  results.push({ flow: "toggleShowTrue", status: "passed", productId: createdProductId });

  const beforeReserve = await readDashboard();
  await setReserved(createdProductId);
  const afterReserve = await readDashboard();
  assertDelta(diffCounters(beforeReserve, afterReserve), { active_products: -1, reserved_products: 1 }, "setReserved");
  const reserved = (await db.collection("products").doc(createdProductId).get()).data();
  if (reserved.status !== "RESERVED" || reserved.is_sellable !== false) throw new Error("setReserved: product status invalid");
  results.push({ flow: "setReserved", status: "passed", productId: createdProductId });

  const beforeActive = await readDashboard();
  await setActive(createdProductId);
  const afterActive = await readDashboard();
  assertDelta(diffCounters(beforeActive, afterActive), { active_products: 1, reserved_products: -1 }, "setActive");
  const active = (await db.collection("products").doc(createdProductId).get()).data();
  if (active.status !== "ACTIVE" || active.is_sellable !== true) throw new Error("setActive: product status invalid");
  results.push({ flow: "setActive", status: "passed", productId: createdProductId });

  const beforeDelete = await readDashboard();
  await deleteProduct(createdProductId);
  const afterDelete = await readDashboard();
  assertDelta(diffCounters(beforeDelete, afterDelete), { total_products: -1, active_products: -1, visible_products: -1 }, "deleteProduct");
  const deleted = (await db.collection("products").doc(createdProductId).get()).data();
  if (!deleted.is_deleted || deleted.show !== false || deleted.is_sellable !== false) throw new Error("deleteProduct: product flags invalid");
  results.push({ flow: "deleteProduct", status: "passed", productId: createdProductId });

  const saleSlug = await getUniqueSlug(`${prefix}-sale`);
  const saleProductId = await createProduct({
    name: `${prefix}-sale`,
    slug: saleSlug,
    category_id: primary.category_id,
    category_name: primary.category_name,
    brand_id: primary.brand_id,
    brand_name: primary.brand_name,
    cost_price: 12000,
    sell_price: 17000,
    condition: "GOOD",
    cover_image: placeholder(`${prefix}-sale-cover`),
    images: [placeholder(`${prefix}-sale-detail`)],
    show: true,
    status: "ACTIVE",
  });
  const beforeSale = await readDashboard();
  const orderId = `${prefix}-order`;
  await confirmSale(saleProductId, 18000, "LINE", 500, orderId);
  const afterSale = await readDashboard();
  assertDelta(diffCounters(beforeSale, afterSale), {
    sold_products: 1,
    active_products: -1,
    total_sales_count: 1,
    total_sales_amount: 18000,
    total_cost_amount: 12000,
    total_profit_amount: 5500,
  }, "confirmSale");
  const soldProduct = (await db.collection("products").doc(saleProductId).get()).data();
  const orderSnap = await db.collection("orders").doc(orderId).get();
  const saleLedgerSnap = await db.collection("stats_ledger").doc(`SALE_APPLIED_${orderId}`).get();
  if (soldProduct.status !== "SOLD" || soldProduct.sold_ref !== orderId) throw new Error("confirmSale: product status invalid");
  if (!orderSnap.exists || orderSnap.data().status !== "CONFIRMED") throw new Error("confirmSale: order missing");
  if (!saleLedgerSnap.exists) throw new Error("confirmSale: sale ledger missing");
  results.push({ flow: "confirmSale", status: "passed", productId: saleProductId, orderId });

  const beforeRepeatSale = await readDashboard();
  await confirmSale(saleProductId, 18000, "LINE", 500, orderId);
  const afterRepeatSale = await readDashboard();
  assertDelta(diffCounters(beforeRepeatSale, afterRepeatSale), {
    sold_products: 0,
    active_products: 0,
    reserved_products: 0,
    total_sales_count: 0,
    total_sales_amount: 0,
    total_cost_amount: 0,
    total_profit_amount: 0,
  }, "confirmSale idempotency");
  results.push({ flow: "confirmSaleIdempotency", status: "passed", productId: saleProductId, orderId });

  const beforeUndo = await readDashboard();
  await undoSale(orderId);
  const afterUndo = await readDashboard();
  assertDelta(diffCounters(beforeUndo, afterUndo), {
    sold_products: -1,
    active_products: 1,
    total_sales_count: -1,
    total_sales_amount: -18000,
    total_cost_amount: -12000,
    total_profit_amount: -5500,
  }, "undoSale");
  const restoredProduct = (await db.collection("products").doc(saleProductId).get()).data();
  const cancelledOrder = (await db.collection("orders").doc(orderId).get()).data();
  const revertLedgerSnap = await db.collection("stats_ledger").doc(`SALE_REVERTED_${orderId}`).get();
  if (restoredProduct.status !== "ACTIVE" || restoredProduct.sold_ref !== null) throw new Error("undoSale: product not restored");
  if (cancelledOrder.status !== "CANCELLED") throw new Error("undoSale: order not cancelled");
  if (!revertLedgerSnap.exists) throw new Error("undoSale: revert ledger missing");
  results.push({ flow: "undoSale", status: "passed", productId: saleProductId, orderId });

  const beforeRepeatUndo = await readDashboard();
  await undoSale(orderId);
  const afterRepeatUndo = await readDashboard();
  assertDelta(diffCounters(beforeRepeatUndo, afterRepeatUndo), {
    sold_products: 0,
    active_products: 0,
    reserved_products: 0,
    total_sales_count: 0,
    total_sales_amount: 0,
    total_cost_amount: 0,
    total_profit_amount: 0,
  }, "undoSale idempotency");
  results.push({ flow: "undoSaleIdempotency", status: "passed", productId: saleProductId, orderId });

  console.log(JSON.stringify({ databaseId, prefix, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
