import type { User } from "firebase/auth";

export function useAuthSession() {
  const { $authReadyPromise } = useNuxtApp() as { $authReadyPromise?: Promise<unknown> };
  const user = useState<User | null>("auth:user", () => null);
  const ready = useState<boolean>("auth:ready", () => false);

  const isAuthenticated = computed(() => Boolean(user.value));

  const waitUntilReady = async () => {
    if (ready.value) return;
    await $authReadyPromise;
  };

  return {
    user,
    ready,
    isAuthenticated,
    waitUntilReady,
  };
}
