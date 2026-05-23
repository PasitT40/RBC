import { describe, it, expect } from "vitest";
import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore";
import { getSiteSettingsRoute } from "../routes/settings.js";

function makeDoc(id: string, data: Record<string, unknown>): DocumentSnapshot {
  return { id, exists: true, data: () => data, get: (f: string) => data[f] } as unknown as DocumentSnapshot;
}

function makeDb(singleDocs: Record<string, { exists: boolean; data: () => Record<string, unknown> | null; get: (f: string) => unknown }> = {}) {
  return {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () =>
          singleDocs[`${name}/${id}`] ?? { exists: false, data: () => null, get: () => undefined },
      }),
    }),
  } as unknown as Firestore;
}

function makeSiteDoc(data: Record<string, unknown>) {
  return { exists: true, data: () => data, get: (f: string) => data[f] };
}

describe("getSiteSettingsRoute", () => {
  it("returns banner_auto_slide_sec from doc data", async () => {
    const db = makeDb({ "settings/site": makeSiteDoc({ banner_auto_slide_sec: 8, banners: [], credits: [] }) });
    const result = await getSiteSettingsRoute(db);
    expect(result.item.banner_auto_slide_sec).toBe(8);
  });

  it("defaults banner_auto_slide_sec to 5 when missing", async () => {
    const db = makeDb({ "settings/site": makeSiteDoc({ banners: [], credits: [] }) });
    const result = await getSiteSettingsRoute(db);
    expect(result.item.banner_auto_slide_sec).toBe(5);
  });

  it("returns empty arrays when doc does not exist", async () => {
    const db = makeDb();
    const result = await getSiteSettingsRoute(db);
    expect(result.item.banners).toEqual([]);
    expect(result.item.credits).toEqual([]);
    expect(result.item.banner_auto_slide_sec).toBe(5);
  });

  it("returns only active banners with image_url", async () => {
    const db = makeDb({
      "settings/site": makeSiteDoc({
        banner_auto_slide_sec: 5,
        banners: [
          { id: "b1", image_url: "https://a.jpg", order: 1, active: true },
          { id: "b2", image_url: "https://b.jpg", order: 2, active: false },
          { id: "b3", image_url: "", order: 3, active: true },
          { id: "b4", image_url: "https://d.jpg", order: 4 },
        ],
        credits: [],
      }),
    });
    const result = await getSiteSettingsRoute(db);
    expect(result.item.banners).toHaveLength(2);
    expect(result.item.banners.map((b) => b.id)).toEqual(["b1", "b4"]);
  });

  it("sorts banners by order ascending", async () => {
    const db = makeDb({
      "settings/site": makeSiteDoc({
        banner_auto_slide_sec: 5,
        banners: [
          { id: "b3", image_url: "https://c.jpg", order: 3 },
          { id: "b1", image_url: "https://a.jpg", order: 1 },
          { id: "b2", image_url: "https://b.jpg", order: 2 },
        ],
        credits: [],
      }),
    });
    const result = await getSiteSettingsRoute(db);
    expect(result.item.banners.map((b) => b.id)).toEqual(["b1", "b2", "b3"]);
  });

  it("returns credits sorted by order, filtering those without image_url", async () => {
    const db = makeDb({
      "settings/site": makeSiteDoc({
        banner_auto_slide_sec: 5,
        banners: [],
        credits: [
          { id: "c2", image_url: "https://c2.jpg", order: 2 },
          { id: "c1", image_url: "https://c1.jpg", order: 1 },
          { id: "c3", image_url: "", order: 3 },
        ],
      }),
    });
    const result = await getSiteSettingsRoute(db);
    expect(result.item.credits).toHaveLength(2);
    expect(result.item.credits.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("returns empty credits array when field is missing", async () => {
    const db = makeDb({ "settings/site": makeSiteDoc({ banner_auto_slide_sec: 5, banners: [] }) });
    const result = await getSiteSettingsRoute(db);
    expect(result.item.credits).toEqual([]);
  });
});
