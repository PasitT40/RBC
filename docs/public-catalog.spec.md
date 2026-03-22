# Public Catalog Specification

Project: Camera Marketplace Public Website

This spec extends [firestore.spec.md](./firestore.spec.md) for the customer-facing product catalog.
It keeps the existing data model and only adds the minimum production-grade contracts needed for a real public website.

## Goals
- Reuse the current Firestore product model without changing core backoffice requirements
- Define safe public visibility rules
- Define route, query, filter, and sort contracts for a production website
- Define the minimum extra content and SEO fields recommended for a public catalog
- Define deployment and access boundaries suitable for production

## Source of truth
- Product lifecycle and inventory truth comes from `products`
- Category and brand navigation truth comes from `categories`, `brands`, and `category_brands`
- Sales and dashboard data are not required for the public catalog rendering path

## Public visibility rules

### A product is public only when all conditions are true
- `show == true`
- `is_deleted == false`
- `status == "ACTIVE"`

### A product must not appear publicly when any condition is true
- `show == false`
- `is_deleted == true`
- `status == "RESERVED"`
- `status == "SOLD"`

Reasoning:
- this matches the current backoffice intent
- it avoids exposing unavailable inventory as if it were purchasable
- it keeps the public site simple and predictable

If the business later wants to show sold or reserved items, that should be introduced as an explicit display policy rather than inferred from the current model.

## Public routes

The recommended public routes are:
- `/`
- `/products`
- `/products/[slug]`
- `/categories/[categorySlug]`
- `/categories/[categorySlug]/[brandSlug]`

Optional future routes:
- `/brands/[brandSlug]`
- `/search`

Route semantics:
- category pages should show public products within the selected category
- category + brand pages should show public products filtered by both category and brand
- product detail pages should resolve by `slug`

## Route resolution contract

### Product detail
Resolve a product by:
- `slug == :slug`
- `show == true`
- `is_deleted == false`
- `status == "ACTIVE"`

Expected result:
- exactly one visible product

Production recommendation:
- `slug` should be unique across all public products
- if slug uniqueness is not guaranteed yet, add an internal canonical resolution rule before launch

### Category page
Resolve category by:
- `categories.slug == :categorySlug`
- `is_active == true`

Then load products by:
- `category_id == category.id`
- `show == true`
- `is_deleted == false`
- `status == "ACTIVE"`

### Category + brand page
Resolve category and brand from slugs, then verify the mapping exists in `category_brands`

Then load products by:
- `category_id == category.id`
- `brand_id == brand.id`
- `show == true`
- `is_deleted == false`
- `status == "ACTIVE"`

## Public query contracts

### Product listing
Base listing query:
- `show == true`
- `is_deleted == false`
- `status == "ACTIVE"`

Recommended default sort:
- `updated_at desc`

Recommended page size:
- 24 products per page on desktop list pages
- 12 to 24 products per page on mobile list pages

Recommended pagination:
- cursor-based pagination

### Category navigation
Category navigation query:
- `categories where is_active == true orderBy(order)`

### Brand navigation inside a category
Brand navigation query:
- `category_brands where category_id == X and is_active == true orderBy(order)`

The public website should not derive category-brand membership directly from `products`.
It should use `category_brands` as the declared navigation structure.

## Sorting contract

Supported public sorts should be kept minimal at launch:
- `updated_at desc`
- `sell_price asc`
- `sell_price desc`

Do not expose many sorts unless they are backed by real UX need and Firestore indexes.

## Filter contract

Recommended launch filters:
- category
- brand within category
- price range

Optional later filters:
- condition
- shutter range

Production note:
- Firestore multi-filter combinations can explode index count quickly
- for launch, keep filters limited and predictable

## Product card contract

Every public listing card should have at least:
- `name`
- `slug`
- `cover_image`
- `category_name`
- `brand_name`
- `sell_price`

Optional but recommended:
- `condition`
- short availability badge if business later chooses to expose non-active states

## Product detail contract

Every public detail page should have at least:
- `name`
- `slug`
- `category_name`
- `brand_name`
- `sell_price`
- `cover_image`
- `images[]`
- `condition`
- `shutter`
- `defect_detail`
- `free_gift_detail`

Presentation rules:
- `cover_image` is the primary hero image
- `images[]` keeps display order from backoffice
- nullable fields should be hidden cleanly when not present

## SEO contract

SEO fields are now part of the official schema as optional fields.

### Product SEO fields
- `seo_title?`
- `seo_description?`
- `seo_image?`

### Category SEO fields
- `seo_title?`
- `seo_description?`
- `seo_image?`

### Brand SEO fields
- `seo_title?`
- `seo_description?`
- `seo_image?`

### Fallback rules
- product:
  - `seo_title ?? name`
  - `seo_description ?? generated summary from category_name, brand_name, condition, shutter, and defect_detail`
  - `seo_image ?? cover_image`
- category:
  - `seo_title ?? name`
  - `seo_description ?? generated summary from category name and public product count if available`
  - `seo_image ?? image_url`
- brand:
  - `seo_title ?? name`
  - `seo_description ?? generated summary from brand name and active categories if available`
  - `seo_image ?? image_url`

Canonical rules:
- product canonical URL uses `/products/[slug]`
- category canonical URL uses `/categories/[categorySlug]`
- category + brand canonical URL uses `/categories/[categorySlug]/[brandSlug]`

Production recommendation:
- keep SEO fields optional at the data layer
- do not block backoffice save flows when SEO fields are blank
- allow public pages to render safely through fallback rules

## Content quality contract

Before a product is made public, the recommended content minimum is:
- non-empty `name`
- valid `slug`
- selected category
- selected brand
- valid `sell_price`
- at least one image, preferably `cover_image`

For launch readiness, the backoffice should ideally prevent public visibility when the content is incomplete.

## Image policy

Recommended production policy:
- `cover_image` is mandatory for public products
- all product images should be web-friendly compressed assets
- images should be HTTPS URLs
- broken or missing images should fall back to a placeholder

Optional future improvements:
- thumbnail variants
- responsive image sizes
- CDN/image optimization layer

## Access architecture

### Recommended production pattern
Use server-rendered or API-backed reads for the public website instead of unrestricted direct Firestore client reads.

Recommended options:
- Nuxt server routes as a read layer
- SSR data fetching on the public app
- optional cached edge responses for list pages

Why:
- centralizes visibility enforcement
- simplifies SEO and metadata generation
- avoids exposing broader Firestore read access than necessary
- allows response caching and future search integration

### If direct Firestore reads are used
Then Firestore security rules must strictly limit reads to public-safe documents only.

This is harder to maintain and less flexible than a server read layer.

## Caching strategy

Recommended launch caching:
- category and brand navigation: medium cache lifetime
- product lists: short cache lifetime
- product details: short to medium cache lifetime with revalidation

Because inventory changes matter, the public catalog should prefer freshness over aggressive long-lived caching.

## Search strategy

For launch:
- simple filter-based browsing is enough

For later:
- move full-text search to a dedicated search system
  examples: Algolia, Meilisearch, OpenSearch

Do not force Firestore into acting like a full-text search engine.

## Index requirements

At minimum, production should expect indexes for public listing patterns such as:
- `products: show, is_deleted, status, updated_at`
- `products: category_id, show, is_deleted, status, updated_at`
- `products: category_id, brand_id, show, is_deleted, status, updated_at`
- `products: category_id, show, is_deleted, status, sell_price`
- `products: category_id, brand_id, show, is_deleted, status, sell_price`

Exact composite index definitions may vary depending on the chosen sort/filter combinations.

## Error handling contract

### 404 conditions
Return not found when:
- category slug does not resolve
- brand slug does not resolve
- category-brand mapping does not exist
- product slug does not resolve to a public-visible product

### 410 or redirect policy
For later, the business may choose to distinguish:
- deleted or unpublished products
- sold or reserved products

At launch, returning a normal 404 is acceptable and simpler.

## Analytics recommendations

Recommended public events:
- product_list_view
- product_detail_view
- filter_applied
- sort_changed
- outbound_contact_click

These are outside Firestore schema but should be planned early because they affect route and component design.

## Operational recommendations before public launch

Before shipping the public website, verify:
- all public products satisfy the visibility contract
- every public product has a valid slug
- slug collisions are resolved
- every public product has at least one image
- required Firestore indexes exist
- server/API layer enforces public visibility rules consistently
- 404 behavior is implemented for hidden, deleted, reserved, and sold products

## Minimal schema changes recommended for production

These are recommended, not required for launch:
- optional `published_at` if the business later wants scheduled publishing

Everything else can ship on top of the current model.
