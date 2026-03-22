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

function placeholderFor(product) {
  const label = encodeURIComponent(product.slug || product.name || product.id);
  return `https://placehold.co/1200x800.webp?text=${label}`;
}

async function main() {
  const snap = await db.collection("products").get();
  const targets = snap.docs.filter((doc) => {
    const data = doc.data();
    const hasCover = typeof data.cover_image === "string" && data.cover_image.trim().length > 0;
    const hasImages = Array.isArray(data.images) && data.images.some((url) => typeof url === "string" && url.trim().length > 0);
    return Boolean(data.show) && !hasCover && !hasImages;
  });

  for (let i = 0; i < targets.length; i += 400) {
    const batch = db.batch();
    for (const docSnap of targets.slice(i, i + 400)) {
      const data = { id: docSnap.id, ...docSnap.data() };
      const imageUrl = placeholderFor(data);
      batch.update(docSnap.ref, {
        cover_image: imageUrl,
        images: [imageUrl],
        updated_at: TS(),
      });
    }
    await batch.commit();
  }

  console.log(JSON.stringify({ databaseId, updated: targets.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
