# AGENTS.md

## Firestore rules (must follow)
- Brands are GLOBAL collection: `brands/{brandId}`
- DO NOT create brand subcollections under categories
- Category -> Brand dropdown uses `category_brands` mapping only
- Persisted product status uses: ACTIVE | RESERVED | SOLD
- DELETED is a soft-delete display state derived from `is_deleted=true`
- show=false means hidden from frontend
- SELL and UNDO SALE must use Firestore Transactions
- Use stats_ledger for idempotency
- Dashboard docs are cached aggregates, update on writes

## Required flows
- createProduct (batch)
- toggleShow (batch)
- setReserved / setActive (batch)
- confirmSale (transaction)
- undoSale (transaction)
