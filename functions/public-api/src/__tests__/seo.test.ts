import { describe, it, expect } from "vitest";
import { resolveProductSeo, resolveCategorySeo, resolveBrandSeo } from "../lib/seo.js";

describe("resolveProductSeo", () => {
  it("uses seo_title when present", () => {
    const seo = resolveProductSeo({ name: "Canon R5", seo_title: "Buy Canon R5" });
    expect(seo.title).toBe("Buy Canon R5");
  });

  it("falls back to name when seo_title is missing", () => {
    const seo = resolveProductSeo({ name: "Canon R5" });
    expect(seo.title).toBe("Canon R5");
  });

  it("falls back to name when seo_title is empty string", () => {
    const seo = resolveProductSeo({ name: "Canon R5", seo_title: "" });
    expect(seo.title).toBe("Canon R5");
  });

  it("uses seo_description when present", () => {
    const seo = resolveProductSeo({ name: "Canon R5", seo_description: "Best mirrorless" });
    expect(seo.description).toBe("Best mirrorless");
  });

  it("builds fallback description from name and condition", () => {
    const seo = resolveProductSeo({ name: "Canon R5", condition: 4 });
    expect(seo.description).toContain("Canon R5");
    expect(seo.description).toContain("สภาพ 4");
  });

  it("includes shutter in fallback description when present", () => {
    const seo = resolveProductSeo({ name: "Canon R5", shutter: "50000" });
    expect(seo.description).toContain("ชัตเตอร์ 50000");
  });

  it("uses seo_image when present", () => {
    const seo = resolveProductSeo({ seo_image: "https://example.com/seo.jpg" });
    expect(seo.image).toBe("https://example.com/seo.jpg");
  });

  it("falls back to cover_image for image", () => {
    const seo = resolveProductSeo({ cover_image: "https://example.com/cover.jpg" });
    expect(seo.image).toBe("https://example.com/cover.jpg");
  });

  it("returns null image when no image fields set", () => {
    const seo = resolveProductSeo({ name: "X" });
    expect(seo.image).toBeNull();
  });

  it("returns null image when seo_image and cover_image are empty strings", () => {
    const seo = resolveProductSeo({ seo_image: "", cover_image: "" });
    expect(seo.image).toBeNull();
  });
});

describe("resolveCategorySeo", () => {
  it("uses seo_title when present", () => {
    const seo = resolveCategorySeo({ name: "กล้องดิจิตอล", seo_title: "กล้องดิจิตอล SEO" });
    expect(seo.title).toBe("กล้องดิจิตอล SEO");
  });

  it("falls back to name for title", () => {
    const seo = resolveCategorySeo({ name: "กล้องดิจิตอล" });
    expect(seo.title).toBe("กล้องดิจิตอล");
  });

  it("uses seo_description when present", () => {
    const seo = resolveCategorySeo({ name: "กล้องดิจิตอล", seo_description: "หมวดกล้อง" });
    expect(seo.description).toBe("หมวดกล้อง");
  });

  it("builds fallback description from name", () => {
    const seo = resolveCategorySeo({ name: "กล้องดิจิตอล" });
    expect(seo.description).toContain("กล้องดิจิตอล");
  });

  it("returns empty description when name is empty", () => {
    const seo = resolveCategorySeo({ name: "" });
    expect(seo.description).toBe("");
  });

  it("falls back to image_url for image", () => {
    const seo = resolveCategorySeo({ image_url: "https://img.jpg" });
    expect(seo.image).toBe("https://img.jpg");
  });

  it("returns null image when no image fields", () => {
    const seo = resolveCategorySeo({ name: "X" });
    expect(seo.image).toBeNull();
  });
});

describe("resolveBrandSeo", () => {
  it("uses seo_title when present", () => {
    const seo = resolveBrandSeo({ name: "Canon", seo_title: "Canon Cameras" });
    expect(seo.title).toBe("Canon Cameras");
  });

  it("falls back to name for title", () => {
    const seo = resolveBrandSeo({ name: "Canon" });
    expect(seo.title).toBe("Canon");
  });

  it("builds fallback description mentioning brand name", () => {
    const seo = resolveBrandSeo({ name: "Canon" });
    expect(seo.description).toContain("Canon");
  });

  it("returns null image when no image fields", () => {
    const seo = resolveBrandSeo({ name: "Canon" });
    expect(seo.image).toBeNull();
  });

  it("falls back to image_url for image", () => {
    const seo = resolveBrandSeo({ name: "Canon", image_url: "https://canon.jpg" });
    expect(seo.image).toBe("https://canon.jpg");
  });
});
