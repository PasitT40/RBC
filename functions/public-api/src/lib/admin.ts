import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

let app: admin.app.App | null = null;

export function getAdminApp() {
  if (app) return app;

  app = admin.apps.length > 0 ? admin.app() : admin.initializeApp();
  return app;
}

export function getDb() {
  const firebaseApp = getAdminApp();
  const databaseId = process.env.FIRESTORE_DATABASE_ID || "(default)";
  return databaseId === "(default)" ? getFirestore(firebaseApp) : getFirestore(firebaseApp, databaseId);
}

export function getDbForDatabase(databaseId: string) {
  const firebaseApp = getAdminApp();
  return databaseId === "(default)" ? getFirestore(firebaseApp) : getFirestore(firebaseApp, databaseId);
}
