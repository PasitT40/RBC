import { FieldPath } from "firebase-admin/firestore";
import type { DocumentData, DocumentSnapshot, Firestore, Query } from "firebase-admin/firestore";
import { badRequest, notFound } from "./http.js";
import type { ProductRouteContext } from "./contracts.js";

export async function resolveActiveCategoryBySlug(db: Firestore, slug: string) {
  const snap = await db.collection("categories").where("slug", "==", slug).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) throw notFound("Category not found");
  if (doc.get("is_active") !== true) throw notFound("Category not found");
  return doc;
}

export async function resolveActiveBrandBySlug(db: Firestore, slug: string) {
  const snap = await db.collection("brands").where("slug", "==", slug).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) throw notFound("Brand not found");
  if (doc.get("is_active") !== true) throw notFound("Brand not found");
  return doc;
}

export async function assertActiveCategoryBrandMapping(db: Firestore, categoryId: string, brandId: string) {
  const mappingRef = db.collection("category_brands").doc(`${categoryId}__${brandId}`);
  const mappingSnap = await mappingRef.get();
  if (!mappingSnap.exists || mappingSnap.get("is_active") !== true) {
    throw notFound("Category-brand mapping not found");
  }
  return mappingSnap;
}

export async function getDocsByIds(
  queryBase: Query,
  ids: string[]
): Promise<DocumentSnapshot<DocumentData>[]> {
  if (ids.length === 0) return [];
  const uniqueIds = [...new Set(ids)];
  const groups: string[][] = [];

  for (let index = 0; index < uniqueIds.length; index += 10) {
    groups.push(uniqueIds.slice(index, index + 10));
  }

  const snapshots = await Promise.all(groups.map((group) => queryBase.where(FieldPath.documentId(), "in", group).get()));
  return snapshots.flatMap((snap) => snap.docs);
}

export function parsePositiveInt(value: string | null, label: string, fallback: number, max: number) {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw badRequest(`Invalid ${label}`);
  return Math.min(parsed, max);
}

export function parseOptionalMoney(value: string | null, label: string) {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw badRequest(`Invalid ${label}`);
  return parsed;
}

export async function buildProductRouteContext(
  db: Firestore,
  products: Array<DocumentSnapshot<DocumentData>>
): Promise<ProductRouteContext> {
  const categoryIds = products
    .map((doc) => doc.get("category_id"))
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const brandIds = products
    .map((doc) => doc.get("brand_id"))
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  const [categoryDocs, brandDocs] = await Promise.all([
    getDocsByIds(db.collection("categories"), categoryIds),
    getDocsByIds(db.collection("brands"), brandIds),
  ]);

  return {
    categorySlugById: new Map(
      categoryDocs.map((doc) => [doc.id, String(doc.get("slug") ?? "")])
    ),
    brandSlugById: new Map(
      brandDocs.map((doc) => [doc.id, String(doc.get("slug") ?? "")])
    ),
  };
}
