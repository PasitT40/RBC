function compactText(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export function resolveProductSeo(product: Record<string, unknown>) {
  const title = String(product.seo_title ?? "").trim() || String(product.name ?? "").trim();
  const fallbackDescription = compactText([
    product.name as string,
    product.condition ? `สภาพ ${product.condition}` : "",
    String(product.shutter ?? "").trim() ? `ชัตเตอร์ ${String(product.shutter).trim()}` : "",
    product.defect_detail as string,
  ]);

  return {
    title,
    description: String(product.seo_description ?? "").trim() || fallbackDescription,
    image: String(product.seo_image ?? "").trim() || String(product.cover_image ?? "").trim() || null,
  };
}

export function resolveCategorySeo(category: Record<string, unknown>) {
  const name = String(category.name ?? "").trim();
  return {
    title: String(category.seo_title ?? "").trim() || name,
    description: String(category.seo_description ?? "").trim() || (name ? `รวมสินค้าหมวด ${name}` : ""),
    image: String(category.seo_image ?? "").trim() || String(category.image_url ?? "").trim() || null,
  };
}

export function resolveBrandSeo(brand: Record<string, unknown>) {
  const name = String(brand.name ?? "").trim();
  return {
    title: String(brand.seo_title ?? "").trim() || name,
    description: String(brand.seo_description ?? "").trim() || (name ? `รวมสินค้าแบรนด์ ${name}` : ""),
    image: String(brand.seo_image ?? "").trim() || String(brand.image_url ?? "").trim() || null,
  };
}
