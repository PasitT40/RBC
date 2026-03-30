import type { ProductInput, ProductRecord } from "./types";

const PRODUCT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeProductSlug(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidProductSlug(value: string) {
  return PRODUCT_SLUG_RE.test(String(value ?? "").trim());
}

export function sanitizeProductImageUrls(urls: string[] | undefined | null) {
  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const rawUrl of Array.isArray(urls) ? urls : []) {
    const url = String(rawUrl ?? "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    sanitized.push(url);
  }

  return sanitized;
}

export function getPublicProductIssues(product: Partial<ProductInput & ProductRecord>) {
  const issues: string[] = [];
  const name = String(product.name ?? "").trim();
  const slug = String(product.slug ?? "").trim();
  const categoryId = String(product.category_id ?? "").trim();
  const brandId = String(product.brand_id ?? "").trim();
  const sellPrice = Number(product.sell_price);
  const coverImage = String(product.cover_image ?? "").trim();
  const images = sanitizeProductImageUrls(product.images);
  const hasImage = Boolean(coverImage) || images.length > 0;

  if (!name) issues.push("Public products require a name");
  if (!slug) {
    issues.push("Public products require a slug");
  } else if (!isValidProductSlug(slug)) {
    issues.push("Public products require a valid slug");
  }
  if (!categoryId) issues.push("Public products require a category");
  if (!brandId) issues.push("Public products require a brand");
  if (typeof product.sell_price !== "number" || Number.isNaN(sellPrice)) {
    issues.push("Public products require a valid sell price");
  }
  if (!hasImage) issues.push("Public products require at least one image");

  return issues;
}

export function assertPublicReadyProduct(product: Partial<ProductInput & ProductRecord>) {
  if (!product.show) return;

  const issues = getPublicProductIssues(product);
  if (issues.length > 0) throw new Error(issues[0]);
}
