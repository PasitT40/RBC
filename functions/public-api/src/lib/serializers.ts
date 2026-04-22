import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { BrandSummary, CategorySummary, ProductCard, ProductDetail, ProductRouteContext } from "./contracts.js";
import { resolveCategorySeo, resolveProductSeo } from "./seo.js";

function asIso(value: unknown) {
  if (!value || typeof value !== "object") return null;
  if ("toDate" in (value as Record<string, unknown>) && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function asTrimmedString(value: unknown) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function serializeProductCard(doc: DocumentSnapshot, context: ProductRouteContext): ProductCard {
  const product = doc.data() ?? {};
  const categoryId = String(product.category_id ?? "");
  const brandId = String(product.brand_id ?? "");
  return {
    id: doc.id,
    sku: asTrimmedString(product.sku),
    name: String(product.name ?? ""),
    slug: String(product.slug ?? ""),
    category: {
      id: categoryId,
      name: String(product.category_name ?? ""),
      slug: context.categorySlugById.get(categoryId) ?? "",
    },
    brand: {
      id: brandId,
      name: String(product.brand_name ?? ""),
      slug: context.brandSlugById.get(brandId) ?? "",
    },
    sell_price: asNumber(product.sell_price),
    cover_image: asTrimmedString(product.cover_image),
    condition: asNumber(product.condition),
    updated_at: asIso(product.updated_at),
  };
}

export function serializeProductDetail(doc: DocumentSnapshot, context: ProductRouteContext): ProductDetail {
  const product = doc.data() ?? {};
  return {
    ...serializeProductCard(doc, context),
    images: Array.isArray(product.images) ? product.images.map((item) => String(item)).filter(Boolean) : [],
    shutter: asTrimmedString(product.shutter),
    defect_detail: asTrimmedString(product.defect_detail),
    free_gift_detail: asTrimmedString(product.free_gift_detail),
    seo: resolveProductSeo(product),
  };
}

export function serializeCategory(doc: DocumentSnapshot): CategorySummary {
  const category = doc.data() ?? {};
  return {
    id: doc.id,
    name: String(category.name ?? ""),
    slug: String(category.slug ?? ""),
    image_url: asTrimmedString(category.image_url),
    order: asNumber(category.order) ?? 0,
    seo: resolveCategorySeo(category),
    updated_at: asIso(category.updated_at),
  };
}

export function serializeBrandForCategory(
  brandDoc: DocumentSnapshot,
  mappingDoc: DocumentSnapshot,
  categorySlug: string
): BrandSummary {
  const brand = brandDoc.data() ?? {};
  const mapping = mappingDoc.data() ?? {};
  return {
    id: brandDoc.id,
    name: String(brand.name ?? mapping.brand_name ?? ""),
    slug: String(brand.slug ?? ""),
    image_url: asTrimmedString(brand.image_url ?? mapping.brand_image_url),
    order: asNumber(mapping.order) ?? 0,
    category_id: String(mapping.category_id ?? ""),
    category_slug: categorySlug,
    updated_at: asIso(brand.updated_at ?? mapping.updated_at),
  };
}
