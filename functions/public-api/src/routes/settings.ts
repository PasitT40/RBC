import type { Firestore } from "firebase-admin/firestore";
import type { SiteSettings } from "../lib/contracts.js";

function normalizeOrder<T extends { order?: number }>(items: T[]) {
  return [...items].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
}

export async function getSiteSettingsRoute(db: Firestore): Promise<{ item: SiteSettings }> {
  const snap = await db.collection("settings").doc("site").get();

  const data = snap.exists ? (snap.data() as Record<string, unknown>) : {};

  const banners = normalizeOrder(
    Array.isArray(data.banners)
      ? (data.banners as Record<string, unknown>[])
          .filter((item) => item.active !== false)
          .map((item, index) => ({
            id: String(item.id ?? `banner-${index + 1}`),
            image_url: String(item.image_url ?? ""),
            order: Number(item.order ?? index + 1),
          }))
          .filter((item) => item.image_url)
      : []
  );

  const credits = normalizeOrder(
    Array.isArray(data.credits)
      ? (data.credits as Record<string, unknown>[])
          .map((item, index) => ({
            id: String(item.id ?? `credit-${index + 1}`),
            image_url: String(item.image_url ?? ""),
            order: Number(item.order ?? index + 1),
          }))
          .filter((item) => item.image_url)
      : []
  );

  return {
    item: {
      banner_auto_slide_sec: Number(data.banner_auto_slide_sec ?? 5),
      banners,
      credits,
    },
  };
}
