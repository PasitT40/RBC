import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";

// สถานะสินค้าอิงจาก AGENTS.md / firestore.spec.md
// - ACTIVE: พร้อมขาย
// - RESERVED: จองแล้ว ยังขายไม่ได้
// - SOLD: ขายแล้ว และต้องผูกกับ orders/{orderId}
export type ProductStatus = "ACTIVE" | "RESERVED" | "SOLD";

// สถานะออเดอร์สำหรับวงจรการขาย
export type OrderStatus = "CONFIRMED" | "CANCELLED";

// ข้อมูลขั้นต่ำที่ต้องใช้สร้างสินค้าใน backoffice
// ฟิลด์หลัก map ตรงกับ schema ของ products/{productId} ตาม docs/firestore.spec.md
export type ProductInput = {
  id?: string;
  name: string;
  slug: string;
  category_id: string;
  category_name: string;
  brand_id: string;
  brand_name: string;
  seo_title?: string;
  seo_description?: string;
  seo_image?: string;
  cost_price: number;
  sell_price: number;
  condition?: string;
  shutter?: number | null;
  defect_detail?: string;
  free_gift_detail?: string;
  cover_image?: string;
  images?: string[];
  cover_file?: File | null;
  image_files?: File[];
  show?: boolean;
  status?: ProductStatus;
};

export type ProductRecord = ProductInput & {
  id: string;
  is_sellable?: boolean;
  is_deleted?: boolean;
  last_status_before_sold?: ProductStatus | null;
  sold_at?: unknown;
  sold_price?: number | null;
  sold_channel?: string | null;
  sold_ref?: string | null;
  created_at?: unknown;
  updated_at?: unknown;
};

export type CategoryRecord = {
  id: string;
  name: string;
  slug?: string;
  image_url?: string | null;
  seo_title?: string;
  seo_description?: string;
  seo_image?: string | null;
  is_active?: boolean;
  order?: number;
  created_at?: unknown;
  updated_at?: unknown;
};

export type BrandRecord = {
  id: string;
  name: string;
  slug?: string;
  image_url?: string | null;
  seo_title?: string;
  seo_description?: string;
  seo_image?: string | null;
  is_active?: boolean;
  order?: number;
  created_at?: unknown;
  updated_at?: unknown;
};

export type CategoryBrandRecord = {
  id: string;
  category_id: string;
  category_name?: string;
  category_slug?: string;
  brand_id: string;
  brand_name?: string;
  brand_image_url?: string | null;
  is_active?: boolean;
  order?: number;
  created_at?: unknown;
  updated_at?: unknown;
};

// payload สำหรับยืนยันการขาย
export type ConfirmSaleInput = {
  productId: string;
  sold_price: number;
  sold_channel: string;
  fee?: number;
  idempotencyKey?: string;
};

export type OrderRecord = {
  id: string;
  status: OrderStatus;
  product_id: string;
  previous_product_status?: ProductStatus;
  category_id?: string;
  brand_id?: string;
  brand_name?: string;
  sold_channel?: string;
  sold_price?: number;
  sold_yyyymm?: string;
  cost_price_at_sale?: number;
  fee?: number;
  profit?: number;
  sold_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  product_snapshot?: {
    name?: string;
    slug?: string;
    cover_image?: string;
    category_name?: string;
    brand_name?: string;
  };
};

export type DashboardStatsRecord = {
  id: string;
  total_products: number | null;
  active_products: number | null;
  reserved_products: number | null;
  sold_products: number | null;
  visible_products: number | null;
  total_sales_count: number;
  total_sales_amount: number;
  total_cost_amount: number;
  total_profit_amount: number;
  updated_at?: unknown;
  period?: DashboardPeriodInput | { kind: "none" | "month" | "range"; month?: string; fromMonth?: string; toMonth?: string };
};

export type DashboardBrandStatsRecord = {
  id: string;
  brand_id: string;
  brand_name: string;
  sales_count: number;
  sales_amount: number;
  cost_amount: number;
  profit_amount: number;
  updated_at?: unknown;
  period?: DashboardPeriodInput | { kind: "none" | "month" | "range"; month?: string; fromMonth?: string; toMonth?: string };
};

export type PageCursor = QueryDocumentSnapshot<DocumentData, DocumentData> | null | undefined;

export type PageResult<T> = {
  items: T[];
  nextCursor: PageCursor;
  hasMore: boolean;
};

export type ProductsPageInput = {
  pageSize?: number;
  cursor?: PageCursor;
  categoryId?: string;
  brandId?: string;
  status?: ProductStatus;
  show?: boolean;
};

export type CategoriesPageInput = {
  pageSize?: number;
  cursor?: PageCursor;
  isActive?: boolean;
};

export type SubcategoriesPageInput = {
  pageSize?: number;
  cursor?: PageCursor;
  isActive?: boolean;
};

export type ReportPageInput = {
  pageSize?: number;
  cursor?: PageCursor;
  month?: string; // YYYY-MM
  status?: OrderStatus;
  brandId?: string;
  soldChannel?: string;
};

export type DashboardPeriodInput = {
  month?: string; // YYYY-MM
  fromMonth?: string; // YYYY-MM
  toMonth?: string; // YYYY-MM
  maxOrders?: number;
};

export type DashboardBrandStatsInput = DashboardPeriodInput & {
  count?: number;
};
