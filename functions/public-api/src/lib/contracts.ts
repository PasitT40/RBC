export type SortKey = "updated_at_desc" | "sell_price_asc" | "sell_price_desc";

export type ProductCard = {
  id: string;
  name: string;
  slug: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  brand: {
    id: string;
    name: string;
    slug: string;
  };
  sell_price: number | null;
  cover_image: string | null;
  condition: number | null;
  updated_at: string | null;
};

export type ProductDetail = ProductCard & {
  images: string[];
  shutter: number | null;
  defect_detail: string | null;
  free_gift_detail: string | null;
  seo: {
    title: string;
    description: string;
    image: string | null;
  };
};

export type CategorySummary = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  order: number;
  seo: {
    title: string;
    description: string;
    image: string | null;
  };
  updated_at: string | null;
};

export type BrandSummary = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  order: number;
  category_id: string;
  category_slug: string;
  updated_at: string | null;
};

export type PaginatedResponse<T> = {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
};

export type ProductRouteContext = {
  categorySlugById: Map<string, string>;
  brandSlugById: Map<string, string>;
};
