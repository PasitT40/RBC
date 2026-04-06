import { signOut } from "firebase/auth";

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (import.meta.server) return;

  const { user, waitUntilReady } = useAuthSession();
  const { $auth } = useNuxtApp() as { $auth: any };
  const { ensureOwnerAccess, clearOwnerAccess } = useOwnerAccess();
  const homePath = "/";

  await waitUntilReady();

  if (!user.value && to.path !== "/login") {
    return navigateTo("/login");
  }

  if (user.value) {
    try {
      const isOwner = await ensureOwnerAccess();
      if (!isOwner) {
        await signOut($auth);
        clearOwnerAccess();
        if (to.path !== "/login") return navigateTo("/login?denied=1");
        return;
      }
    } catch (error) {
      console.error("Owner access check failed", error);
      await signOut($auth);
      clearOwnerAccess();
      if (to.path !== "/login") return navigateTo("/login?denied=1");
      return;
    }
  }

  if (user.value && to.path === "/login") {
    return navigateTo(homePath);
  }
});
