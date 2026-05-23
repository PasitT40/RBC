import { describe, it, expect } from "vitest";
import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore";
import { HttpError } from "../lib/http.js";
import { listCategoriesRoute, getCategoryBySlugRoute, getCategoryBrandsRoute } from "../routes/categories.js";

function makeDoc(id: string, data: Record<string, unknown>): DocumentSnapshot {
  return { id, exists: true, data: () => data, get: (f: string) => data[f] } as unknown as DocumentSnapshot;
}

function makeChain(docs: DocumentSnapshot[]) {
  const q: any = {
    where: () => q,
    orderBy: () => q,
    limit: () => q,
    startAt: () => q,
    endAt: () => q,
    startAfter: () => q,
    get: async () => ({ docs, empty: docs.length === 0 }),
  };
  return q;
}

type SingleDocMock = { exists: boolean; data: () => Record<string, unknown> | null; get: (f: string) => unknown };

function makeDb(
  collections: Record<string, DocumentSnapshot[]> = {},
  singleDocs: Record<string, SingleDocMock> = {}
) {
  return {
    collection: (name: string) => {
      const chain = makeChain(collections[name] ?? []);
      chain.doc = (id: string) => ({
        get: async () =>
          singleDocs[`${name}/${id}`] ?? { exists: false, data: () => null, get: () => undefined },
      });
      return chain;
    },
  } as unknown as Firestore;
}

function makeReq(query: Record<string, unknown> = {}) {
  return { query } as any;
}

const catDoc = makeDoc("cat1", { name: "กล้อง", slug: "camera", is_active: true, order: 1, image_url: "https://cat.jpg" });
const catDoc2 = makeDoc("cat2", { name: "เลนส์", slug: "lens", is_active: true, order: 2 });

describe("listCategoriesRoute", () => {
  it("returns empty items when no categories", async () => {
    const db = makeDb();
    const result = await listCategoriesRoute(db);
    expect(result.items).toEqual([]);
  });

  it("returns categories with all CategorySummary fields", async () => {
    const db = makeDb({ categories: [catDoc] });
    const result = await listCategoriesRoute(db);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "cat1",
      name: "กล้อง",
      slug: "camera",
      image_url: "https://cat.jpg",
      order: 1,
    });
    expect(result.items[0].seo).toHaveProperty("title");
  });

  it("returns multiple categories in snapshot order", async () => {
    const db = makeDb({ categories: [catDoc, catDoc2] });
    const result = await listCategoriesRoute(db);
    expect(result.items.map((c) => c.slug)).toEqual(["camera", "lens"]);
  });
});

describe("getCategoryBySlugRoute", () => {
  it("returns category when found and is_active", async () => {
    const db = makeDb({ categories: [catDoc] });
    const result = await getCategoryBySlugRoute(db, "camera");
    expect(result.item.id).toBe("cat1");
    expect(result.item.slug).toBe("camera");
  });

  it("throws 404 when category not found", async () => {
    const db = makeDb({ categories: [] });
    await expect(getCategoryBySlugRoute(db, "missing")).rejects.toMatchObject({ status: 404 });
  });

  it("throws 404 when category is_active is false", async () => {
    const inactive = makeDoc("cat9", { name: "X", slug: "x", is_active: false, order: 1 });
    const db = makeDb({ categories: [inactive] });
    await expect(getCategoryBySlugRoute(db, "x")).rejects.toMatchObject({ status: 404 });
  });

  it("throws HttpError instance for not found", async () => {
    const db = makeDb({ categories: [] });
    await expect(getCategoryBySlugRoute(db, "gone")).rejects.toBeInstanceOf(HttpError);
  });
});

describe("getCategoryBrandsRoute", () => {
  const brandDoc = makeDoc("brand1", { name: "Canon", slug: "canon", is_active: true, order: 1 });
  const mappingDoc = makeDoc("cat1__brand1", {
    category_id: "cat1",
    brand_id: "brand1",
    is_active: true,
    order: 1,
  });

  it("returns empty items when no mappings exist", async () => {
    const db = makeDb({ categories: [catDoc], category_brands: [] });
    const result = await getCategoryBrandsRoute(db, "camera");
    expect(result.items).toEqual([]);
  });

  it("throws 404 when category not found", async () => {
    const db = makeDb({ categories: [] });
    await expect(getCategoryBrandsRoute(db, "missing")).rejects.toMatchObject({ status: 404 });
  });

  it("returns brands with BrandSummary shape including category_slug", async () => {
    const db = makeDb({
      categories: [catDoc],
      category_brands: [mappingDoc],
      brands: [brandDoc],
    });
    const result = await getCategoryBrandsRoute(db, "camera");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "brand1",
      name: "Canon",
      slug: "canon",
      category_id: "cat1",
      category_slug: "camera",
    });
  });

  it("excludes inactive brands from results", async () => {
    const inactiveBrand = makeDoc("brand2", { name: "Nikon", slug: "nikon", is_active: false, order: 2 });
    const mapping2 = makeDoc("cat1__brand2", { category_id: "cat1", brand_id: "brand2", is_active: true, order: 2 });
    const db = makeDb({
      categories: [catDoc],
      category_brands: [mappingDoc, mapping2],
      brands: [brandDoc, inactiveBrand],
    });
    const result = await getCategoryBrandsRoute(db, "camera");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("brand1");
  });
});
