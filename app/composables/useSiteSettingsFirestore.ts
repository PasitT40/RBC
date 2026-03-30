import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { SiteSettingsRecord } from "./firestore/types";
import { deleteStorageUrls, uploadImageAsWebP } from "./firestore/media";

type EditableSiteBanner = {
  id?: string;
  image_url?: string;
  file?: File | null;
  active?: boolean;
  order?: number;
};

type EditableSiteCredit = {
  id?: string;
  image_url?: string;
  file?: File | null;
  order?: number;
};

type UpdateSiteSettingsInput = {
  banner_auto_slide_sec?: number;
  banners?: EditableSiteBanner[];
  credits?: EditableSiteCredit[];
};

const defaultSiteSettings = (): SiteSettingsRecord => ({
  id: "site",
  banner_auto_slide_sec: 5,
  banners: [],
  credits: [],
});

const normalizeOrder = <T extends { order?: number }>(items: T[]) =>
  [...items].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));

export function useSiteSettingsFirestore() {
  const { $db, $storage } = useNuxtApp() as { $db: any; $storage: any };
  const { track } = useGlobalLoading();

  const uploadImage = async (rawFile: File, folderPath: string) =>
    uploadImageAsWebP($storage, rawFile, folderPath);

  const cleanupUploadedUrls = async (urls: string[]) => {
    if (!urls.length) return;
    await deleteStorageUrls($storage, urls);
  };

  const getSiteSettings = async (): Promise<SiteSettingsRecord> => {
    const ref = doc($db, "settings", "site");
    const snap = await getDoc(ref);
    if (!snap.exists()) return defaultSiteSettings();

    const data = snap.data() as Record<string, any>;
    return {
      id: snap.id,
      banner_auto_slide_sec: Number(data.banner_auto_slide_sec ?? 5),
      banners: normalizeOrder(
        Array.isArray(data.banners)
          ? data.banners.map((item: Record<string, any>, index: number) => ({
              id: String(item.id ?? `banner-${index + 1}`),
              image_url: String(item.image_url ?? ""),
              order: Number(item.order ?? index + 1),
              active: item.active !== false,
            }))
          : []
      ),
      credits: normalizeOrder(
        Array.isArray(data.credits)
          ? data.credits.map((item: Record<string, any>, index: number) => ({
              id: String(item.id ?? `credit-${index + 1}`),
              image_url: String(item.image_url ?? ""),
              order: Number(item.order ?? index + 1),
            }))
          : []
      ),
      updated_at: data.updated_at,
    };
  };

  const updateSiteSettings = async (payload: UpdateSiteSettingsInput) => {
    const settingsRef = doc($db, "settings", "site");
    const current = await getSiteSettings();

    const uploadedUrls: string[] = [];

    try {
      const nextBanners = [];
      for (const [index, item] of (payload.banners ?? []).entries()) {
        const id = item.id?.trim() || `banner-${index + 1}`;
        const uploadedUrl = item.file ? await uploadImage(item.file, `settings/site/banners/${id}`) : null;
        if (uploadedUrl) uploadedUrls.push(uploadedUrl);

        const imageUrl = uploadedUrl ?? item.image_url?.trim() ?? "";
        if (!imageUrl) continue;

        nextBanners.push({
          id,
          image_url: imageUrl,
          order: index + 1,
          active: item.active !== false,
        });
      }

      const nextCredits = [];
      for (const [index, item] of (payload.credits ?? []).entries()) {
        const id = item.id?.trim() || `credit-${index + 1}`;
        const uploadedUrl = item.file ? await uploadImage(item.file, `settings/site/credits/${id}`) : null;
        if (uploadedUrl) uploadedUrls.push(uploadedUrl);

        const imageUrl = uploadedUrl ?? item.image_url?.trim() ?? "";
        if (!imageUrl) continue;

        nextCredits.push({
          id,
          image_url: imageUrl,
          order: index + 1,
        });
      }

      await setDoc(
        settingsRef,
        {
          banner_auto_slide_sec: Number(payload.banner_auto_slide_sec ?? current.banner_auto_slide_sec ?? 5),
          banners: nextBanners,
          credits: nextCredits,
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );

      const previousUrls = [
        ...current.banners.map((item) => item.image_url),
        ...current.credits.map((item) => item.image_url),
      ].filter(Boolean);
      const nextUrls = [
        ...nextBanners.map((item) => item.image_url),
        ...nextCredits.map((item) => item.image_url),
      ];
      const removedUrls = [...new Set(previousUrls.filter((url) => !nextUrls.includes(url)))];
      await cleanupUploadedUrls(removedUrls);
    } catch (error) {
      await cleanupUploadedUrls(uploadedUrls);
      throw error;
    }
  };

  return {
    getSiteSettings: () => track(() => getSiteSettings(), "Loading site settings..."),
    updateSiteSettings: (payload: UpdateSiteSettingsInput) => track(() => updateSiteSettings(payload), "Saving site settings..."),
  };
}
