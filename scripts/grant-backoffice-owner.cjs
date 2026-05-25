const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();

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

function parseArgs(rawArgs) {
  const args = {
    allowProduction: false,
    revoke: false,
    email: "",
  };

  for (const arg of rawArgs) {
    if (arg === "--allow-production") {
      args.allowProduction = true;
    } else if (arg === "--revoke") {
      args.revoke = true;
    } else if (!arg.startsWith("--") && !args.email) {
      args.email = arg;
    }
  }

  return args;
}

const args = parseArgs(process.argv.slice(2));
const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
const env = parseEnvFile(resolveEnvPath(projectRoot));
const databaseId = env.FIRESTORE_DATABASE_ID || "(default)";
const serviceAccountFile = env.SERVICE_ACCOUNT_KEY_FILE || "serviceAccountKey.json";
const serviceAccountPath = path.join(projectRoot, serviceAccountFile);

if (!args.email) {
  throw new Error("Usage: node scripts/grant-backoffice-owner.cjs <email> [--revoke] [--allow-production]");
}

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error(`Missing service account file: ${serviceAccountPath}`);
}

if (appEnv === "production" && !args.allowProduction) {
  throw new Error("grant-backoffice-owner.cjs blocks production by default. Use --allow-production explicitly.");
}

const serviceAccount = require(serviceAccountPath);
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const auth = admin.auth(app);
const db = getFirestore(app, databaseId);

async function getUserByEmailCandidates(email) {
  const normalizedEmail = email.toLowerCase();
  const candidates = Array.from(new Set([email, normalizedEmail]));
  let lastError = null;

  for (const candidate of candidates) {
    try {
      return await auth.getUserByEmail(candidate);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
      lastError = error;
    }
  }

  const notFoundError = new Error(
    `Firebase Auth user not found for ${email}. Ask the user to sign in with Google once, then rerun this script.`
  );
  notFoundError.cause = lastError;
  throw notFoundError;
}

async function main() {
  const email = args.email.trim();
  const user = await getUserByEmailCandidates(email);
  const ownerRef = db.collection("owners").doc(user.uid);
  const enabled = !args.revoke;

  if (enabled) {
    await ownerRef.set(
      {
        email: user.email || email.toLowerCase(),
        display_name: user.displayName || "",
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    await ownerRef.delete();
  }

  await auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    backoffice_owner: enabled,
  });

  const refreshedUser = await auth.getUser(user.uid);
  const ownerSnap = await ownerRef.get();

  console.log(JSON.stringify({
    appEnv,
    projectId: serviceAccount.project_id || null,
    databaseId,
    uid: refreshedUser.uid,
    email: refreshedUser.email || null,
    ownerDocumentExists: ownerSnap.exists,
    customClaims: refreshedUser.customClaims || {},
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
