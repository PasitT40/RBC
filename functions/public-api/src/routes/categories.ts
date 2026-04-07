import { getDb } from "../lib/admin.js";
import type { PaginatedResponse, ProductCard } from "../lib/contracts.js";
import {
  assertActiveCategoryBrandMapping,
  buildProductRouteContext,
  getDocsByIds,
  parseOptionalMoney,
  parsePositiveInt,
  resolveActiveBrandBySlug,
  resolveActiveCategoryBySlug,
} from "../lib/firestore-helpers.js";
import { badRequest, getQueryParam } from "../lib/http.js";
import { applyCursor, decodeCursor, encodeCursor } from "../lib/pagination.js";
import { serializeBrandForCategory, serializeCategory, serializeProductCard } from "../lib/serializers.js";
import type { Request } from "firebase-functions/v2/https";
import { FieldPath } from "firebase-admin/firestore";
import type { SortKey } from "../lib/contracts.js";

function getProductSort(sort: string | null): SortKey {
  const resolved = (sort ?? "updated_at_desc") as SortKey;
  if (resolved === "updated_at_desc" || resolved === "sell_price_asc" || resolved === "sell_price_desc") return resolved;
  throw badRequest("Invalid sort");
}

function buildCategoryBrandProductsQuery(sort: SortKey) {
  const db = getDb();
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

export async function listCategoriesRoute() {
  const db = getDb();
  const snap = await db.collection("categories").where("is_active", "==", true).orderBy("order", "asc").get();
  return {
    items: snap.docs.map((doc) => serializeCategory(doc)),
  };
}

export async function getCategoryBySlugRoute(categorySlug: string) {
  const db = getDb();
  const categoryDoc = await resolveActiveCategoryBySlug(db, categorySlug);
  return {
    item: serializeCategory(categoryDoc),
  };
}

export async function getCategoryBrandsRoute(categorySlug: string) {
  const db = getDb();
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
  req: Request,
  categorySlug: string,
  brandSlug: string
): Promise<PaginatedResponse<ProductCard>> {
  const db = getDb();
  const categoryDoc = await resolveActiveCategoryBySlug(db, categorySlug);
  const brandDoc = await resolveActiveBrandBySlug(db, brandSlug);
  await assertActiveCategoryBrandMapping(db, categoryDoc.id, brandDoc.id);

  const sort = getProductSort(getQueryParam(req, "sort"));
  const limit = parsePositiveInt(getQueryParam(req, "limit"), "limit", 24, 60);
  const minPrice = parseOptionalMoney(getQueryParam(req, "minPrice"), "minPrice");
  const maxPrice = parseOptionalMoney(getQueryParam(req, "maxPrice"), "maxPrice");
  const cursor = decodeCursor(getQueryParam(req, "cursor"));

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) throw badRequest("Invalid price range");

  let query = buildCategoryBrandProductsQuery(sort)
    .where("category_id", "==", categoryDoc.id)
    .where("brand_id", "==", brandDoc.id);

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
  const nextCursor = hasMore && lastDoc
    ? encodeCursor({
        fieldValue: getCursorValueForSort(sort, lastDoc.data() ?? {}),
        fieldKind: sort === "updated_at_desc" ? "timestamp" : "number",
        id: lastDoc.id,
      })
    : null;

  return {
    items,
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}
