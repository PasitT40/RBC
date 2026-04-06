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
  const { user, ready, waitUntilReady } = useAuthSession();
  const { ensureOwnerAccess, clearOwnerAccess } = useOwnerAccess();
  const { track } = useGlobalLoading();

  const loading = ref(false);
  const error = ref("");

  const deniedMessage = "บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบหลังบ้าน";
  const homePath = "/";

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
          error.value = deniedMessage;
          return;
        }
        await navigateTo(homePath);
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
      error.value = err?.message || "เข้าสู่ระบบด้วย Google ไม่สำเร็จ";
    } finally {
      loading.value = false;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    if (!email || !pass) {
      error.value = "กรุณากรอกอีเมลและรหัสผ่าน";
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
      await navigateTo(homePath);
    } catch (err: any) {
      error.value = err?.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
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
      console.error("ออกจากระบบไม่สำเร็จ:", err);
    }
  };

  const checkRedirectResult = async () => {
    if (!ready.value) await waitUntilReady();

    if (user.value) {
      const isOwner = await ensureOwnerAccess(user.value.uid);
      if (!isOwner) {
        await signOut($auth);
        clearOwnerAccess();
        error.value = deniedMessage;
        return;
      }
      await navigateTo(homePath);
      return;
    }

    try {
      await getRedirectResult($auth);
      if ($auth.currentUser) {
        const isOwner = await ensureOwnerAccess($auth.currentUser.uid);
        if (!isOwner) {
          await signOut($auth);
          clearOwnerAccess();
          error.value = deniedMessage;
          return;
        }
        await navigateTo(homePath);
      }
    } catch (err: any) {
      const code = String(err?.code ?? "");
      error.value = code === "permission-denied"
        ? deniedMessage
        : err?.message || "เข้าสู่ระบบไม่สำเร็จ";
    }
  };

  return {
    loading,
    error,
    signInWithGoogle: () => track(signInWithGoogle, "กำลังเข้าสู่ระบบ..."),
    signInWithEmail: (email: string, pass: string) => track(() => signInWithEmail(email, pass), "กำลังเข้าสู่ระบบ..."),
    logout: () => track(logout, "กำลังออกจากระบบ..."),
    checkRedirectResult: () => track(checkRedirectResult, "กำลังตรวจสอบสถานะการเข้าสู่ระบบ..."),
  };
}
