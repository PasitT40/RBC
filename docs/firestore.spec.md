# Firestore Specification

Project: Camera Marketplace Backoffice (Single Owner)

This spec is aligned to the current backoffice flows and is intended to be safe for real web usage with minimal changes to the original requirements.

## Core concepts
- Single-owner backoffice
- Brands are global documents in `brands/{brandId}`
- Category -> Brand relation uses `category_brands` mapping only
- Product deletion is soft delete
- Dashboard documents are cached aggregates and must be updated on writes
- Sell and undo sale must use Firestore transactions
- Stats ledger is used for idempotency and auditability

## Terminology note
- There is no persisted `subcategories` collection in Firestore
- In the current backoffice UI, the label `Subcategory` is a presentation term for managing global `brands` together with their primary `category_brands` mapping
- Schema, rules, and data migrations must treat these records as `brands` and `category_brands`, not as a separate nested model

## Product lifecycle semantics
- Persisted product status uses only: `ACTIVE | RESERVED | SOLD`
- Soft-deleted products are represented by `is_deleted = true`
- `DELETED` may be used as a derived UI display state, but is not required to be stored in `products.status`
- `show = false` means hidden from the frontend
- `is_sellable = true` means the product is allowed to enter a sale transaction

## Collections

### owners
`owners/{uid}`
- email
- display_name
- created_at

Usage:
- allowlist for backoffice access
- should be readable only by authenticated backoffice owner accounts

### settings
`settings/site`
- banner_auto_slide_sec
- banners[]
- credits[]
- updated_at

Usage:
- site-wide configuration for frontend rendering

### categories
`categories/{categoryId}`
- name
- slug
- image_url
- seo_title
- seo_description
- seo_image
- order
- is_active
- created_at
- updated_at

Semantics:
- `order` is a global display order within categories
- inactive categories remain stored for historical references and backoffice editing
- normal category merchandising work should be manageable from the backoffice, including `order`
- SEO fields are optional but recommended for production public pages
- if `seo_image` is absent, public pages may fall back to `image_url`

### brands
`brands/{brandId}`
- name
- slug
- image_url
- seo_title
- seo_description
- seo_image
- order
- is_active
- created_at
- updated_at

Semantics:
- brands are global and must never be nested under categories
- `order` is a global display order within brands
- normal brand merchandising work should be manageable from the backoffice against `brands/{brandId}`
- SEO fields are optional but recommended for production public pages
- if `seo_image` is absent, public pages may fall back to `image_url`

### category_brands
`category_brands/{categoryId__brandId}`
- category_id
- category_name
- category_slug
- brand_id
- brand_name
- brand_image_url
- order
- is_active
- created_at
- updated_at

Semantics:
- this is the only source for category -> brand dropdown options
- `order` is scoped within a single `category_id`, not globally across all mappings
- denormalized `category_*` and `brand_*` fields are allowed for faster UI reads
- normal category-specific brand ordering should be manageable from the backoffice against `category_brands.order`
- a product must not be made publicly visible if its `category_id + brand_id` mapping is missing or inactive here

### products
`products/{productId}`
- sku
- sku_seq
- name
- slug
- category_id
- category_name
- brand_id
- brand_name
- seo_title
- seo_description
- seo_image
- cost_price
- sell_price
- condition
- shutter
- defect_detail
- free_gift_detail
- cover_image
- images[]
- status: `ACTIVE | RESERVED | SOLD`
- show
- is_sellable
- is_deleted
- deleted_at
- last_status_before_sold
- sold_at
- sold_price
- sold_channel
- sold_ref
- created_at
- updated_at

Semantics:
- `productId` may remain an auto-generated Firestore id; operator-facing SKU should live in `sku`
- `sku` is the immutable operator-facing product code, recommended format `RBC-001`
- `sku_seq` stores the numeric sequence used to derive `sku`
- `is_deleted = true` means the product is removed from normal listing/detail flows
- deleted products should also have `show = false` and `is_sellable = false`
- `last_status_before_sold` is used to restore the product on undo sale
- product slug should be normalized deterministically from operator input into lowercase hyphenated form
- product slug should be unique across all products before a product becomes publicly visible
- `cover_image` should point to the primary image used in listings
- `images[]` stores the ordered detail images currently attached to the product
- normal product image management should be achievable from the backoffice by ordering `images[]`; the first image becomes `cover_image`
- SEO fields are optional but recommended for production public pages
- if `seo_image` is absent, public pages may fall back to `cover_image`
- if `show = true`, the referenced `category_brands/{categoryId__brandId}` mapping must exist and remain active

### counters
`counters/products`
- prefix
- last_sku_seq
- updated_at

Semantics:
- stores the last reserved sequence for product SKU generation
- `createProduct` should reserve the next sequence through a transaction-safe counter update before the product batch write
- gaps in SKU numbering are acceptable if a reserved number is not later committed into a product document

### orders
`orders/{orderId}`
- status: `CONFIRMED | CANCELLED`
- product_id
- previous_product_status
- category_id
- brand_id
- brand_name
- sold_channel
- sold_price
- sold_yyyymm
- cost_price_at_sale
- profit
- sold_at
- created_at
- updated_at
- product_snapshot

`product_snapshot` should include at least:
- sku
- name
- slug
- cover_image
- category_name
- brand_name

Semantics:
- `orderId` may be caller-provided for idempotency
- `previous_product_status` is persisted so undo sale can restore state reliably even if the product document changes later
- `sold_at` should represent the effective sale date selected by the operator
- `sold_yyyymm` should be derived from `sold_at`
- cancelled orders are retained for audit history

### dashboard_stats
`dashboard_stats/global`
- total_products
- active_products
- reserved_products
- sold_products
- visible_products
- total_sales_count
- total_sales_amount
- total_cost_amount
- total_profit_amount
- updated_at

Semantics:
- cached aggregate document for the whole system
- must be updated inside the same write flow as the source mutation
- not the ultimate source of truth for incident recovery

### dashboard_brand_stats
`dashboard_brand_stats/{brandId}`
- brand_id
- brand_name
- sales_count
- sales_amount
- cost_amount
- profit_amount
- updated_at

Semantics:
- cached aggregate per brand
- must be updated during sell and undo sale flows

### stats_ledger
`stats_ledger/{ledgerId}`
- type
- ref_id
- entity_type
- entity_id
- operation_key
- product_id
- created_at

Semantics:
- used to make sell and undo sale idempotent
- `ledgerId` should be deterministic per business operation
- `entity_type` should currently be `order`
- `entity_id` should be the related `orderId`
- `operation_key` should match the deterministic business operation key
- `product_id` is optional but recommended for faster operational tracing
- minimum expected operations:
  - `SALE_APPLIED_{orderId}`
  - `SALE_REVERTED_{orderId}`

## Query contracts

### Backoffice queries
- Category management list:
  all categories ordered by `order`, including inactive rows so they remain editable in backoffice
- Brand/Subcategory management list:
  all brands ordered by global brand `order`, enriched with one primary `category_brands` mapping for display
- Brand dropdown by category:
  `category_brands where category_id == X and is_active == true orderBy(order)`
- Product list:
  default backoffice list returns non-deleted products ordered by latest creation or update as needed by the UI
- Monthly report:
  `orders where status == "CONFIRMED" and sold_yyyymm == "YYYY-MM"`

### Frontend product visibility
Frontend product listing/detail pages must use all of the following:
- `show == true`
- `is_deleted == false`
- status appropriate to the surface, usually `status == "ACTIVE"`
- only display products that are intended to be publicly visible

### Dashboard reads
- default dashboard may read from cached aggregate docs:
  - `dashboard_stats/global`
  - `dashboard_brand_stats/{brandId}`
- filtered dashboard periods may compute from confirmed orders directly
- when filtered results are computed from orders, `total_products`, `active_products`, `reserved_products`, and `visible_products` may be unavailable or null because they are global cached counters, not period-scoped metrics

## Write flows

### createProduct
Type:
- Batch

Steps:
1. reserve the next SKU sequence from `counters/products` through a transaction-safe counter update
2. create product document
3. initialize derived fields:
   - `sku = RBC-###`
   - `sku_seq = next reserved sequence`
   - `status = ACTIVE` unless explicitly overridden
   - `show = true` unless explicitly overridden
   - `is_sellable = (status == ACTIVE)`
   - `is_deleted = false`
4. normalize `slug` deterministically before write
5. reject duplicate slug before write
6. if `show == true`, enforce the minimum publishable product contract
7. update cached dashboard counters

Required effects:
- increment `total_products`
- increment the relevant status counter
- increment `visible_products` when `show == true`

### updateProduct
Type:
- Normal write or batch

Steps:
1. load current product
2. reject if product does not exist or is soft-deleted
3. normalize `slug` deterministically before write
4. reject duplicate slug before write
5. keep existing `sku` and `sku_seq` unchanged
6. if current product is publicly visible, enforce the minimum publishable product contract
7. update editable fields
8. keep image ordering consistent with current payload

Required effects:
- must not change dashboard counters unless lifecycle fields actually change
- image storage cleanup should happen after successful document write
- if new image uploads happen before the document write, failed writes must clean up those uploads

### toggleShow
Type:
- Batch

Steps:
1. update `product.show`
2. update `dashboard_stats.visible_products`

Rules:
- soft-deleted products must not be toggled back into frontend visibility
- toggling to `show = true` must fail if the product does not satisfy the minimum publishable product contract
- toggling to `show = true` must fail if the category-brand mapping is missing or inactive

### setReserved
Type:
- Batch

Valid transition:
- `ACTIVE -> RESERVED`

Steps:
1. verify product exists and is not soft-deleted
2. verify product is not sold
3. set `status = RESERVED`
4. set `is_sellable = false`
5. update dashboard counters:
   - `active_products --`
   - `reserved_products ++`

### setActive
Type:
- Batch

Valid transition:
- `RESERVED -> ACTIVE`

Steps:
1. verify product exists and is not soft-deleted
2. verify product is not sold
3. set `status = ACTIVE`
4. set `is_sellable = true`
5. update dashboard counters:
   - `reserved_products --`
   - `active_products ++`

### deleteProduct
Type:
- Batch

Behavior:
- soft delete only

Steps:
1. verify product exists and is not already deleted
2. allow delete only from `ACTIVE`
3. set:
   - `is_deleted = true`
   - `deleted_at = serverTimestamp()`
   - `show = false`
   - `is_sellable = false`
4. update dashboard counters:
   - `total_products --`
   - `active_products --`
   - `visible_products --` only if previously visible

Note:
- UI may render this state as `DELETED`

### confirmSale
Type:
- Transaction only

Steps:
1. read product
2. ensure product exists
3. ensure product is not deleted
4. ensure product is sellable
5. ensure product is not already sold
6. check `stats_ledger`
7. create order
8. update product sold fields
9. update `dashboard_stats`
10. update `dashboard_brand_stats`
11. create `stats_ledger` entry

Required effects:
- order status becomes `CONFIRMED`
- product status becomes `SOLD`
- `is_sellable = false`
- `last_status_before_sold` stores the product status before sale
- order stores `previous_product_status`

### undoSale
Type:
- Transaction only

Steps:
1. read order
2. ensure order exists and is not already cancelled
3. check `stats_ledger`
4. read product
5. cancel order
6. restore product previous status
7. rollback `dashboard_stats`
8. rollback `dashboard_brand_stats`
9. create `stats_ledger` entry

Required effects:
- order status becomes `CANCELLED`
- product status is restored from `order.previous_product_status`, or fallback to `last_status_before_sold`
- sold-related product fields are cleared

## Aggregate and recovery policy

### Cached aggregate policy
- `dashboard_stats` and `dashboard_brand_stats` are cached views
- all source-of-truth writes must update them immediately
- cached values may be read directly for unfiltered dashboard views

### Rebuild policy
The system should support an admin-only rebuild operation that recalculates:
- `dashboard_stats/global` from `products` and `orders`
- `dashboard_brand_stats/*` from confirmed orders

Use rebuild when:
- counters drift
- migration changes business logic
- historical data is repaired manually

If historical `stats_ledger` documents predate the current idempotency contract, repair those ledger payloads separately from aggregate rebuilds using the corresponding order documents as the source of truth.

## Idempotency policy
- sell and undo sale must be safely retryable
- deterministic ledger IDs are required for replay protection
- deterministic order IDs may be used when the caller already owns an idempotency key
- ledger documents should be treated as immutable audit markers after creation

## Security and write boundaries
- backoffice writes should be restricted to authenticated owner accounts
- public frontend must not be allowed to write products, orders, categories, brands, or dashboard aggregates directly
- if some writes are moved to server endpoints or Cloud Functions later, the Firestore schema and flow semantics in this spec remain the same

## Notes for implementation alignment
- frontend may display a synthetic `DELETED` state even though persisted product status remains `ACTIVE | RESERVED | SOLD`
- product image uploads are implementation details and may happen before document commit, but failed writes should clean up newly uploaded files
- inactive categories or brands may still appear in historical documents through denormalized names even when hidden from current dropdowns
