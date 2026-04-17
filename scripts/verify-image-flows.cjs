const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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
const bucketName = databaseId === "ratchaburi-camera-prod"
  ? (env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET_PROD || env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET || serviceAccount.storage_bucket)
  : databaseId === "ratchaburi-camera-dev"
    ? (env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEV || env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET || serviceAccount.storage_bucket)
    : (env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET || serviceAccount.storage_bucket);
if (!bucketName) {
  throw new Error("Missing Firebase storage bucket configuration");
}
const normalizedBucketName = bucketName.replace(/^gs:\/\//, "");

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: normalizedBucketName,
});
const db = getFirestore(app, databaseId);
const bucket = admin.storage(app).bucket(normalizedBucketName);
const TS = admin.firestore.FieldValue.serverTimestamp;

function makeDownloadUrl(filePath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
}

async function uploadPlaceholder(folderPath, label) {
  const token = crypto.randomUUID();
  const filePath = `${folderPath}/${Date.now()}-${label}.webp`;
  const file = bucket.file(filePath);
  await file.save(Buffer.from(`fake-image:${label}`), {
    resumable: false,
    metadata: {
      contentType: "image/webp",
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });
  return {
    filePath,
    url: makeDownloadUrl(filePath, token),
  };
}

async function fileExists(filePath) {
  const [exists] = await bucket.file(filePath).exists();
  return exists;
}

async function deleteFilePath(filePath) {
  if (!filePath) return;
  const file = bucket.file(filePath);
  const [exists] = await file.exists();
  if (exists) {
    await file.delete();
  }
}

async function deleteFolder(folderPath) {
  const [files] = await bucket.getFiles({ prefix: `${folderPath}/` });
  await Promise.all(files.map((file) => file.delete().catch(() => undefined)));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function verifyCategoryFlow(prefix) {
  const categoryRef = db.collection("categories").doc(`${prefix}-category`);
  const categoryId = categoryRef.id;
  const folder = `categories/${categoryId}`;

  await categoryRef.set({
    name: `${prefix}-category`,
    slug: `${prefix}-category`,
    image_url: null,
    seo_title: "",
    seo_description: "",
    seo_image: null,
    is_active: true,
    order: 9999,
    created_at: TS(),
    updated_at: TS(),
  }, { merge: true });

  const first = await uploadPlaceholder(folder, "first");
  await categoryRef.update({ image_url: first.url, updated_at: TS() });
  assert(await fileExists(first.filePath), "category create/upload: first file missing from storage");
  let snap = await categoryRef.get();
  assert(snap.data().image_url === first.url, "category create/upload: image_url not persisted");

  const second = await uploadPlaceholder(folder, "second");
  await categoryRef.update({ image_url: second.url, updated_at: TS() });
  await deleteFilePath(first.filePath);
  assert(!(await fileExists(first.filePath)), "category update: old file still exists");
  assert(await fileExists(second.filePath), "category update: new file missing from storage");
  snap = await categoryRef.get();
  assert(snap.data().image_url === second.url, "category update: image_url not replaced");

  await deleteFolder(folder);
  await categoryRef.delete();

  return { flow: "categoryImageReplace", status: "passed" };
}

async function verifyBrandFlow(prefix) {
  const categoryId = "camera";
  const brandRef = db.collection("brands").doc(`${prefix}-brand`);
  const mappingRef = db.collection("category_brands").doc(`${categoryId}__${brandRef.id}`);
  const folder = `brands/${brandRef.id}`;

  const first = await uploadPlaceholder(folder, "first");
  await brandRef.set({
    name: `${prefix}-brand`,
    slug: `${prefix}-brand`,
    image_url: first.url,
    seo_title: "",
    seo_description: "",
    seo_image: null,
    is_active: true,
    order: 9999,
    created_at: TS(),
    updated_at: TS(),
  }, { merge: true });
  await mappingRef.set({
    category_id: categoryId,
    category_name: "CAMERA",
    category_slug: "camera",
    brand_id: brandRef.id,
    brand_name: `${prefix}-brand`,
    brand_image_url: first.url,
    is_active: true,
    order: 9999,
    created_at: TS(),
    updated_at: TS(),
  }, { merge: true });
  assert(await fileExists(first.filePath), "brand create/upload: first file missing from storage");

  const second = await uploadPlaceholder(folder, "second");
  await brandRef.update({ image_url: second.url, updated_at: TS() });
  await mappingRef.update({ brand_image_url: second.url, updated_at: TS() });
  await deleteFilePath(first.filePath);
  assert(!(await fileExists(first.filePath)), "brand update: old file still exists");
  assert(await fileExists(second.filePath), "brand update: new file missing from storage");
  const brandSnap = await brandRef.get();
  const mappingSnap = await mappingRef.get();
  assert(brandSnap.data().image_url === second.url, "brand update: image_url not replaced");
  assert(mappingSnap.data().brand_image_url === second.url, "brand update: mapping image not replaced");

  await deleteFolder(folder);
  await mappingRef.delete();
  await brandRef.delete();

  return { flow: "brandImageReplace", status: "passed" };
}

async function verifyProductFlow(prefix) {
  const productRef = db.collection("products").doc(`${prefix}-product`);
  const folder = `products/${productRef.id}`;

  const first = await uploadPlaceholder(folder, "detail-a");
  const second = await uploadPlaceholder(folder, "detail-b");

  await productRef.set({
    name: `${prefix}-product`,
    slug: `${prefix}-product`,
    category_id: "camera",
    category_name: "CAMERA",
    brand_id: "canon",
    brand_name: "Canon",
    cost_price: 10000,
    sell_price: 15000,
    condition: "GOOD",
    cover_image: first.url,
    images: [first.url, second.url],
    status: "ACTIVE",
    show: false,
    is_sellable: true,
    is_deleted: false,
    created_at: TS(),
    updated_at: TS(),
  }, { merge: true });
  assert(await fileExists(first.filePath), "product create/upload: first file missing from storage");
  assert(await fileExists(second.filePath), "product create/upload: second file missing from storage");

  const third = await uploadPlaceholder(folder, "detail-c");
  await productRef.update({
    cover_image: third.url,
    images: [second.url, third.url],
    updated_at: TS(),
  });
  await deleteFilePath(first.filePath);
  assert(!(await fileExists(first.filePath)), "product update/remove: removed file still exists");
  assert(await fileExists(second.filePath), "product update/remove: retained file missing");
  assert(await fileExists(third.filePath), "product update/remove: new file missing");
  let snap = await productRef.get();
  assert(snap.data().cover_image === third.url, "product update/remove: cover_image not updated");
  assert(JSON.stringify(snap.data().images) === JSON.stringify([second.url, third.url]), "product update/remove: images ordering wrong");

  await productRef.update({
    cover_image: third.url,
    images: [third.url],
    updated_at: TS(),
  });
  await deleteFilePath(second.filePath);
  assert(!(await fileExists(second.filePath)), "product remove existing: stale file still exists");
  assert(await fileExists(third.filePath), "product remove existing: remaining file missing");
  snap = await productRef.get();
  assert(JSON.stringify(snap.data().images) === JSON.stringify([third.url]), "product remove existing: final images wrong");

  await deleteFolder(folder);
  await productRef.delete();

  return { flow: "productImageUploadUpdateRemove", status: "passed" };
}

async function main() {
  const prefix = `phase1-image-${Date.now()}`;
  const results = [];
  try {
    results.push(await verifyCategoryFlow(prefix));
    results.push(await verifyBrandFlow(prefix));
    results.push(await verifyProductFlow(prefix));
    console.log(JSON.stringify({ databaseId, bucket: bucket.name, prefix, results }, null, 2));
  } finally {
    await deleteFolder(`categories/${prefix}-category`).catch(() => undefined);
    await deleteFolder(`brands/${prefix}-brand`).catch(() => undefined);
    await deleteFolder(`products/${prefix}-product`).catch(() => undefined);
    await db.collection("categories").doc(`${prefix}-category`).delete().catch(() => undefined);
    await db.collection("category_brands").doc(`camera__${prefix}-brand`).delete().catch(() => undefined);
    await db.collection("brands").doc(`${prefix}-brand`).delete().catch(() => undefined);
    await db.collection("products").doc(`${prefix}-product`).delete().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
