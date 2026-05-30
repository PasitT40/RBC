import { describe, it, expect } from "vitest";
import { serializeProductCard, serializeProductDetail, serializeCategory, serializeBrand, serializeBrandForCategory } from "../lib/serializers.js";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { ProductRouteContext } from "../lib/contracts.js";

function makeDoc(id: string, data: Record<string, unknown>): DocumentSnapshot {
  return {
    id,
    data: () => data,
    get: (field: string) => data[field],
  } as unknown as DocumentSnapshot;
}

function makeContext(
  categories: Array<[string, string]> = [],
  brands: Array<[string, string]> = []
): ProductRouteContext {
  return {
    categorySlugById: new Map(categories),
    brandSlugById: new Map(brands),
  };
}

function makeFirestoreTimestamp(isoString: string) {
  const date = new Date(isoString);
  return {
    toDate: () => date,
  };
}

describe("serializeProductCard", () => {
  it("serializes a fully-populated product", () => {
    const ts = makeFirestoreTimestamp("2024-01-15T10:00:00.000Z");
    const doc = makeDoc("prod1", {
      sku: "CAM-001",
      name: "Canon R5",
      slug: "canon-r5",
      category_id: "cat1",
      category_name: "กล้อง DSLR",
      brand_id: "brand1",
      brand_name: "Canon",
      sell_price: 89900,
      cover_image: "https://img.jpg",
      condition: 4,
      status: "ACTIVE",
      updated_at: ts,
    });
    const ctx = makeContext([["cat1", "dslr"]], [["brand1", "canon"]]);

    const result = serializeProductCard(doc, ctx);

    expect(result.id).toBe("prod1");
    expect(result.sku).toBe("CAM-001");
    expect(result.name).toBe("Canon R5");
    expect(result.slug).toBe("canon-r5");
    expect(result.category).toEqual({ id: "cat1", name: "กล้อง DSLR", slug: "dslr" });
    expect(result.brand).toEqual({ id: "brand1", name: "Canon", slug: "canon" });
    expect(result.sell_price).toBe(89900);
    expect(result.cover_image).toBe("https://img.jpg");
    expect(result.condition).toBe(4);
    expect(result.availability_status).toBe("available");
    expect(result.updated_at).toBe("2024-01-15T10:00:00.000Z");
  });

  it("returns null for missing sell_price", () => {
    const doc = makeDoc("p1", { name: "X", slug: "x", status: "ACTIVE" });
    const result = serializeProductCard(doc, makeContext());
    expect(result.sell_price).toBeNull();
  });

  it("returns null for missing condition", () => {
    const doc = makeDoc("p1", { name: "X", slug: "x", status: "ACTIVE" });
    const result = serializeProductCard(doc, makeContext());
    expect(result.condition).toBeNull();
  });

  it("returns null for missing cover_image", () => {
    const doc = makeDoc("p1", { name: "X", slug: "x", status: "ACTIVE" });
    const result = serializeProductCard(doc, makeContext());
    expect(result.cover_image).toBeNull();
  });

  it("returns null for whitespace-only cover_image", () => {
    const doc = makeDoc("p1", { name: "X", slug: "x", status: "ACTIVE", cover_image: "   " });
    const result = serializeProductCard(doc, makeContext());
    expect(result.cover_image).toBeNull();
  });

  it("returns null sku for missing sku field", () => {
    const doc = makeDoc("p1", { name: "X", slug: "x", status: "ACTIVE" });
    const result = serializeProductCard(doc, makeContext());
    expect(result.sku).toBeNull();
  });

  it("maps RESERVED status to reserved", () => {
    const doc = makeDoc("p1", { name: "X", slug: "x", status: "RESERVED" });
    const result = serializeProductCard(doc, makeContext());
    expect(result.availability_status).toBe("reserved");
  });

  it("maps SOLD status to sold", () => {
    const doc = makeDoc("p1", { name: "X", slug: "x", status: "SOLD" });
    const result = serializeProductCard(doc, makeContext());
    expect(result.availability_status).toBe("sold");
  });

  it("maps unknown status to available (safe fallback)", () => {
    const doc = makeDoc("p1", { name: "X", slug: "x", status: "UNKNOWN" });
    const result = serializeProductCard(doc, makeContext());
    expect(result.availability_status).toBe("available");
  });

  it("uses empty string for category slug when not in context", () => {
    const doc = makeDoc("p1", { name: "X", slug: "x", category_id: "missing", status: "ACTIVE" });
    const result = serializeProductCard(doc, makeContext());
    expect(result.category.slug).toBe("");
  });

  it("returns null updated_at for missing timestamp", () => {
    const doc = makeDoc("p1", { name: "X", slug: "x", status: "ACTIVE" });
    const result = serializeProductCard(doc, makeContext());
    expect(result.updated_at).toBeNull();
  });

  it("returns null updated_at when toDate returns invalid Date", () => {
    const doc = makeDoc("p1", {
      name: "X",
      slug: "x",
      status: "ACTIVE",
      updated_at: { toDate: () => new Date("invalid") },
    });
    const result = serializeProductCard(doc, makeContext());
    expect(result.updated_at).toBeNull();
  });
});

describe("serializeProductDetail", () => {
  it("includes images array", () => {
    const doc = makeDoc("p1", {
      name: "X",
      slug: "x",
      status: "ACTIVE",
      images: ["https://a.jpg", "https://b.jpg"],
    });
    const result = serializeProductDetail(doc, makeContext());
    expect(result.images).toEqual(["https://a.jpg", "https://b.jpg"]);
  });

  it("returns empty array when images field is missing", () => {
    const doc = makeDoc("p1", { name: "X", slug: "x", status: "ACTIVE" });
    const result = serializeProductDetail(doc, makeContext());
    expect(result.images).toEqual([]);
  });

  it("filters out empty strings from images", () => {
    const doc = makeDoc("p1", { name: "X", slug: "x", status: "ACTIVE", images: ["https://a.jpg", "", "https://b.jpg"] });
    const result = serializeProductDetail(doc, makeContext());
    expect(result.images).toEqual(["https://a.jpg", "https://b.jpg"]);
  });

  it("includes shutter field", () => {
    const doc = makeDoc("p1", { name: "X", slug: "x", status: "ACTIVE", shutter: "50000" });
    const result = serializeProductDetail(doc, makeContext());
    expect(result.shutter).toBe("50000");
  });

  it("returns null shutter when missing", () => {
    const doc = makeDoc("p1", { name: "X", slug: "x", status: "ACTIVE" });
    const result = serializeProductDetail(doc, makeContext());
    expect(result.shutter).toBeNull();
  });

  it("includes seo object", () => {
    const doc = makeDoc("p1", { name: "Canon R5", slug: "r5", status: "ACTIVE" });
    const result = serializeProductDetail(doc, makeContext());
    expect(result.seo).toHaveProperty("title");
    expect(result.seo).toHaveProperty("description");
    expect(result.seo).toHaveProperty("image");
  });

  it("includes tiktok_url when present", () => {
    const doc = makeDoc("p1", { name: "X", slug: "x", status: "ACTIVE", tiktok_url: "https://vt.tiktok.com/ZSxp4twcS/" });
    const result = serializeProductDetail(doc, makeContext());
    expect(result.tiktok_url).toBe("https://vt.tiktok.com/ZSxp4twcS/");
  });

  it("returns null tiktok_url when missing", () => {
    const doc = makeDoc("p1", { name: "X", slug: "x", status: "ACTIVE" });
    const result = serializeProductDetail(doc, makeContext());
    expect(result.tiktok_url).toBeNull();
  });

  it("returns null tiktok_url when empty string", () => {
    const doc = makeDoc("p1", { name: "X", slug: "x", status: "ACTIVE", tiktok_url: "" });
    const result = serializeProductDetail(doc, makeContext());
    expect(result.tiktok_url).toBeNull();
  });
});

describe("serializeCategory", () => {
  it("serializes a complete category", () => {
    const ts = makeFirestoreTimestamp("2024-03-01T00:00:00.000Z");
    const doc = makeDoc("cat1", {
      name: "กล้อง",
      slug: "camera",
      image_url: "https://cat.jpg",
      order: 1,
      updated_at: ts,
    });
    const result = serializeCategory(doc);

    expect(result.id).toBe("cat1");
    expect(result.name).toBe("กล้อง");
    expect(result.slug).toBe("camera");
    expect(result.image_url).toBe("https://cat.jpg");
    expect(result.order).toBe(1);
    expect(result.updated_at).toBe("2024-03-01T00:00:00.000Z");
  });

  it("returns 0 for missing order", () => {
    const doc = makeDoc("cat1", { name: "X", slug: "x" });
    expect(serializeCategory(doc).order).toBe(0);
  });

  it("returns null image_url when missing", () => {
    const doc = makeDoc("cat1", { name: "X", slug: "x" });
    expect(serializeCategory(doc).image_url).toBeNull();
  });

  it("includes seo object with fallback title", () => {
    const doc = makeDoc("cat1", { name: "กล้อง", slug: "camera" });
    const result = serializeCategory(doc);
    expect(result.seo.title).toBe("กล้อง");
  });
});

describe("serializeBrand", () => {
  it("serializes a complete brand", () => {
    const ts = makeFirestoreTimestamp("2024-02-01T00:00:00.000Z");
    const doc = makeDoc("brand1", {
      name: "Canon",
      slug: "canon",
      image_url: "https://canon.jpg",
      order: 2,
      updated_at: ts,
    });
    const result = serializeBrand(doc);

    expect(result.id).toBe("brand1");
    expect(result.name).toBe("Canon");
    expect(result.slug).toBe("canon");
    expect(result.image_url).toBe("https://canon.jpg");
    expect(result.order).toBe(2);
    expect(result.updated_at).toBe("2024-02-01T00:00:00.000Z");
  });

  it("returns null image_url when missing", () => {
    const doc = makeDoc("b1", { name: "Canon", slug: "canon" });
    expect(serializeBrand(doc).image_url).toBeNull();
  });
});

describe("serializeBrandForCategory", () => {
  it("prefers brand doc name over mapping name", () => {
    const brandDoc = makeDoc("b1", { name: "Canon", slug: "canon" });
    const mappingDoc = makeDoc("m1", { brand_name: "Old Canon Name", category_id: "cat1", order: 1 });
    const result = serializeBrandForCategory(brandDoc, mappingDoc, "cameras");
    expect(result.name).toBe("Canon");
  });

  it("falls back to mapping brand_name when brand name is empty", () => {
    const brandDoc = makeDoc("b1", { name: "", slug: "canon" });
    const mappingDoc = makeDoc("m1", { brand_name: "Canon from Mapping", category_id: "cat1", order: 1 });
    const result = serializeBrandForCategory(brandDoc, mappingDoc, "cameras");
    expect(result.name).toBe("Canon from Mapping");
  });

  it("includes category_slug from parameter", () => {
    const brandDoc = makeDoc("b1", { name: "Canon", slug: "canon" });
    const mappingDoc = makeDoc("m1", { category_id: "cat1", order: 1 });
    const result = serializeBrandForCategory(brandDoc, mappingDoc, "dslr-cameras");
    expect(result.category_slug).toBe("dslr-cameras");
  });

  it("uses order from mapping doc", () => {
    const brandDoc = makeDoc("b1", { name: "Canon", slug: "canon" });
    const mappingDoc = makeDoc("m1", { category_id: "cat1", order: 5 });
    const result = serializeBrandForCategory(brandDoc, mappingDoc, "cameras");
    expect(result.order).toBe(5);
  });

  it("prefers brand image_url over mapping brand_image_url", () => {
    const brandDoc = makeDoc("b1", { name: "Canon", slug: "canon", image_url: "https://brand.jpg" });
    const mappingDoc = makeDoc("m1", { category_id: "cat1", order: 1, brand_image_url: "https://mapping.jpg" });
    const result = serializeBrandForCategory(brandDoc, mappingDoc, "cameras");
    expect(result.image_url).toBe("https://brand.jpg");
  });

  it("falls back to mapping image_url when brand has no image", () => {
    const brandDoc = makeDoc("b1", { name: "Canon", slug: "canon" });
    const mappingDoc = makeDoc("m1", { category_id: "cat1", order: 1, brand_image_url: "https://mapping.jpg" });
    const result = serializeBrandForCategory(brandDoc, mappingDoc, "cameras");
    expect(result.image_url).toBe("https://mapping.jpg");
  });
});
