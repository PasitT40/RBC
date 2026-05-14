import { FieldPath } from "firebase-admin/firestore";
import type { Request } from "firebase-functions/v2/https";
import type { PaginatedResponse, ProductCard, SortKey } from "../lib/contracts.js";
import type { Firestore } from "firebase-admin/firestore";
import { buildProductRouteContext, parseOptionalCondition, parseOptionalMoney, parsePositiveInt, resolveActiveBrandBySlug, resolveActiveCategoryBySlug, resolveStatusFilter } from "../lib/firestore-helpers.js";
import { badRequest, getQueryParam, notFound } from "../lib/http.js";
import { applyCursor, decodeCursor, encodeCursor } from "../lib/pagination.js";
import { isPublicVisibleProduct } from "../lib/public-visibility.js";
import { serializeProductCard, serializeProductDetail } from "../lib/serializers.js";

function getProductSort(sort: string | null, hasPriceRange: boolean, hasConditionFilter: boolean): SortKey {
  let defaultSort: SortKey;
  if (hasConditionFilter) defaultSort = "condition_asc";
  else if (hasPriceRange) defaultSort = "sell_price_asc";
  else defaultSort = "updated_at_desc";

  const resolved = (sort ?? defaultSort) as SortKey;
  const validSorts = new Set<string>(["updated_at_desc", "sell_price_asc", "sell_price_desc", "condition_asc", "condition_desc"]);
  if (!validSorts.has(resolved)) throw badRequest("Invalid sort");

  if (hasConditionFilter && resolved !== "condition_asc" && resolved !== "condition_desc") {
    throw badRequest("Condition filter requires condition_asc or condition_desc sort");
  }
  if (hasPriceRange && (resolved === "condition_asc" || resolved === "condition_desc")) {
    throw badRequest("Price range requires price sort");
  }

  return resolved;
}

function buildSortedProductsQuery(db: Firestore, sort: SortKey, statusFilter: string[]) {
  let query = db
    .collection("products")
    .where("show", "==", true)
    .where("is_deleted", "==", false)
    .where("status", "in", statusFilter);

  if (sort === "updated_at_desc") {
    query = query.orderBy("updated_at", "desc").orderBy(FieldPath.documentId(), "desc");
  } else if (sort === "sell_price_asc") {
    query = query.orderBy("sell_price", "asc").orderBy(FieldPath.documentId(), "asc");
  } else if (sort === "sell_price_desc") {
    query = query.orderBy("sell_price", "desc").orderBy(FieldPath.documentId(), "desc");
  } else if (sort === "condition_asc") {
    query = query.orderBy("condition", "asc").orderBy(FieldPath.documentId(), "asc");
  } else {
    query = query.orderBy("condition", "desc").orderBy(FieldPath.documentId(), "desc");
  }

  return query;
}

function getCursorValueForSort(sort: SortKey, product: Record<string, unknown>) {
  if (sort === "updated_at_desc") {
    const updatedAt = product.updated_at as { toDate?: () => Date } | undefined;
    return updatedAt?.toDate ? updatedAt.toDate().getTime() : null;
  }
  if (sort === "condition_asc" || sort === "condition_desc") {
    return typeof product.condition === "number" ? product.condition : null;
  }
  return typeof product.sell_price === "number" ? product.sell_price : null;
}

function getExpectedCursorKind(sort: SortKey): "timestamp" | "number" {
  return sort === "updated_at_desc" ? "timestamp" : "number";
}

export async function listProductsRoute(db: Firestore, req: Request): Promise<PaginatedResponse<ProductCard>> {
  const categorySlug = getQueryParam(req, "category");
  const brandSlug = getQueryParam(req, "brand");
  const availability = getQueryParam(req, "availability");
  const limit = parsePositiveInt(getQueryParam(req, "limit"), "limit", 24, 60);
  const minPrice = parseOptionalMoney(getQueryParam(req, "minPrice"), "minPrice");
  const maxPrice = parseOptionalMoney(getQueryParam(req, "maxPrice"), "maxPrice");
  const minCondition = parseOptionalCondition(getQueryParam(req, "minCondition"), "minCondition");
  const maxCondition = parseOptionalCondition(getQueryParam(req, "maxCondition"), "maxCondition");
  const hasPriceRange = minPrice !== null || maxPrice !== null;
  const hasConditionFilter = minCondition !== null || maxCondition !== null;
  const sort = getProductSort(getQueryParam(req, "sort"), hasPriceRange, hasConditionFilter);
  const cursor = decodeCursor(getQueryParam(req, "cursor", 512));
  const expectedCursorKind = getExpectedCursorKind(sort);

  if (availability !== null && availability !== "available" && availability !== "sold" && availability !== "reserved") {
    throw badRequest("Invalid availability");
  }
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) throw badRequest("Invalid price range");
  if (hasConditionFilter && hasPriceRange) throw badRequest("Cannot use condition filter with price range");
  if (cursor?.sort && cursor.sort !== sort) throw badRequest("Cursor does not match sort");
  if (cursor && cursor.fieldKind !== expectedCursorKind) throw badRequest("Cursor does not match sort");

  const statusFilter = resolveStatusFilter(availability);

  let categoryId: string | null = null;
  let brandId: string | null = null;

  if (categorySlug) {
    const categoryDoc = await resolveActiveCategoryBySlug(db, categorySlug);
    categoryId = categoryDoc.id;
  }

  if (brandSlug) {
    const brandDoc = await resolveActiveBrandBySlug(db, brandSlug);
    brandId = brandDoc.id;
    if (categorySlug && categoryId) {
      const mappingSnap = await db.collection("category_brands").doc(`${categoryId}__${brandId}`).get();
      if (!mappingSnap.exists || mappingSnap.get("is_active") !== true) {
        throw notFound("Brand not found");
      }
    }
  }

  let query = buildSortedProductsQuery(db, sort, statusFilter);

  if (categoryId) query = query.where("category_id", "==", categoryId);
  if (brandId) query = query.where("brand_id", "==", brandId);
  if (minPrice !== null) query = query.where("sell_price", ">=", minPrice);
  if (maxPrice !== null) query = query.where("sell_price", "<=", maxPrice);
  if (minCondition !== null) query = query.where("condition", ">=", minCondition);
  if (maxCondition !== null) query = query.where("condition", "<=", maxCondition);

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

export async function searchProductsRoute(db: Firestore, req: Request): Promise<{ items: ProductCard[] }> {
  const q = getQueryParam(req, "q", 100)?.trim() ?? "";
  if (!q) throw badRequest("q is required");
  if (q.length < 1) throw badRequest("q must be at least 1 character");

  const limit = parsePositiveInt(getQueryParam(req, "limit"), "limit", 10, 20);
  const qEnd = q + "";

  const snap = await db
    .collection("products")
    .where("show", "==", true)
    .where("is_deleted", "==", false)
    .where("status", "==", "ACTIVE")
    .orderBy("name")
    .startAt(q)
    .endAt(qEnd)
    .limit(limit)
    .get();

  const context = await buildProductRouteContext(db, snap.docs);
  return {
    items: snap.docs.map((doc) => serializeProductCard(doc, context)),
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
