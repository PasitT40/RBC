import { describe, it, expect } from "vitest";
import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore";
import { listBrandsRoute } from "../routes/brands.js";

function makeDoc(id: string, data: Record<string, unknown>): DocumentSnapshot {
  return { id, exists: true, data: () => data, get: (f: string) => data[f] } as unknown as DocumentSnapshot;
}

function makeChain(docs: DocumentSnapshot[]) {
  const q: any = {
    where: () => q,
    orderBy: () => q,
    limit: () => q,
    get: async () => ({ docs, empty: docs.length === 0 }),
  };
  return q;
}

function makeDb(collections: Record<string, DocumentSnapshot[]> = {}) {
  return {
    collection: (name: string) => makeChain(collections[name] ?? []),
  } as unknown as Firestore;
}

describe("listBrandsRoute", () => {
  it("returns empty items when collection is empty", async () => {
    const db = makeDb();
    const result = await listBrandsRoute(db);
    expect(result.items).toEqual([]);
  });

  it("returns brands from collection with all BrandItem fields", async () => {
    const ts = { toDate: () => new Date("2024-02-01T00:00:00.000Z") };
    const db = makeDb({
      brands: [
        makeDoc("brand1", { name: "Canon", slug: "canon", image_url: "https://canon.jpg", order: 1, updated_at: ts }),
      ],
    });
    const result = await listBrandsRoute(db);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "brand1",
      name: "Canon",
      slug: "canon",
      image_url: "https://canon.jpg",
      order: 1,
      updated_at: "2024-02-01T00:00:00.000Z",
    });
  });

  it("returns multiple brands preserving order from snapshot", async () => {
    const db = makeDb({
      brands: [
        makeDoc("b1", { name: "Canon", slug: "canon", order: 1 }),
        makeDoc("b2", { name: "Nikon", slug: "nikon", order: 2 }),
        makeDoc("b3", { name: "Sony", slug: "sony", order: 3 }),
      ],
    });
    const result = await listBrandsRoute(db);
    expect(result.items).toHaveLength(3);
    expect(result.items.map((b) => b.slug)).toEqual(["canon", "nikon", "sony"]);
  });

  it("returns null image_url when brand has no image", async () => {
    const db = makeDb({
      brands: [makeDoc("b1", { name: "Canon", slug: "canon", order: 1 })],
    });
    const result = await listBrandsRoute(db);
    expect(result.items[0].image_url).toBeNull();
  });
});
