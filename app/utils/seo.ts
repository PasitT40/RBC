type ProductSeoInput = {
  name?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_image?: string | null;
  category_name?: string | null;
  brand_name?: string | null;
  condition?: string | null;
  shutter?: number | null;
  defect_detail?: string | null;
  cover_image?: string | null;
};

type CategorySeoInput = {
  name?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_image?: string | null;
  image_url?: string | null;
  product_count?: number | null;
};

type BrandSeoInput = {
  name?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_image?: string | null;
  image_url?: string | null;
  active_categories?: string[] | null;
};

const normalizeText = (value?: string | null) => value?.trim() || "";

const compactJoin = (parts: Array<string | null | undefined>, separator = " ") =>
  parts.map((part) => normalizeText(part)).filter(Boolean).join(separator).trim();

const limitLength = (value: string, length = 160) =>
  value.length <= length ? value : `${value.slice(0, Math.max(0, length - 1)).trimEnd()}...`;

export function resolveProductSeo(input: ProductSeoInput) {
  const title = normalizeText(input.seo_title) || normalizeText(input.name);
  const generatedDescription = compactJoin([
    normalizeText(input.brand_name),
    normalizeText(input.category_name),
    normalizeText(input.condition),
    typeof input.shutter === "number" ? `shutter ${input.shutter}` : "",
    normalizeText(input.defect_detail),
  ], " | ");

  return {
    title,
    description: normalizeText(input.seo_description) || limitLength(generatedDescription),
    image: normalizeText(input.seo_image) || normalizeText(input.cover_image),
  };
}

export function resolveCategorySeo(input: CategorySeoInput) {
  const title = normalizeText(input.seo_title) || normalizeText(input.name);
  const generatedDescription = compactJoin([
    normalizeText(input.name),
    typeof input.product_count === "number" ? `${input.product_count} public products` : "",
  ], " | ");

  return {
    title,
    description: normalizeText(input.seo_description) || limitLength(generatedDescription),
    image: normalizeText(input.seo_image) || normalizeText(input.image_url),
  };
}

export function resolveBrandSeo(input: BrandSeoInput) {
  const title = normalizeText(input.seo_title) || normalizeText(input.name);
  const generatedDescription = compactJoin([
    normalizeText(input.name),
    Array.isArray(input.active_categories) && input.active_categories.length
      ? `active in ${input.active_categories.join(", ")}`
      : "",
  ], " | ");

  return {
    title,
    description: normalizeText(input.seo_description) || limitLength(generatedDescription),
    image: normalizeText(input.seo_image) || normalizeText(input.image_url),
  };
}
