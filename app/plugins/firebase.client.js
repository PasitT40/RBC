import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, onIdTokenChanged, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const firestoreDatabaseId = String(config.public.firestoreDatabaseId || "").trim();
  if (!firestoreDatabaseId) {
    throw new Error("Missing NUXT_PUBLIC_FIRESTORE_DATABASE_ID");
  }

  const storageBucketByDatabaseId = {
    "ratchaburi-camera-prod": config.public.firebaseStorageBucketProd || config.public.firebaseStorageBucket,
    "ratchaburi-camera-dev": config.public.firebaseStorageBucketDev || config.public.firebaseStorageBucket,
  };
  const selectedStorageBucket = storageBucketByDatabaseId[firestoreDatabaseId];
  if (!selectedStorageBucket) {
    throw new Error(`Unsupported Firestore database id: ${firestoreDatabaseId}`);
  }

  const normalizedStorageBucket = selectedStorageBucket?.replace(/^gs:\/\//, "") || "";
  if (!normalizedStorageBucket) {
    throw new Error(`Missing storage bucket mapping for Firestore database id: ${firestoreDatabaseId}`);
  }
  const storageBucketUrl = normalizedStorageBucket ? `gs://${normalizedStorageBucket}` : "";

  const firebaseConfig = {
    apiKey: config.public.firebaseApiKey,
    authDomain: config.public.firebaseAuthDomain,
    projectId: config.public.firebaseProjectId,
    storageBucket: normalizedStorageBucket,
    messagingSenderId: config.public.firebaseMessagingSenderId,
    appId: config.public.firebaseAppId,
    measurementId: config.public.firebaseMeasurementId,
  };

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app, firestoreDatabaseId);
  const auth = getAuth(app);
  const storage = storageBucketUrl ? getStorage(app, storageBucketUrl) : getStorage(app);
  const authUser = useState("auth:user", () => null);
  const authReady = useState("auth:ready", () => false);
  const authInitialized = useState("auth:initialized", () => false);

  // Persist Firebase Auth across tabs and let Firebase refresh tokens automatically.
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn("Cannot set auth persistence", error);
  });

  let resolveAuthReady;
  const authReadyPromise = new Promise((resolve) => {
    resolveAuthReady = resolve;
  });

  if (!authInitialized.value) {
    authInitialized.value = true;
    onIdTokenChanged(auth, (user) => {
      authUser.value = user;
      authReady.value = true;
      if (resolveAuthReady) {
        resolveAuthReady(user);
        resolveAuthReady = null;
      }
    });
  } else if (authReady.value && resolveAuthReady) {
    resolveAuthReady(authUser.value);
    resolveAuthReady = null;
  }

  return {
    provide: {
      firebaseApp: app,
      db,
      auth,
      storage,
      authReadyPromise,
    },
  };
});
