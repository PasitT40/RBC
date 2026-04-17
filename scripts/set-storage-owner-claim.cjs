const admin = require("firebase-admin");
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

const rawArgs = process.argv.slice(2);
const argv = new Set(rawArgs);
const positionalArgs = rawArgs.filter((arg) => !arg.startsWith("--"));
const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
const env = parseEnvFile(resolveEnvPath(projectRoot));
const databaseId = env.FIRESTORE_DATABASE_ID || "";
const serviceAccountFile = env.SERVICE_ACCOUNT_KEY_FILE || "serviceAccountKey.json";
const serviceAccountPath = path.join(projectRoot, serviceAccountFile);

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error(`Missing service account file: ${serviceAccountPath}`);
}

if (appEnv === "production" && !argv.has("--allow-production")) {
  throw new Error("set-storage-owner-claim.cjs blocks production by default. Use --allow-production explicitly.");
}

const serviceAccount = require(serviceAccountPath);
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function main() {
  const uid = positionalArgs[0];
  const enabledArg = positionalArgs[1] ?? "true";

  if (!uid) {
    throw new Error("Usage: node scripts/set-storage-owner-claim.cjs <uid> [true|false]");
  }

  const enabled = enabledArg !== "false";
  const auth = admin.auth(app);
  const user = await auth.getUser(uid);
  console.log(JSON.stringify({
    appEnv,
    projectId: serviceAccount.project_id || null,
    databaseId: databaseId || null,
    serviceAccountFile,
    uid,
    enabled,
  }, null, 2));
  const nextClaims = {
    ...(user.customClaims || {}),
    backoffice_owner: enabled,
  };

  await auth.setCustomUserClaims(uid, nextClaims);
  const refreshedUser = await auth.getUser(uid);

  console.log(JSON.stringify({
    uid,
    email: refreshedUser.email || null,
    customClaims: refreshedUser.customClaims || {},
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
