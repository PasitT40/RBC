# Manual QA Checklist

Project: Camera Marketplace Backoffice Phase 4

Use this checklist before deployment or after changing Firestore write flows.

## Environment prep
- Use a non-production Firebase project with realistic seed data.
- Confirm `firestore.indexes.json` has been deployed.
- Open browser console and verify there are no Firestore missing-index errors before starting.

## Categories and brands
- In this checklist, `subcategory` means the backoffice UI label for a global brand plus its category mapping, not a separate Firestore collection.
- Confirm new brand management actions only write to `brands/{brandId}` and `category_brands/{categoryId__brandId}`.
- Create a category with image and SEO fields.
- Set or edit category display order and confirm the list order updates accordingly.
- Edit the same category without uploading a new image.
- Edit the same category with a replacement image.
- Toggle category active off, refresh, and confirm the row still appears in backoffice.
- Create a brand mapped to a category and confirm writes only touch `brands/{brandId}` plus `category_brands/{categoryId__brandId}`.
- Edit the same brand and change its category mapping.
- Edit the same brand global order and category mapping order, then confirm:
  - backoffice brand list reflects the global `brands.order`
  - product brand dropdown for that category reflects `category_brands.order`
- Edit the same brand with a replacement image.
- Toggle brand active off, refresh, and confirm the row still appears in backoffice.
- Delete a brand and confirm the `brands/{brandId}` doc and related `category_brands/{categoryId__brandId}` docs are removed.

## Product create and edit
- Create a product with valid category, mapped brand, and at least one image.
- Confirm product document contains `sku` in `RBC-001` style, integer `sku_seq`, `ACTIVE`, `show=true`, `is_sellable=true`, and ordered `images[]`.
- Confirm the first image in the ordered list is persisted as `cover_image`.
- Create a hidden draft product with `show=false` and no image, then confirm the save succeeds and the product stays hidden.
- Edit product name and verify slug updates as expected.
- Edit product name with special characters or extra spaces and confirm the stored slug is normalized deterministically.
- Edit the same product and confirm `sku` does not change after save.
- Edit product category and brand to another valid mapped pair.
- Edit product images by removing one existing image and adding one new image.
- Reorder product images on edit and confirm the new first image becomes `cover_image`.
- Confirm removed image URLs are no longer referenced by the product document.
- Attempt to save a visible product with a broken category-brand mapping and confirm the save is blocked.
- Attempt to create or edit a visible product without any usable image and confirm the save is blocked.
- Attempt to create a second product that would normalize to the same slug and confirm the save is blocked before publish.
- Leave SEO title / description / image blank for product, category, and brand, then confirm the UI communicates the documented fallback behavior instead of requiring manual Firestore edits.

## Site settings
- Open the site settings page and confirm existing `settings/site` values load.
- Replace a banner image, change its order, and save.
- Toggle a banner active flag and save.
- Replace a credit image, change its order, and save.
- Remove a banner or credit item and confirm removed image URLs are cleaned up after save.

## Product lifecycle
- Toggle `show` off and on again for an active product.
- Try toggling a hidden incomplete draft to `show=true` and confirm the publish is blocked.
- Set an active product to reserved.
- Try setting the same reserved product to reserved again and confirm the write is rejected.
- Set the reserved product back to active.
- Try setting the same active product to active again and confirm the write is rejected.
- Confirm no mutation persists `DELETED` into `products.status`; deleted state must come from `is_deleted=true` only.
- Soft-delete an active product and confirm:
  - `is_deleted=true`
  - `show=false`
  - `is_sellable=false`
  - product no longer appears in the default product list
- Confirm a soft-deleted product cannot be made visible again by any normal backoffice action.

## Sale and undo sale
- Confirm sale for an active product and verify:
  - product `status=SOLD`
  - `sold_ref`, `sold_at`, `sold_price`, `sold_channel` are populated
  - order document is created with `status=CONFIRMED`
  - `stats_ledger/SALE_APPLIED_{orderId}` exists
  - sale ledger contains `entity_type=order`, `entity_id={orderId}`, and `operation_key=SALE_APPLIED_{orderId}`
- Undo sale for the same order and verify:
  - order `status=CANCELLED`
  - product status restores to previous status
  - `stats_ledger/SALE_REVERTED_{orderId}` exists
  - revert ledger contains `entity_type=order`, `entity_id={orderId}`, and `operation_key=SALE_REVERTED_{orderId}`
- Re-run confirm or undo using the same idempotency key/order id and confirm counters do not double-apply.

## Dashboard counters
- Capture `dashboard_stats/global` before each mutation.
- After create product:
  - `total_products` increments
  - correct status counter increments
  - `visible_products` increments when `show=true`
- After toggle show:
  - `visible_products` changes by exactly 1
- After reserve/active transitions:
  - `active_products` and `reserved_products` move in opposite directions
- After delete:
  - `total_products` decrements
  - `visible_products` decrements if the product was visible
- After confirm sale:
  - `sold_products` increments
  - `active_products` or `reserved_products` decrements based on previous status
  - sales/cost/profit totals increment
- After undo sale:
  - previous counter changes revert exactly once

## SKU checks
- Create two products in a row and confirm the second SKU increments from the first without duplication.
- Confirm SKU format stays `RBC-###` and remains visible in product list and product edit surfaces.
- If a product save fails after validation, confirm the next successful create still gets a unique SKU.

## Recovery drill
- Run `node scripts/verify-phase1.cjs` after any manual repair, seed refresh, or aggregate rebuild.
- If the verifier reports dashboard counter mismatches, run:
  - `node scripts/rebuild-dashboard-aggregates.cjs --dry-run`
  - `node scripts/rebuild-dashboard-aggregates.cjs`
- If the verifier reports `stats_ledger` shape errors, run:
  - `node scripts/repair-stats-ledger.cjs --dry-run`
  - `node scripts/repair-stats-ledger.cjs`
- Re-run `node scripts/verify-phase1.cjs` and confirm the result is clean before sign-off.

## Image cleanup checks
- During category/subcategory/product image replacement, verify old image URLs are no longer referenced after success.
- Simulate a failed save after upload if possible and verify newly uploaded files are not left orphaned.

## Sign-off
- No console errors during CRUD and lifecycle flows.
- No missing-index errors in Firestore queries.
- Dashboard counters match document reality after each tested mutation.
