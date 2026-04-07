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
const serviceAccountPath = path.join(projectRoot, "serviceAccountKey.json");

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
const serviceAccount = require(serviceAccountPath);

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || serviceAccount.project_id,
});

const db = getFirestore(app, databaseId);

function monthKeyFromDate(input) {
  const date = input instanceof Date ? input : new Date(input);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pushIssue(issues, severity, code, message, context = {}) {
  issues.push({ severity, code, message, context });
}

async function main() {
  const [
    categoriesSnap,
    brandsSnap,
    categoryBrandsSnap,
    productsSnap,
    ordersSnap,
    ledgerSnap,
    dashboardSnap,
    dashboardBrandStatsSnap,
  ] = await Promise.all([
    db.collection("categories").get(),
    db.collection("brands").get(),
    db.collection("category_brands").get(),
    db.collection("products").get(),
    db.collection("orders").get(),
    db.collection("stats_ledger").get(),
    db.collection("dashboard_stats").doc("global").get(),
    db.collection("dashboard_brand_stats").get(),
  ]);

  const categories = new Map(categoriesSnap.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]));
  const brands = new Map(brandsSnap.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]));
  const categoryBrands = new Map(categoryBrandsSnap.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]));
  const products = productsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const orders = ordersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const ledgers = new Map(ledgerSnap.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]));
  const dashboard = dashboardSnap.exists ? dashboardSnap.data() : null;
  const dashboardBrandStats = new Map(dashboardBrandStatsSnap.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]));

  const issues = [];
  const seenSkus = new Map();

  for (const mapping of categoryBrands.values()) {
    if (!categories.has(mapping.category_id)) {
      pushIssue(issues, "error", "missing_category", "category_brands references missing category", { mappingId: mapping.id, category_id: mapping.category_id });
    }
    if (!brands.has(mapping.brand_id)) {
      pushIssue(issues, "error", "missing_brand", "category_brands references missing brand", { mappingId: mapping.id, brand_id: mapping.brand_id });
    }
  }

  for (const product of products) {
    const status = product.status || "ACTIVE";
    const isDeleted = Boolean(product.is_deleted);
    const isVisible = Boolean(product.show);
    const mappingId = `${product.category_id}__${product.brand_id}`;
    const mapping = categoryBrands.get(mappingId);
    const sku = String(product.sku ?? "").trim();
    const skuSeq = Number(product.sku_seq);

    if (!/^RBC-\d{3,}$/.test(sku)) {
      pushIssue(issues, "error", "invalid_product_sku", "Product SKU is missing or invalid", { productId: product.id, sku });
    }
    if (!Number.isInteger(skuSeq) || skuSeq <= 0) {
      pushIssue(issues, "error", "invalid_product_sku_seq", "Product sku_seq is missing or invalid", { productId: product.id, sku_seq: product.sku_seq });
    }
    if (sku) {
      const previousProductId = seenSkus.get(sku);
      if (previousProductId && previousProductId !== product.id) {
        pushIssue(issues, "error", "duplicate_product_sku", "Duplicate product SKU detected", { productId: product.id, sku, previousProductId });
      } else {
        seenSkus.set(sku, product.id);
      }
    }

    if (isDeleted && isVisible) {
      pushIssue(issues, "error", "deleted_visible", "Soft-deleted product is still visible", { productId: product.id });
    }
    if (isDeleted && product.is_sellable !== false) {
      pushIssue(issues, "error", "deleted_sellable", "Soft-deleted product is still sellable", { productId: product.id });
    }
    if (isVisible && !mapping) {
      pushIssue(issues, "error", "visible_missing_mapping", "Visible product is missing category-brand mapping", { productId: product.id, mappingId });
    }
    if (isVisible && mapping && mapping.is_active === false) {
      pushIssue(issues, "error", "visible_inactive_mapping", "Visible product uses inactive category-brand mapping", { productId: product.id, mappingId });
    }
    if (isVisible) {
      const hasImage = typeof product.cover_image === "string" && product.cover_image.trim()
        ? true
        : Array.isArray(product.images) && product.images.some((url) => typeof url === "string" && url.trim());
      if (!hasImage) {
        pushIssue(issues, "error", "visible_no_image", "Visible product has no usable image", { productId: product.id });
      }
    }

    if (status === "SOLD") {
      if (!product.sold_ref) {
        pushIssue(issues, "error", "sold_missing_ref", "Sold product is missing sold_ref", { productId: product.id });
      }
      const order = orders.find((item) => item.id === product.sold_ref);
      if (!order) {
        pushIssue(issues, "error", "sold_missing_order", "Sold product references missing order", { productId: product.id, sold_ref: product.sold_ref });
      } else {
        const saleLedger = ledgers.get(`SALE_APPLIED_${order.id}`);
        if (!saleLedger) {
          pushIssue(issues, "error", "missing_sale_ledger", "Confirmed/captured sale is missing stats ledger", { orderId: order.id, productId: product.id });
        } else {
          if (saleLedger.entity_type !== "order" || saleLedger.entity_id !== order.id) {
            pushIssue(issues, "error", "sale_ledger_entity_mismatch", "Sale ledger entity payload is invalid", { ledgerId: saleLedger.id, orderId: order.id });
          }
          if (saleLedger.operation_key !== `SALE_APPLIED_${order.id}`) {
            pushIssue(issues, "error", "sale_ledger_operation_key_mismatch", "Sale ledger operation_key is invalid", { ledgerId: saleLedger.id, orderId: order.id });
          }
        }
      }
    }
  }

  for (const order of orders) {
    if (!order.product_id) {
      pushIssue(issues, "error", "order_missing_product", "Order is missing product_id", { orderId: order.id });
      continue;
    }

    const soldAt = toDate(order.sold_at);
    const saleLedger = ledgers.get(`SALE_APPLIED_${order.id}`);
    const revertLedger = ledgers.get(`SALE_REVERTED_${order.id}`);
    if (order.status === "CONFIRMED" && !saleLedger) {
      pushIssue(issues, "error", "confirmed_missing_sale_ledger", "Confirmed order is missing SALE_APPLIED ledger", { orderId: order.id });
    }
    if (order.status === "CANCELLED" && !revertLedger) {
      pushIssue(issues, "warn", "cancelled_missing_revert_ledger", "Cancelled order is missing SALE_REVERTED ledger", { orderId: order.id });
    }
    if (saleLedger && (saleLedger.entity_type !== "order" || saleLedger.entity_id !== order.id || saleLedger.operation_key !== `SALE_APPLIED_${order.id}`)) {
      pushIssue(issues, "error", "confirmed_sale_ledger_shape_invalid", "Confirmed order ledger payload is invalid", { ledgerId: saleLedger.id, orderId: order.id });
    }
    if (revertLedger && (revertLedger.entity_type !== "order" || revertLedger.entity_id !== order.id || revertLedger.operation_key !== `SALE_REVERTED_${order.id}`)) {
      pushIssue(issues, "warn", "cancelled_revert_ledger_shape_invalid", "Cancelled order revert ledger payload is invalid", { ledgerId: revertLedger.id, orderId: order.id });
    }
    if (order.status === "CONFIRMED" && soldAt && order.sold_yyyymm !== monthKeyFromDate(soldAt)) {
      pushIssue(issues, "warn", "sold_month_mismatch", "Order sold_yyyymm does not match sold_at", { orderId: order.id, sold_yyyymm: order.sold_yyyymm });
    }
  }

  const expectedGlobal = {
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
    expectedGlobal.total_products += 1;
    if (product.show) expectedGlobal.visible_products += 1;
    if (product.status === "ACTIVE" || !product.status) expectedGlobal.active_products += 1;
    if (product.status === "RESERVED") expectedGlobal.reserved_products += 1;
    if (product.status === "SOLD") expectedGlobal.sold_products += 1;
  }

  const expectedBrandStats = new Map();
  for (const order of orders) {
    if (order.status !== "CONFIRMED") continue;
    expectedGlobal.total_sales_count += 1;
    expectedGlobal.total_sales_amount += Number(order.sold_price || 0);
    expectedGlobal.total_cost_amount += Number(order.cost_price_at_sale || 0);
    expectedGlobal.total_profit_amount += Number(order.profit || 0);

    const brandId = String(order.brand_id || "unknown");
    if (!expectedBrandStats.has(brandId)) {
      expectedBrandStats.set(brandId, {
        brand_id: brandId,
        sales_count: 0,
        sales_amount: 0,
        cost_amount: 0,
        profit_amount: 0,
      });
    }
    const stat = expectedBrandStats.get(brandId);
    stat.sales_count += 1;
    stat.sales_amount += Number(order.sold_price || 0);
    stat.cost_amount += Number(order.cost_price_at_sale || 0);
    stat.profit_amount += Number(order.profit || 0);
  }

  if (!dashboard) {
    pushIssue(issues, "error", "missing_dashboard_stats", "dashboard_stats/global document is missing");
  } else {
    for (const [key, value] of Object.entries(expectedGlobal)) {
      const actual = Number(dashboard[key] || 0);
      if (actual !== value) {
        pushIssue(issues, "error", "dashboard_mismatch", "dashboard_stats/global does not match derived values", {
          field: key,
          expected: value,
          actual,
        });
      }
    }
  }

  for (const [brandId, expected] of expectedBrandStats.entries()) {
    const actual = dashboardBrandStats.get(brandId);
    if (!actual) {
      pushIssue(issues, "warn", "missing_brand_dashboard_stats", "dashboard_brand_stats doc is missing for brand with confirmed sales", { brandId });
      continue;
    }
    for (const field of ["sales_count", "sales_amount", "cost_amount", "profit_amount"]) {
      if (Number(actual[field] || 0) !== Number(expected[field] || 0)) {
        pushIssue(issues, "error", "brand_dashboard_mismatch", "dashboard_brand_stats does not match confirmed order totals", {
          brandId,
          field,
          expected: Number(expected[field] || 0),
          actual: Number(actual[field] || 0),
        });
      }
    }
  }

  const counts = issues.reduce((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    databaseId,
    scanned: {
      categories: categories.size,
      brands: brands.size,
      category_brands: categoryBrands.size,
      products: products.length,
      orders: orders.length,
      stats_ledger: ledgers.size,
      dashboard_brand_stats: dashboardBrandStats.size,
    },
    issueCounts: counts,
    issues,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
