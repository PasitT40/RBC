import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";

export function useAuthFirebase() {
  const { $auth } = useNuxtApp() as { $auth: any };
  const config = useRuntimeConfig();
  const route = useRoute();
  const { user, ready, waitUntilReady } = useAuthSession();
  const { ensureOwnerAccess, clearOwnerAccess } = useOwnerAccess();
  const { track } = useGlobalLoading();

  const loading = ref(false);
  const error = ref("");

  const deniedMessage = "This account does not have backoffice access";

  // คำนวณ path ที่จะเด้งกลับไปหลัง login เสร็จ (ค่าเริ่มต้นคือหน้าแรก /)
  const redirectPath = computed(() => {
    const raw = route.query.redirect;
    if (typeof raw === "string" && raw.startsWith("/")) return raw;
    return "/";
  });

  const signInWithGoogle = async () => {
    loading.value = true;
    error.value = "";
    console.info("[auth] signInWithGoogle start", {
      projectId: config.public.firebaseProjectId,
      firestoreDatabaseId: config.public.firestoreDatabaseId || "(default)",
    });
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      try {
        const credential = await signInWithPopup($auth, provider);
        console.info("[auth] signInWithGoogle popup success", {
          uid: credential.user.uid,
          email: credential.user.email,
        });
        const isOwner = await ensureOwnerAccess(credential.user.uid);
        if (!isOwner) {
          console.warn("[auth] signInWithGoogle denied", {
            uid: credential.user.uid,
            email: credential.user.email,
          });
          await signOut($auth);
          clearOwnerAccess();
          error.value = deniedMessage;
          return;
        }
        await navigateTo(redirectPath.value);
        return;
      } catch (err: any) {
        const code = String(err?.code ?? "");
        // ถ้า Popup โดนบล็อก ให้เปลี่ยนไปใช้ Redirect แทน
        if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
          console.warn("[auth] popup unavailable, falling back to redirect", { code });
          await signInWithRedirect($auth, provider);
          return;
        }
        if (code === "auth/popup-closed-by-user") return;
        throw err;
      }
    } catch (err: any) {
      console.error("[auth] signInWithGoogle failed", err);
      error.value = err?.message || "Google sign-in failed";
    } finally {
      loading.value = false;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    if (!email || !pass) {
      error.value = "Please enter both email and password";
      return;
    }
    loading.value = true;
    error.value = "";
    try {
      const credential = await signInWithEmailAndPassword($auth, email, pass);
      const isOwner = await ensureOwnerAccess(credential.user.uid);
      if (!isOwner) {
        await signOut($auth);
        clearOwnerAccess();
        error.value = deniedMessage;
        return;
      }
      await navigateTo(redirectPath.value);
    } catch (err: any) {
      error.value = err?.message || "Invalid credentials";
    } finally {
      loading.value = false;
    }
  };

  const logout = async () => {
    try {
      await signOut($auth);
      clearOwnerAccess();
      await navigateTo("/login");
    } catch (err: any) {
      console.error("Logout failed:", err);
    }
  };

  const checkRedirectResult = async () => {
    if (!ready.value) await waitUntilReady();

    if (user.value) {
      console.info("[auth] existing session detected before redirect check", {
        uid: user.value.uid,
        email: user.value.email,
      });
      await navigateTo(redirectPath.value);
      return;
    }

    try {
      await getRedirectResult($auth);
      if ($auth.currentUser) {
        console.info("[auth] redirect result user", {
          uid: $auth.currentUser.uid,
          email: $auth.currentUser.email,
        });
        const isOwner = await ensureOwnerAccess($auth.currentUser.uid);
        if (!isOwner) {
          console.warn("[auth] redirect result denied", {
            uid: $auth.currentUser.uid,
            email: $auth.currentUser.email,
          });
          await signOut($auth);
          clearOwnerAccess();
          error.value = deniedMessage;
          return;
        }
        await navigateTo(redirectPath.value);
      }
    } catch (err: any) {
      const code = String(err?.code ?? "");
      console.error("[auth] checkRedirectResult failed", err);
      error.value = code === "permission-denied"
        ? deniedMessage
        : err?.message || "Cannot complete login";
    }
  };

  return {
    loading,
    error,
    signInWithGoogle: () => track(signInWithGoogle, "Signing in..."),
    signInWithEmail: (email: string, pass: string) => track(() => signInWithEmail(email, pass), "Signing in..."),
    logout: () => track(logout, "Signing out..."),
    checkRedirectResult: () => track(checkRedirectResult, "Checking session..."),
  };
}
