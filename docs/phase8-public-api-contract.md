# Phase 8 Public API Contract

Project: Camera Marketplace Public Catalog

This document defines the public read API contract for the customer-facing catalog in Phase 8.
It extends the rules in [`docs/public-catalog.spec.md`](./public-catalog.spec.md), [`docs/firestore.spec.md`](./firestore.spec.md), and [`docs/security-boundaries.md`](./security-boundaries.md).

## Objective

Expose only frontend-safe catalog data through a controlled backend read layer.

The public website must not read private operational Firestore collections directly from the browser.

## Current deployment constraint

The current backoffice deployment uses static Nuxt generation plus Firebase Hosting.

Because of that, Phase 8 should introduce a separate runtime-backed API layer for `/api/**`, for example:

- Firebase Functions v2
- Cloud Run
- another trusted server runtime with Firebase Admin SDK

Do not assume Nuxt server routes inside the current static Hosting deployment are sufficient by themselves.

## Source of truth

Public API responses derive from:

- `products`
- `categories`
- `brands`
- `category_brands`

Public API responses must not depend on:

- `orders`
- `dashboard_stats`
- `dashboard_brand_stats`
- `stats_ledger`
- `owners`

## Central visibility rule

A product is public-visible only when all conditions are true:

- `show == true`
- `is_deleted == false`
- `status == "ACTIVE"`

At launch, hidden, deleted, reserved, and sold products all resolve as `404 Not Found` on public detail routes.

## Public-safe field policy

Public API must return only fields required by catalog rendering and SEO.

Do not expose operational or internal-only fields such as:

- `cost_price`
- `is_sellable`
- `last_status_before_sold`
- `sold_at`
- `sold_price`
- `sold_channel`
- `sold_ref`
- internal audit or aggregate data

## Response conventions

All JSON responses should use:

- ISO 8601 strings for timestamps
- `null` for intentionally empty nullable fields when useful to clients
- stable object shapes for list and detail endpoints

Recommended response envelope for paginated list endpoints:

```json
{
  "items": [],
  "next_cursor": null,
  "has_more": false
}
```

Recommended response envelope for non-paginated single-resource endpoints:

```json
{
  "item": {}
}
```

Recommended error shape:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Product not found"
  }
}
```

## Shared serialized resource shapes

### Product card

Used by product listing endpoints.

```json
{
  "id": "product_123",
  "sku": "RBC-123",
  "name": "Canon AE-1 Program",
  "slug": "canon-ae-1-program",
  "category": {
    "id": "film-camera",
    "name": "Film Camera",
    "slug": "film-camera"
  },
  "brand": {
    "id": "canon",
    "name": "Canon",
    "slug": "canon"
  },
  "sell_price": 12900,
  "cover_image": "https://storage.googleapis.com/example/products/product_123/cover.webp",
  "condition": 85,
  "updated_at": "2026-04-07T09:30:00.000Z"
}
```

### Product detail

Used by product detail endpoints.

```json
{
  "id": "product_123",
  "sku": "RBC-123",
  "name": "Canon AE-1 Program",
  "slug": "canon-ae-1-program",
  "category": {
    "id": "film-camera",
    "name": "Film Camera",
    "slug": "film-camera"
  },
  "brand": {
    "id": "canon",
    "name": "Canon",
    "slug": "canon"
  },
  "sell_price": 12900,
  "cover_image": "https://storage.googleapis.com/example/products/product_123/cover.webp",
  "images": [
    "https://storage.googleapis.com/example/products/product_123/cover.webp",
    "https://storage.googleapis.com/example/products/product_123/detail-2.webp"
  ],
  "condition": 85,
  "shutter": 12450,
  "defect_detail": "มีรอยใช้งานเล็กน้อยที่มุมล่าง",
  "free_gift_detail": "สายคล้อง + ถ่าน",
  "seo": {
    "title": "Canon AE-1 Program",
    "description": "Canon AE-1 Program สภาพ 85 ชัตเตอร์ 12450 มีรอยใช้งานเล็กน้อยที่มุมล่าง",
    "image": "https://storage.googleapis.com/example/products/product_123/cover.webp"
  },
  "updated_at": "2026-04-07T09:30:00.000Z"
}
```

### Category summary

```json
{
  "id": "film-camera",
  "name": "Film Camera",
  "slug": "film-camera",
  "image_url": "https://storage.googleapis.com/example/categories/film-camera.webp",
  "order": 10,
  "seo": {
    "title": "Film Camera",
    "description": "รวมสินค้าหมวด Film Camera",
    "image": "https://storage.googleapis.com/example/categories/film-camera.webp"
  },
  "updated_at": "2026-04-07T08:00:00.000Z"
}
```

### Brand summary inside category navigation

This shape is derived from `category_brands` plus global `brands`.

```json
{
  "id": "canon",
  "name": "Canon",
  "slug": "canon",
  "image_url": "https://storage.googleapis.com/example/brands/canon.webp",
  "order": 20,
  "category_id": "film-camera",
  "category_slug": "film-camera",
  "updated_at": "2026-04-07T08:15:00.000Z"
}
```

## Endpoint contract

## `GET /api/products`

Returns a paginated list of public-visible products.

### Query parameters

- `category`
  - optional
  - category slug
- `brand`
  - optional
  - brand slug
- `sort`
  - optional
  - supported values:
    - `updated_at_desc`
    - `sell_price_asc`
    - `sell_price_desc`
- `limit`
  - optional
  - integer
  - recommended default: `24`
  - recommended max: `60`
- `cursor`
  - optional
  - opaque pagination cursor issued by the API
- `minPrice`
  - optional
  - integer
- `maxPrice`
  - optional
  - integer

### Semantics

- Always apply the central product visibility rule.
- If `category` is present, resolve by `categories.slug` and require `is_active == true`.
- If `brand` is present, `category` must also be present.
- If both `category` and `brand` are present, verify active membership through `category_brands`.
- Do not derive category-brand membership directly from `products`.

### Success response example

```json
{
  "items": [
    {
      "id": "product_123",
      "sku": "RBC-123",
      "name": "Canon AE-1 Program",
      "slug": "canon-ae-1-program",
      "category": {
        "id": "film-camera",
        "name": "Film Camera",
        "slug": "film-camera"
      },
      "brand": {
        "id": "canon",
        "name": "Canon",
        "slug": "canon"
      },
      "sell_price": 12900,
      "cover_image": "https://storage.googleapis.com/example/products/product_123/cover.webp",
      "condition": 85,
      "updated_at": "2026-04-07T09:30:00.000Z"
    },
    {
      "id": "product_456",
      "sku": "RBC-456",
      "name": "Canon A-1",
      "slug": "canon-a-1",
      "category": {
        "id": "film-camera",
        "name": "Film Camera",
        "slug": "film-camera"
      },
      "brand": {
        "id": "canon",
        "name": "Canon",
        "slug": "canon"
      },
      "sell_price": 14500,
      "cover_image": "https://storage.googleapis.com/example/products/product_456/cover.webp",
      "condition": 88,
      "updated_at": "2026-04-06T14:00:00.000Z"
    }
  ],
  "next_cursor": "eyJ2IjoxLCJsYXN0IjoiMjAyNi0wNC0wNlQxNDowMDowMC4wMDBaIiwiaWQiOiJwcm9kdWN0XzQ1NiJ9",
  "has_more": true
}
```

### Error cases

- `400 Bad Request`
  - invalid `sort`
  - invalid numeric query parameters
  - `brand` provided without `category`
- `404 Not Found`
  - category slug not found
  - brand slug not found inside the given category

## `GET /api/products/:slug`

Returns one public-visible product detail.

### Semantics

- Resolve by `products.slug`.
- Apply the central product visibility rule after reading the product.
- If no matching public-visible product exists, return `404`.

### Success response example

```json
{
  "item": {
    "id": "product_123",
    "sku": "RBC-123",
    "name": "Canon AE-1 Program",
    "slug": "canon-ae-1-program",
    "category": {
      "id": "film-camera",
      "name": "Film Camera",
      "slug": "film-camera"
    },
    "brand": {
      "id": "canon",
      "name": "Canon",
      "slug": "canon"
    },
    "sell_price": 12900,
    "cover_image": "https://storage.googleapis.com/example/products/product_123/cover.webp",
    "images": [
      "https://storage.googleapis.com/example/products/product_123/cover.webp",
      "https://storage.googleapis.com/example/products/product_123/detail-2.webp"
    ],
    "condition": 85,
    "shutter": 12450,
    "defect_detail": "มีรอยใช้งานเล็กน้อยที่มุมล่าง",
    "free_gift_detail": "สายคล้อง + ถ่าน",
    "seo": {
      "title": "Canon AE-1 Program",
      "description": "Canon AE-1 Program สภาพ 85 ชัตเตอร์ 12450 มีรอยใช้งานเล็กน้อยที่มุมล่าง",
      "image": "https://storage.googleapis.com/example/products/product_123/cover.webp"
    },
    "updated_at": "2026-04-07T09:30:00.000Z"
  }
}
```

### Not found response example

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Product not found"
  }
}
```

### 404 conditions

- slug does not exist
- product is hidden
- product is soft-deleted
- product status is `RESERVED`
- product status is `SOLD`

## `GET /api/categories`

Returns active public categories ordered for navigation.

### Semantics

- Read only `categories where is_active == true`
- Sort by `order asc`

### Success response example

```json
{
  "items": [
    {
      "id": "film-camera",
      "name": "Film Camera",
      "slug": "film-camera",
      "image_url": "https://storage.googleapis.com/example/categories/film-camera.webp",
      "order": 10,
      "seo": {
        "title": "Film Camera",
        "description": "รวมสินค้าหมวด Film Camera",
        "image": "https://storage.googleapis.com/example/categories/film-camera.webp"
      },
      "updated_at": "2026-04-07T08:00:00.000Z"
    },
    {
      "id": "digital-camera",
      "name": "Digital Camera",
      "slug": "digital-camera",
      "image_url": "https://storage.googleapis.com/example/categories/digital-camera.webp",
      "order": 20,
      "seo": {
        "title": "Digital Camera",
        "description": "รวมสินค้าหมวด Digital Camera",
        "image": "https://storage.googleapis.com/example/categories/digital-camera.webp"
      },
      "updated_at": "2026-04-07T08:10:00.000Z"
    }
  ]
}
```

## `GET /api/categories/:categorySlug`

Returns one active category resource for page metadata and route resolution.

### Semantics

- Resolve by `categories.slug`
- Require `is_active == true`
- If not found, return `404`

### Success response example

```json
{
  "item": {
    "id": "film-camera",
    "name": "Film Camera",
    "slug": "film-camera",
    "image_url": "https://storage.googleapis.com/example/categories/film-camera.webp",
    "order": 10,
    "seo": {
      "title": "Film Camera",
      "description": "รวมสินค้าหมวด Film Camera",
      "image": "https://storage.googleapis.com/example/categories/film-camera.webp"
    },
    "updated_at": "2026-04-07T08:00:00.000Z"
  }
}
```

## `GET /api/categories/:categorySlug/brands`

Returns active brand navigation for one active category.

### Semantics

- Resolve category by slug and require active category
- Read `category_brands` by `category_id` and `is_active == true`
- Sort by `category_brands.order asc`
- Join global brand metadata from `brands`
- Exclude inactive or missing global brands from the response

### Success response example

```json
{
  "items": [
    {
      "id": "canon",
      "name": "Canon",
      "slug": "canon",
      "image_url": "https://storage.googleapis.com/example/brands/canon.webp",
      "order": 10,
      "category_id": "film-camera",
      "category_slug": "film-camera",
      "updated_at": "2026-04-07T08:15:00.000Z"
    },
    {
      "id": "nikon",
      "name": "Nikon",
      "slug": "nikon",
      "image_url": "https://storage.googleapis.com/example/brands/nikon.webp",
      "order": 20,
      "category_id": "film-camera",
      "category_slug": "film-camera",
      "updated_at": "2026-04-07T08:20:00.000Z"
    }
  ]
}
```

### 404 conditions

- category slug not found
- category exists but is inactive

## `GET /api/categories/:categorySlug/:brandSlug/products`

Returns a paginated list of public-visible products inside one active category-brand route.

### Query parameters

- `sort`
- `limit`
- `cursor`
- `minPrice`
- `maxPrice`

These have the same meaning and validation rules as `GET /api/products`.

### Semantics

- Resolve category by slug and require active category
- Resolve brand by slug and require active brand
- Verify active mapping exists in `category_brands`
- Query products by:
  - `category_id == category.id`
  - `brand_id == brand.id`
  - public visibility rule

### Success response example

```json
{
  "items": [
    {
      "id": "product_123",
      "sku": "RBC-123",
      "name": "Canon AE-1 Program",
      "slug": "canon-ae-1-program",
      "category": {
        "id": "film-camera",
        "name": "Film Camera",
        "slug": "film-camera"
      },
      "brand": {
        "id": "canon",
        "name": "Canon",
        "slug": "canon"
      },
      "sell_price": 12900,
      "cover_image": "https://storage.googleapis.com/example/products/product_123/cover.webp",
      "condition": 85,
      "updated_at": "2026-04-07T09:30:00.000Z"
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

### 404 conditions

- category slug not found
- brand slug not found
- category-brand mapping missing
- category-brand mapping inactive

## SEO fallback contract

Public API should return resolved SEO values rather than forcing every client to reconstruct them.

### Product fallback

- `seo.title = seo_title ?? name`
- `seo.description = seo_description ?? generated summary from category_name, brand_name, condition, shutter, and defect_detail`
- `seo.image = seo_image ?? cover_image`

### Category fallback

- `seo.title = seo_title ?? name`
- `seo.description = seo_description ?? generated summary from category name`
- `seo.image = seo_image ?? image_url`

### Brand fallback

- `seo.title = seo_title ?? name`
- `seo.description = seo_description ?? generated summary from brand name`
- `seo.image = seo_image ?? image_url`

## Caching contract

Because inventory changes matter, launch caching should prefer freshness over long-lived caches.

Recommended response headers:

- category and brand navigation:
  - `Cache-Control: public, s-maxage=300, stale-while-revalidate=1800`
- product lists:
  - `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`
- product details:
  - `Cache-Control: public, s-maxage=30, stale-while-revalidate=120`
- `404` for product detail:
  - `Cache-Control: public, s-maxage=15, stale-while-revalidate=30`

If the chosen runtime supports surrogate or edge cache tagging, cache invalidation may later be tied to product/category/brand writes.

## Query and index expectations

The API should keep launch filters and sorts intentionally small to control Firestore index growth.

At minimum, expect indexes for patterns equivalent to:

- `products: show, is_deleted, status, updated_at`
- `products: category_id, show, is_deleted, status, updated_at`
- `products: category_id, brand_id, show, is_deleted, status, updated_at`
- `products: show, is_deleted, status, sell_price`
- `products: category_id, show, is_deleted, status, sell_price`
- `products: category_id, brand_id, show, is_deleted, status, sell_price`

If query shapes change, update:

- `docs/public-catalog.spec.md`
- `firestore.indexes.json`
- this Phase 8 contract

## Validation and error policy

### `400 Bad Request`

Use when:

- query params are malformed
- numeric ranges are invalid
- unsupported sort values are requested
- required route/query dependency is missing, such as `brand` without `category`

### `404 Not Found`

Use when:

- category slug does not resolve to an active category
- brand slug does not resolve to an active brand
- category-brand mapping does not exist or is inactive
- product slug does not resolve to a public-visible product

### `500 Internal Server Error`

Use for unexpected backend failures only.

Do not leak Firestore internals or stack traces in production responses.

## Verification checklist for Phase 8

- hidden product detail returns `404`
- deleted product detail returns `404`
- reserved product detail returns `404`
- sold product detail returns `404`
- inactive category returns `404`
- inactive brand is excluded or returns `404` depending on route
- category-brand navigation comes from `category_brands`, not inferred from `products`
- list and detail responses never expose `cost_price` or internal lifecycle fields
- SEO fallback values are present when explicit SEO fields are blank
- pagination cursors are stable for the chosen sort modes

## Non-goals for Phase 8

The Phase 8 public API does not include:

- checkout or cart APIs
- search engine integration
- public order creation
- analytics ingestion
- direct browser access to private Firestore collections
