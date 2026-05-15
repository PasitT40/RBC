import type { Firestore } from "firebase-admin/firestore";
import type { PaginatedResponse, ProductCard } from "../lib/contracts.js";
import {
  assertActiveCategoryBrandMapping,
  buildProductRouteContext,
  getDocsByIds,
  parseOptionalCondition,
  parseOptionalMoney,
  parsePositiveInt,
  resolveActiveBrandBySlug,
  resolveActiveCategoryBySlug,
  resolveStatusFilter,
} from "../lib/firestore-helpers.js";
import { badRequest, getQueryParam } from "../lib/http.js";
import { applyCursor, decodeCursor, encodeCursor } from "../lib/pagination.js";
import { serializeBrandForCategory, serializeCategory, serializeProductCard } from "../lib/serializers.js";
import type { Request } from "firebase-functions/v2/https";
import { FieldPath } from "firebase-admin/firestore";
import type { SortKey } from "../lib/contracts.js";

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
  if (hasPriceRange && resolved !== "sell_price_asc" && resolved !== "sell_price_desc") {
    throw badRequest("Price range requires sell_price_asc or sell_price_desc sort");
  }

  return resolved;
}

function buildCategoryBrandProductsQuery(db: Firestore, sort: SortKey, statusFilter: string[]) {
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

export async function listCategoriesRoute(db: Firestore) {
  const snap = await db.collection("categories").where("is_active", "==", true).orderBy("order", "asc").get();
  return {
    items: snap.docs.map((doc) => serializeCategory(doc)),
  };
}

export async function getCategoryBySlugRoute(db: Firestore, categorySlug: string) {
  const categoryDoc = await resolveActiveCategoryBySlug(db, categorySlug);
  return {
    item: serializeCategory(categoryDoc),
  };
}

export async function getCategoryBrandsRoute(db: Firestore, categorySlug: string) {
  const categoryDoc = await resolveActiveCategoryBySlug(db, categorySlug);
  const mappingsSnap = await db
    .collection("category_brands")
    .where("category_id", "==", categoryDoc.id)
    .where("is_active", "==", true)
    .orderBy("order", "asc")
    .get();

  const brandIds = mappingsSnap.docs.map((doc) => doc.get("brand_id")).filter((value): value is string => typeof value === "string" && value.length > 0);
  const brandDocs = await getDocsByIds(db.collection("brands"), brandIds);
  const brandDocMap = new Map(brandDocs.filter((doc) => doc.get("is_active") === true).map((doc) => [doc.id, doc]));

  const items = mappingsSnap.docs
    .map((mappingDoc) => {
      const brandId = String(mappingDoc.get("brand_id") ?? "");
      const brandDoc = brandDocMap.get(brandId);
      if (!brandDoc) return null;
      return serializeBrandForCategory(brandDoc, mappingDoc, categorySlug);
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return { items };
}

export async function getCategoryBrandProductsRoute(
  db: Firestore,
  req: Request,
  categorySlug: string,
  brandSlug: string
): Promise<PaginatedResponse<ProductCard>> {
  const categoryDoc = await resolveActiveCategoryBySlug(db, categorySlug);
  const brandDoc = await resolveActiveBrandBySlug(db, brandSlug);
  await assertActiveCategoryBrandMapping(db, categoryDoc.id, brandDoc.id);

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
  if (cursor && cursor.fieldKind !== expectedCursorKind && cursor.fieldKind !== "null") throw badRequest("Cursor does not match sort");

  const statusFilter = resolveStatusFilter(availability);

  let query = buildCategoryBrandProductsQuery(db, sort, statusFilter)
    .where("category_id", "==", categoryDoc.id)
    .where("brand_id", "==", brandDoc.id);

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
  const nextCursor = hasMore && lastDoc
    ? encodeCursor({ fieldValue: cursorFieldValue, fieldKind: cursorFieldValue === null ? "null" : expectedCursorKind, id: lastDoc.id, sort })
    : null;

  return {
    items,
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}
