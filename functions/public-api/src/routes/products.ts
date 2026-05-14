import { FieldPath } from "firebase-admin/firestore";
import type { Request } from "firebase-functions/v2/https";
import type { PaginatedResponse, ProductCard, SortKey } from "../lib/contracts.js";
import type { Firestore } from "firebase-admin/firestore";
import { buildProductRouteContext, parseOptionalMoney, parsePositiveInt, resolveActiveBrandBySlug, resolveActiveCategoryBySlug } from "../lib/firestore-helpers.js";
import { badRequest, getQueryParam, notFound } from "../lib/http.js";
import { applyCursor, decodeCursor, encodeCursor } from "../lib/pagination.js";
import { isPublicVisibleProduct } from "../lib/public-visibility.js";
import { serializeProductCard, serializeProductDetail } from "../lib/serializers.js";

function getProductSort(sort: string | null, hasPriceRange: boolean): SortKey {
  const resolved = (sort ?? (hasPriceRange ? "sell_price_asc" : "updated_at_desc")) as SortKey;
  if (resolved === "updated_at_desc" || resolved === "sell_price_asc" || resolved === "sell_price_desc") return resolved;
  throw badRequest("Invalid sort");
}

function buildSortedProductsQuery(db: Firestore, sort: SortKey) {
  let query = db
    .collection("products")
    .where("show", "==", true)
    .where("is_deleted", "==", false)
    .where("status", "==", "ACTIVE");

  if (sort === "updated_at_desc") {
    query = query.orderBy("updated_at", "desc").orderBy(FieldPath.documentId(), "desc");
  } else if (sort === "sell_price_asc") {
    query = query.orderBy("sell_price", "asc").orderBy(FieldPath.documentId(), "asc");
  } else {
    query = query.orderBy("sell_price", "desc").orderBy(FieldPath.documentId(), "desc");
  }

  return query;
}

function getCursorValueForSort(sort: SortKey, product: Record<string, unknown>) {
  if (sort === "updated_at_desc") {
    const updatedAt = product.updated_at as { toDate?: () => Date } | undefined;
    return updatedAt?.toDate ? updatedAt.toDate().getTime() : null;
  }

  return typeof product.sell_price === "number" ? product.sell_price : null;
}

export async function listProductsRoute(db: Firestore, req: Request): Promise<PaginatedResponse<ProductCard>> {
  const categorySlug = getQueryParam(req, "category");
  const brandSlug = getQueryParam(req, "brand");
  const limit = parsePositiveInt(getQueryParam(req, "limit"), "limit", 24, 60);
  const minPrice = parseOptionalMoney(getQueryParam(req, "minPrice"), "minPrice");
  const maxPrice = parseOptionalMoney(getQueryParam(req, "maxPrice"), "maxPrice");
  const hasPriceRange = minPrice !== null || maxPrice !== null;
  const sort = getProductSort(getQueryParam(req, "sort"), hasPriceRange);
  const cursor = decodeCursor(getQueryParam(req, "cursor", 512));
  const expectedCursorKind = sort === "updated_at_desc" ? "timestamp" : "number";

  if (brandSlug && !categorySlug) throw badRequest("Brand filter requires category");
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) throw badRequest("Invalid price range");
  if (hasPriceRange && sort === "updated_at_desc") throw badRequest("Price range requires price sort");
  if (cursor?.sort && cursor.sort !== sort) throw badRequest("Cursor does not match sort");
  if (cursor && cursor.fieldKind !== expectedCursorKind) throw badRequest("Cursor does not match sort");

  let categoryId: string | null = null;
  let brandId: string | null = null;

  if (categorySlug) {
    const categoryDoc = await resolveActiveCategoryBySlug(db, categorySlug);
    categoryId = categoryDoc.id;
  }

  if (brandSlug) {
    const brandDoc = await resolveActiveBrandBySlug(db, brandSlug);
    brandId = brandDoc.id;
    const mappingSnap = await db.collection("category_brands").doc(`${categoryId}__${brandId}`).get();
    if (!mappingSnap.exists || mappingSnap.get("is_active") !== true) {
      throw notFound("Brand not found");
    }
  }

  let query = buildSortedProductsQuery(db, sort);

  if (categoryId) query = query.where("category_id", "==", categoryId);
  if (brandId) query = query.where("brand_id", "==", brandId);
  if (minPrice !== null) query = query.where("sell_price", ">=", minPrice);
  if (maxPrice !== null) query = query.where("sell_price", "<=", maxPrice);

  query = applyCursor(query, cursor);
  query = query.limit(limit + 1);

  const snap = await query.get();
  const docs = snap.docs.slice(0, limit);
  const context = await buildProductRouteContext(db, docs);
  const items = docs.map((doc) => serializeProductCard(doc, context));
  const hasMore = snap.docs.length > limit;
  const lastDoc = docs.at(-1);
  const cursorFieldValue = hasMore && lastDoc ? getCursorValueForSort(sort, lastDoc.data() ?? {}) : null;
  const nextCursor = hasMore && lastDoc && cursorFieldValue !== null
    ? encodeCursor({ fieldValue: cursorFieldValue, fieldKind: expectedCursorKind, id: lastDoc.id, sort })
    : null;

  return {
    items,
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}

export async function getProductBySlugRoute(db: Firestore, slug: string) {
  const snap = await db.collection("products").where("slug", "==", slug).limit(1).get();
  const doc = snap.docs[0];

  if (!doc) throw notFound("Product not found");
  if (!isPublicVisibleProduct(doc.data() ?? {})) throw notFound("Product not found");
  const context = await buildProductRouteContext(db, [doc]);

  return {
    item: serializeProductDetail(doc, context),
  };
}
