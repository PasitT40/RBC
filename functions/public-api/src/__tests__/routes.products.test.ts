import { describe, it, expect } from "vitest";
import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore";
import { HttpError } from "../lib/http.js";
import { listProductsRoute, searchProductsRoute, getProductBySlugRoute } from "../routes/products.js";
import type { Request } from "firebase-functions/v2/https";

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

function makeReq(query: Record<string, unknown> = {}): Request {
  return { query } as unknown as Request;
}

function makeProductDoc(i: number, overrides: Record<string, unknown> = {}): DocumentSnapshot {
  return makeDoc(`prod${i}`, {
    name: `Product ${i}`,
    slug: `product-${i}`,
    show: true,
    is_deleted: false,
    status: "ACTIVE",
    ...overrides,
  });
}

function makeProductDocs(count: number, overrides: Record<string, unknown> = {}): DocumentSnapshot[] {
  return Array.from({ length: count }, (_, i) => makeProductDoc(i + 1, overrides));
}

describe("getProductBySlugRoute", () => {
  it("returns product detail for a public visible product", async () => {
    const productDoc = makeProductDoc(1, { show: true, is_deleted: false, status: "ACTIVE" });
    const db = makeDb({ products: [productDoc] });
    const result = await getProductBySlugRoute(db, "product-1");
    expect(result.item.id).toBe("prod1");
    expect(result.item.slug).toBe("product-1");
    expect(result.item).toHaveProperty("seo");
    expect(result.item).toHaveProperty("images");
  });

  it("throws 404 when no product found for slug", async () => {
    const db = makeDb({ products: [] });
    await expect(getProductBySlugRoute(db, "ghost")).rejects.toMatchObject({ status: 404 });
  });

  it("throws HttpError instance when not found", async () => {
    const db = makeDb({ products: [] });
    await expect(getProductBySlugRoute(db, "ghost")).rejects.toBeInstanceOf(HttpError);
  });

  it("throws 404 when product has show: false", async () => {
    const hiddenDoc = makeProductDoc(1, { show: false });
    const db = makeDb({ products: [hiddenDoc] });
    await expect(getProductBySlugRoute(db, "product-1")).rejects.toMatchObject({ status: 404 });
  });

  it("throws 404 when product is_deleted is true", async () => {
    const deletedDoc = makeProductDoc(1, { is_deleted: true });
    const db = makeDb({ products: [deletedDoc] });
    await expect(getProductBySlugRoute(db, "product-1")).rejects.toMatchObject({ status: 404 });
  });

  it("returns RESERVED product (public visible)", async () => {
    const reservedDoc = makeProductDoc(1, { status: "RESERVED" });
    const db = makeDb({ products: [reservedDoc] });
    const result = await getProductBySlugRoute(db, "product-1");
    expect(result.item.availability_status).toBe("reserved");
  });

  it("returns SOLD product (public visible)", async () => {
    const soldDoc = makeProductDoc(1, { status: "SOLD" });
    const db = makeDb({ products: [soldDoc] });
    const result = await getProductBySlugRoute(db, "product-1");
    expect(result.item.availability_status).toBe("sold");
  });
});

describe("searchProductsRoute", () => {
  it("throws 400 when q param is missing", async () => {
    const db = makeDb({ products: [] });
    await expect(searchProductsRoute(db, makeReq())).rejects.toMatchObject({ status: 400 });
  });

  it("throws 400 when q is empty string", async () => {
    const db = makeDb({ products: [] });
    await expect(searchProductsRoute(db, makeReq({ q: "" }))).rejects.toMatchObject({ status: 400 });
  });

  it("throws 400 when q is whitespace only", async () => {
    const db = makeDb({ products: [] });
    await expect(searchProductsRoute(db, makeReq({ q: "   " }))).rejects.toMatchObject({ status: 400 });
  });

  it("returns items array for valid query", async () => {
    const db = makeDb({ products: [makeProductDoc(1)] });
    const result = await searchProductsRoute(db, makeReq({ q: "canon" }));
    expect(result).toHaveProperty("items");
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("returns empty items when no matching products", async () => {
    const db = makeDb({ products: [] });
    const result = await searchProductsRoute(db, makeReq({ q: "nonexistent" }));
    expect(result.items).toEqual([]);
  });
});

describe("listProductsRoute", () => {
  it("returns paginated response shape", async () => {
    const db = makeDb({ products: makeProductDocs(3) });
    const result = await listProductsRoute(db, makeReq());
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("has_more");
    expect(result).toHaveProperty("next_cursor");
  });

  it("returns has_more false when results fit within limit", async () => {
    const db = makeDb({ products: makeProductDocs(3) });
    const result = await listProductsRoute(db, makeReq({ limit: "5" }));
    expect(result.has_more).toBe(false);
    expect(result.next_cursor).toBeNull();
  });

  it("returns has_more true when results exceed limit", async () => {
    // limit=2, so limit+1=3 docs → has_more
    const db = makeDb({ products: makeProductDocs(3) });
    const result = await listProductsRoute(db, makeReq({ limit: "2" }));
    expect(result.has_more).toBe(true);
    expect(result.next_cursor).not.toBeNull();
    expect(result.items).toHaveLength(2);
  });

  it("returns empty items when no products", async () => {
    const db = makeDb({ products: [] });
    const result = await listProductsRoute(db, makeReq());
    expect(result.items).toEqual([]);
    expect(result.has_more).toBe(false);
  });

  it("throws 400 for invalid availability value", async () => {
    const db = makeDb({ products: [] });
    await expect(listProductsRoute(db, makeReq({ availability: "unknown" }))).rejects.toMatchObject({ status: 400 });
  });

  it("throws 400 for negative minPrice", async () => {
    const db = makeDb({ products: [] });
    await expect(listProductsRoute(db, makeReq({ minPrice: "-1" }))).rejects.toMatchObject({ status: 400 });
  });

  it("throws 400 when minPrice > maxPrice", async () => {
    const db = makeDb({ products: [] });
    await expect(listProductsRoute(db, makeReq({ minPrice: "5000", maxPrice: "1000" }))).rejects.toMatchObject({ status: 400 });
  });

  it("throws 400 when both price range and condition filter are set", async () => {
    const db = makeDb({ products: [] });
    await expect(
      listProductsRoute(db, makeReq({ minPrice: "1000", minCondition: "3" }))
    ).rejects.toMatchObject({ status: 400 });
  });

  it("throws 400 for invalid sort value", async () => {
    const db = makeDb({ products: [] });
    await expect(listProductsRoute(db, makeReq({ sort: "bad_sort" }))).rejects.toMatchObject({ status: 400 });
  });

  it("throws 404 when category slug does not exist", async () => {
    const db = makeDb({ categories: [] });
    await expect(listProductsRoute(db, makeReq({ category: "nonexistent" }))).rejects.toMatchObject({ status: 404 });
  });

  it("throws 404 when brand slug does not exist", async () => {
    const catDoc = makeDoc("cat1", { name: "กล้อง", slug: "camera", is_active: true, order: 1 });
    const db = makeDb({ categories: [catDoc], brands: [] });
    await expect(
      listProductsRoute(db, makeReq({ category: "camera", brand: "missing-brand" }))
    ).rejects.toMatchObject({ status: 404 });
  });

  it("accepts valid availability values", async () => {
    const db = makeDb({ products: makeProductDocs(2) });
    for (const availability of ["available", "sold", "reserved"]) {
      const result = await listProductsRoute(db, makeReq({ availability }));
      expect(result).toHaveProperty("items");
    }
  });
});
