# Manual QA Checklist

Project: Camera Marketplace Backoffice Phase 1

Use this checklist before deployment or after changing Firestore write flows.

## Environment prep
- Use a non-production Firebase project with realistic seed data.
- Confirm `firestore.indexes.json` has been deployed.
- Open browser console and verify there are no Firestore missing-index errors before starting.

## Categories and brands
- In this checklist, `subcategory` means the backoffice UI label for a global brand plus its category mapping, not a separate Firestore collection.
- Create a category with image and SEO fields.
- Edit the same category without uploading a new image.
- Edit the same category with a replacement image.
- Toggle category active off, refresh, and confirm the row still appears in backoffice.
- Create a subcategory/brand mapped to a category.
- Edit the same subcategory and change its category mapping.
- Edit the same subcategory with a replacement image.
- Toggle subcategory active off, refresh, and confirm the row still appears in backoffice.
- Delete a subcategory and confirm the `brands/{brandId}` doc and related `category_brands/{categoryId__brandId}` docs are removed.

## Product create and edit
- Create a product with valid category, mapped brand, and at least one image.
- Confirm product document contains `ACTIVE`, `show=true`, `is_sellable=true`, and ordered `images[]`.
- Edit product name and verify slug updates as expected.
- Edit product category and brand to another valid mapped pair.
- Edit product images by removing one existing image and adding one new image.
- Confirm removed image URLs are no longer referenced by the product document.
- Attempt to save a visible product with a broken category-brand mapping and confirm the save is blocked.

## Product lifecycle
- Toggle `show` off and on again for an active product.
- Set an active product to reserved.
- Set the reserved product back to active.
- Soft-delete an active product and confirm:
  - `is_deleted=true`
  - `show=false`
  - `is_sellable=false`
  - product no longer appears in the default product list

## Sale and undo sale
- Confirm sale for an active product and verify:
  - product `status=SOLD`
  - `sold_ref`, `sold_at`, `sold_price`, `sold_channel` are populated
  - order document is created with `status=CONFIRMED`
  - `stats_ledger/SALE_APPLIED_{orderId}` exists
- Undo sale for the same order and verify:
  - order `status=CANCELLED`
  - product status restores to previous status
  - `stats_ledger/SALE_REVERTED_{orderId}` exists
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

## Image cleanup checks
- During category/subcategory/product image replacement, verify old image URLs are no longer referenced after success.
- Simulate a failed save after upload if possible and verify newly uploaded files are not left orphaned.

## Sign-off
- No console errors during CRUD and lifecycle flows.
- No missing-index errors in Firestore queries.
- Dashboard counters match document reality after each tested mutation.
