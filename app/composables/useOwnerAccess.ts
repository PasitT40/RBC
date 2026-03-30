import { doc, getDoc } from "firebase/firestore";

export function useOwnerAccess() {
  const { $db } = useNuxtApp() as { $db: any };
  const { user } = useAuthSession();
  const allowed = useState<boolean>("owner-access:allowed", () => false);
  const checkedUid = useState<string | null>("owner-access:checked-uid", () => null);

  const clearOwnerAccess = () => {
    allowed.value = false;
    checkedUid.value = null;
  };

  const isPermissionDenied = (error: unknown) =>
    typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "permission-denied";

  const ensureOwnerAccess = async (uidOverride?: string | null) => {
    const uid = uidOverride ?? user.value?.uid ?? null;
    if (!uid) {
      clearOwnerAccess();
      return false;
    }

    if (checkedUid.value === uid) {
      return allowed.value;
    }

    try {
      const snap = await getDoc(doc($db, "owners", uid));
      allowed.value = snap.exists();
      checkedUid.value = uid;
      return allowed.value;
    } catch (error) {
      clearOwnerAccess();
      if (isPermissionDenied(error)) {
        return false;
      }
      throw error;
    }
  };

  return {
    allowed,
    ensureOwnerAccess,
    clearOwnerAccess,
  };
}
