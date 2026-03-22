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
  const route = useRoute();
  const { user, ready, waitUntilReady } = useAuthSession();
  const { ensureOwnerAccess, clearOwnerAccess } = useOwnerAccess();
  const { track } = useGlobalLoading();

  const loading = ref(false);
  const error = ref("");

  // คำนวณ path ที่จะเด้งกลับไปหลัง login เสร็จ (ค่าเริ่มต้นคือหน้าแรก /)
  const redirectPath = computed(() => {
    const raw = route.query.redirect;
    if (typeof raw === "string" && raw.startsWith("/")) return raw;
    return "/";
  });

  const signInWithGoogle = async () => {
    loading.value = true;
    error.value = "";
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      try {
        const credential = await signInWithPopup($auth, provider);
        const isOwner = await ensureOwnerAccess(credential.user.uid);
        if (!isOwner) {
          await signOut($auth);
          clearOwnerAccess();
          error.value = "This account does not have backoffice access";
          return;
        }
        await navigateTo(redirectPath.value);
        return;
      } catch (err: any) {
        const code = String(err?.code ?? "");
        // ถ้า Popup โดนบล็อก ให้เปลี่ยนไปใช้ Redirect แทน
        if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
          await signInWithRedirect($auth, provider);
          return;
        }
        if (code === "auth/popup-closed-by-user") return;
        throw err;
      }
    } catch (err: any) {
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
        error.value = "This account does not have backoffice access";
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
      await navigateTo(redirectPath.value);
      return;
    }

    try {
      await getRedirectResult($auth);
      if ($auth.currentUser) {
        const isOwner = await ensureOwnerAccess($auth.currentUser.uid);
        if (!isOwner) {
          await signOut($auth);
          clearOwnerAccess();
          error.value = "This account does not have backoffice access";
          return;
        }
        await navigateTo(redirectPath.value);
      }
    } catch (err: any) {
      error.value = err?.message || "Cannot complete login";
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
