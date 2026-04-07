import { normalizeProductCondition } from "./condition";
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
  const costPrice = Number(product.cost_price);
  const sellPrice = Number(product.sell_price);
  const hasCondition = product.condition !== undefined && product.condition !== null && String(product.condition).trim() !== "";
  const defectDetail = String(product.defect_detail ?? "").trim();
  const freeGiftDetail = String(product.free_gift_detail ?? "").trim();
  const shutter = Number(product.shutter);
  const coverImage = String(product.cover_image ?? "").trim();
  const images = sanitizeProductImageUrls(product.images);
  const hasImage = Boolean(coverImage) || images.length > 0;

  if (!name) issues.push("กรุณาใส่ชื่อสินค้า");
  if (!slug) {
    issues.push("ยังสร้างลิงก์สินค้าไม่สำเร็จ ลองตรวจชื่อสินค้าอีกครั้ง");
  } else if (!isValidProductSlug(slug)) {
    issues.push("ลิงก์สินค้ายังไม่ถูกต้อง");
  }
  if (!categoryId) issues.push("กรุณาเลือกประเภทสินค้า");
  if (!brandId) issues.push("กรุณาเลือกแบรนด์");
  if (typeof product.cost_price !== "number" || Number.isNaN(costPrice)) {
    issues.push("กรุณาใส่ราคาทุน");
  }
  if (typeof product.sell_price !== "number" || Number.isNaN(sellPrice)) {
    issues.push("กรุณาใส่ราคาขาย");
  }
  if (!hasCondition || Number.isNaN(normalizeProductCondition(product.condition, Number.NaN))) {
    issues.push("กรุณาระบุคุณภาพสินค้า");
  }
  if (typeof product.shutter !== "number" || Number.isNaN(shutter)) {
    issues.push("กรุณาใส่จำนวนชัตเตอร์");
  }
  if (!defectDetail) issues.push("กรุณาใส่รายละเอียดตำหนิ");
  if (!freeGiftDetail) issues.push("กรุณาใส่ของแถม");
  if (!hasImage) issues.push("กรุณาใส่รูปสินค้าอย่างน้อย 1 รูป");

  return issues;
}

export function formatPublicProductIssues(issues: string[]) {
  return issues
    .map((issue) => String(issue ?? "").trim())
    .filter(Boolean)
    .map((issue) => `• ${issue}`)
    .join("<br>");
}

export function assertPublicReadyProduct(product: Partial<ProductInput & ProductRecord>) {
  if (!product.show) return;

  const issues = getPublicProductIssues(product);
  if (issues.length > 0) throw new Error(formatPublicProductIssues(issues));
}
