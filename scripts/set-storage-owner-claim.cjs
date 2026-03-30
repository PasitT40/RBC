const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(process.cwd(), "serviceAccountKey.json"));
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function main() {
  const uid = process.argv[2];
  const enabledArg = process.argv[3] ?? "true";

  if (!uid) {
    throw new Error("Usage: node scripts/set-storage-owner-claim.cjs <uid> [true|false]");
  }

  const enabled = enabledArg !== "false";
  const auth = admin.auth(app);
  const user = await auth.getUser(uid);
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
