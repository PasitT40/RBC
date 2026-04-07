const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");
const { reserveNextProductSku } = require("./lib/product-sku.cjs");

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

function normalizeProductSlug(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeProductImageUrls(urls) {
  const seen = new Set();
  const sanitized = [];
  for (const rawUrl of Array.isArray(urls) ? urls : []) {
    const url = String(rawUrl ?? "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    sanitized.push(url);
  }
  return sanitized;
}

function getPublicProductIssues(product) {
  const issues = [];
  const name = String(product.name ?? "").trim();
  const slug = String(product.slug ?? "").trim();
  const categoryId = String(product.category_id ?? "").trim();
  const brandId = String(product.brand_id ?? "").trim();
  const costPrice = Number(product.cost_price);
  const sellPrice = Number(product.sell_price);
  const condition = String(product.condition ?? "").trim();
  const defectDetail = String(product.defect_detail ?? "").trim();
  const freeGiftDetail = String(product.free_gift_detail ?? "").trim();
  const shutter = Number(product.shutter);
  const coverImage = String(product.cover_image ?? "").trim();
  const images = sanitizeProductImageUrls(product.images);
  const hasImage = Boolean(coverImage) || images.length > 0;

  if (!name) issues.push("กรุณาใส่ชื่อสินค้า");
  if (!slug) {
    issues.push("ยังสร้างลิงก์สินค้าไม่สำเร็จ ลองตรวจชื่อสินค้าอีกครั้ง");
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    issues.push("ลิงก์สินค้ายังไม่ถูกต้อง");
  }
  if (!categoryId) issues.push("กรุณาเลือกประเภทสินค้า");
  if (!brandId) issues.push("กรุณาเลือกแบรนด์");
  if (typeof product.cost_price !== "number" || Number.isNaN(costPrice)) {
    issues.push("กรุณาใส่ราคาทุน");
  }
  if (typeof product.sell_price !== "number" || Number.isNaN(sellPrice)) {
    issues.push("กรุณาใส่ราคาขาย");
  }
  if (!condition) issues.push("กรุณาระบุสภาพสินค้า");
  if (typeof product.shutter !== "number" || Number.isNaN(shutter)) {
    issues.push("กรุณาใส่จำนวนชัตเตอร์");
  }
  if (!defectDetail) issues.push("กรุณาใส่รายละเอียดตำหนิ");
  if (!freeGiftDetail) issues.push("กรุณาใส่ของแถม");
  if (!hasImage) issues.push("กรุณาใส่รูปสินค้าอย่างน้อย 1 รูป");

  return issues;
}

async function expectReject(fn, expectedMessage, label) {
  try {
    await fn();
  } catch (error) {
    if (expectedMessage && !String(error?.message || error).includes(expectedMessage)) {
      throw new Error(`${label}: expected error containing "${expectedMessage}" but got "${error?.message || error}"`);
    }
    return;
  }

  throw new Error(`${label}: expected rejection`);
}

const env = parseEnvFile(envPath);
const databaseId = env.FIRESTORE_DATABASE_ID || "(default)";
const app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = getFirestore(app, databaseId);
const TS = admin.firestore.FieldValue.serverTimestamp;

function placeholder(label) {
  return `https://placehold.co/1200x800.webp?text=${encodeURIComponent(label)}`;
}

async function getActiveMappings() {
  const snap = await db.collection("category_brands").where("is_active", "==", true).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function assertUniqueProductSlug(slug, excludeId) {
  const snap = await db.collection("products").where("slug", "==", slug).get();
  const hasDuplicate = snap.docs.some((docSnap) => {
    if (docSnap.id === excludeId) return false;
    return docSnap.data().is_deleted !== true;
  });
  if (hasDuplicate) throw new Error("Product slug already exists");
}

async function assertCategoryBrandMappingExists(categoryId, brandId) {
  if (!categoryId?.trim() || !brandId?.trim()) {
    throw new Error("Product category-brand mapping is required");
  }

  const mappingRef = db.collection("category_brands").doc(`${categoryId}__${brandId}`);
  const mappingSnap = await mappingRef.get();
  if (!mappingSnap.exists) throw new Error("Product category-brand mapping not found");
  if (mappingSnap.data().is_active === false) throw new Error("Product category-brand mapping is inactive");
}

async function createProduct(payload) {
  const productRef = db.collection("products").doc();
  const { sku, sku_seq } = await reserveNextProductSku(db, TS);
  const slug = normalizeProductSlug(payload.slug || payload.name);
  const status = payload.status || "ACTIVE";
  const show = payload.show ?? true;
  const images = sanitizeProductImageUrls(payload.images);
  const coverImage = String(payload.cover_image || images[0] || "").trim();

  await assertUniqueProductSlug(slug, payload.id);
  if (show) {
    const issues = getPublicProductIssues({ ...payload, slug, show, images, cover_image: coverImage });
    if (issues.length > 0) throw new Error(issues[0]);
    await assertCategoryBrandMappingExists(payload.category_id, payload.brand_id);
  }

  await productRef.set({
    sku,
    sku_seq,
    name: payload.name,
    slug,
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
    cover_image: coverImage,
    images,
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
  return productRef.id;
}

async function toggleShow(productId, nextShow) {
  const productRef = db.collection("products").doc(productId);
  const snap = await productRef.get();
  if (!snap.exists) throw new Error("Product not found");
  const current = snap.data();
  if (current.is_deleted) throw new Error("Product not found");

  if (nextShow) {
    const issues = getPublicProductIssues({ ...current, show: true });
    if (issues.length > 0) throw new Error(issues[0]);
    await assertCategoryBrandMappingExists(current.category_id, current.brand_id);
  }

  await productRef.update({ show: nextShow, updated_at: TS() });
}

async function softDelete(productId) {
  const productRef = db.collection("products").doc(productId);
  await productRef.update({
    is_deleted: true,
    show: false,
    is_sellable: false,
    deleted_at: TS(),
    updated_at: TS(),
  });
}

async function main() {
  const results = [];
  const prefix = `phase3-${Date.now()}`;
  const mappings = await getActiveMappings();
  if (mappings.length < 1) throw new Error("Need at least one active category-brand mapping");
  const primary = mappings[0];

  const normalizedSlug = normalizeProductSlug(" Canon EOS 5D !!! ");
  if (normalizedSlug !== "canon-eos-5d") {
    throw new Error(`normalize slug: expected canon-eos-5d but got ${normalizedSlug}`);
  }
  results.push({ flow: "slugNormalization", status: "passed", slug: normalizedSlug });

  const draftId = await createProduct({
    name: `${prefix} draft`,
    slug: `${prefix} draft`,
    category_id: primary.category_id,
    category_name: primary.category_name,
    brand_id: primary.brand_id,
    brand_name: primary.brand_name,
    cost_price: 1000,
    sell_price: 2000,
    condition: "GOOD",
    shutter: 1234,
    defect_detail: "minor scratch",
    free_gift_detail: "battery",
    images: [],
    show: false,
    status: "ACTIVE",
  });
  const draftSnap = await db.collection("products").doc(draftId).get();
  if (!draftSnap.exists || draftSnap.data().show !== false) throw new Error("draft create: expected hidden product");
  results.push({ flow: "hiddenDraftAllowed", status: "passed", productId: draftId });

  await expectReject(
    () => createProduct({
      name: `${prefix} visible no image`,
      slug: `${prefix} visible no image`,
      category_id: primary.category_id,
      category_name: primary.category_name,
      brand_id: primary.brand_id,
      brand_name: primary.brand_name,
      cost_price: 1000,
      sell_price: 2000,
      condition: "GOOD",
      shutter: 1234,
      defect_detail: "minor scratch",
      free_gift_detail: "battery",
      images: [],
      show: true,
      status: "ACTIVE",
    }),
    "กรุณาใส่รูปสินค้าอย่างน้อย 1 รูป",
    "visible create missing image"
  );
  results.push({ flow: "visibleCreateRequiresImage", status: "passed" });

  const publishedId = await createProduct({
    name: `${prefix} published`,
    slug: `${prefix} published`,
    category_id: primary.category_id,
    category_name: primary.category_name,
    brand_id: primary.brand_id,
    brand_name: primary.brand_name,
    cost_price: 1000,
    sell_price: 2000,
    condition: "GOOD",
    shutter: 1234,
    defect_detail: "minor scratch",
    free_gift_detail: "battery",
    images: [placeholder(`${prefix}-published`)],
    show: true,
    status: "ACTIVE",
  });
  results.push({ flow: "publishedCreate", status: "passed", productId: publishedId });

  await expectReject(
    () => createProduct({
      name: `${prefix} duplicate`,
      slug: `${prefix} published`,
      category_id: primary.category_id,
      category_name: primary.category_name,
      brand_id: primary.brand_id,
      brand_name: primary.brand_name,
      cost_price: 1000,
      sell_price: 2000,
      condition: "GOOD",
      shutter: 1234,
      defect_detail: "minor scratch",
      free_gift_detail: "battery",
      images: [placeholder(`${prefix}-duplicate`)],
      show: true,
      status: "ACTIVE",
    }),
    "Product slug already exists",
    "duplicate slug create"
  );
  results.push({ flow: "duplicateSlugRejected", status: "passed" });

  await expectReject(
    () => toggleShow(draftId, true),
    "กรุณาใส่รูปสินค้าอย่างน้อย 1 รูป",
    "toggleShow draft to visible without image"
  );
  results.push({ flow: "toggleShowRequiresPublishReadiness", status: "passed", productId: draftId });

  await softDelete(publishedId);

  const recycledSlugId = await createProduct({
    name: `${prefix} recycled slug`,
    slug: `${prefix} published`,
    category_id: primary.category_id,
    category_name: primary.category_name,
    brand_id: primary.brand_id,
    brand_name: primary.brand_name,
    cost_price: 1000,
    sell_price: 2000,
    condition: "GOOD",
    shutter: 1234,
    defect_detail: "minor scratch",
    free_gift_detail: "battery",
    images: [placeholder(`${prefix}-recycled-slug`)],
    show: true,
    status: "ACTIVE",
  });
  results.push({ flow: "deletedSlugCanBeReused", status: "passed", productId: recycledSlugId });

  await expectReject(
    () => toggleShow(publishedId, true),
    "Product not found",
    "deleted product cannot be republished"
  );
  results.push({ flow: "deletedProductStaysHidden", status: "passed", productId: publishedId });

  console.log(JSON.stringify({ databaseId, prefix, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
