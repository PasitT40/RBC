export type SortKey = "updated_at_desc" | "sell_price_asc" | "sell_price_desc" | "condition_asc" | "condition_desc";

export type AvailabilityStatus = "available" | "reserved" | "sold";

export type ProductCard = {
  id: string;
  sku: string | null;
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
  availability_status: AvailabilityStatus;
  updated_at: string | null;
};

export type ProductDetail = ProductCard & {
  images: string[];
  shutter: string | null;
  defect_detail: string | null;
  free_gift_detail: string | null;
  tiktok_url: string | null;
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

export type BrandItem = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  order: number;
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

export type SiteBanner = {
  id: string;
  image_url: string;
  order: number;
};

export type SiteCredit = {
  id: string;
  image_url: string;
  order: number;
};

export type SiteSettings = {
  banner_auto_slide_sec: number;
  banners: SiteBanner[];
  credits: SiteCredit[];
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
