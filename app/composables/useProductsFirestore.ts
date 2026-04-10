import { collection, doc, getDoc, getDocs, increment, limit, orderBy, query, serverTimestamp, startAfter, where, writeBatch, type QueryConstraint } from "firebase/firestore";
import type { PageCursor, PageResult, ProductInput, ProductRecord, ProductsPageInput, ProductStatus } from "./firestore/types";
import { IMAGE_UPLOAD_PROFILES, deleteStorageUrls, uploadImageAsWebP } from "./firestore/media";
import {
  assertActivatableProduct,
  assertDeletableProduct,
  assertReservableProduct,
  getProductStatus,
  isSoftDeletedProduct,
} from "./firestore/products";
import { normalizeProductCondition } from "./firestore/condition";
import { assertPublicReadyProduct, normalizeProductSlug, sanitizeProductImageUrls } from "./firestore/publication";
import { allocateNextProductSku } from "./firestore/sku";
import { globalRef } from "./firestore/utils";

export function useProductsFirestore() {
  const { $db, $storage } = useNuxtApp() as { $db: any; $storage: any };
  const { track } = useGlobalLoading();

  const uploadImage = async (rawFile: File, folderPath: string): Promise<string | null> =>
    uploadImageAsWebP($storage, rawFile, folderPath, IMAGE_UPLOAD_PROFILES.productGallery);

  const uploadImages = async (files: File[] | undefined, folderPath: string) => {
    if (!files?.length) return [] as string[];
    const uploadedUrls = await Promise.all(files.map((file) => uploadImage(file, folderPath)));
    return uploadedUrls.filter((url): url is string => Boolean(url));
  };

  const cleanupUploadedUrls = async (urls: string[]) => {
    if (!urls.length) return;
    await deleteStorageUrls($storage, urls);
  };

  const assertExpectedUploads = (selectedFiles: File[] | undefined, uploadedUrls: string[], label: string) => {
    const expectedCount = Array.isArray(selectedFiles) ? selectedFiles.length : 0;
    if (!expectedCount) return;
    if (uploadedUrls.length === expectedCount) return;

    throw new Error(`${label}อัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง`);
  };

  const commitWithUploadRollback = async (commit: () => Promise<void>, uploadedUrls: string[]) => {
    try {
      await commit();
    } catch (error) {
      await cleanupUploadedUrls(uploadedUrls);
      throw error;
    }
  };

  const assertUniqueProductSlug = async (slug: string, excludeId?: string) => {
    const trimmedSlug = slug.trim();
    if (!trimmedSlug) throw new Error("Product slug is required");

    const snap = await getDocs(query(collection($db, "products"), where("slug", "==", trimmedSlug)));
    const hasDuplicate = snap.docs.some((docSnap) => {
      if (docSnap.id === excludeId) return false;
      const product = { id: docSnap.id, ...docSnap.data() } as ProductRecord;
      return !isSoftDeletedProduct(product);
    });
    if (hasDuplicate) throw new Error("Product slug already exists");
  };

  const assertCategoryBrandMappingExists = async (categoryId: string, brandId: string) => {
    if (!categoryId?.trim() || !brandId?.trim()) {
      throw new Error("Product category-brand mapping is required");
    }

    const mappingRef = doc($db, "category_brands", `${categoryId}__${brandId}`);
    const mappingSnap = await getDoc(mappingRef);
    if (!mappingSnap.exists()) {
      throw new Error("Product category-brand mapping not found");
    }

    const mapping = mappingSnap.data() as Record<string, any>;
    if (mapping.is_active === false) {
      throw new Error("Product category-brand mapping is inactive");
    }
  };

  const getProductsPage = async (input: ProductsPageInput = {}): Promise<PageResult<ProductRecord>> => {
    const pageSize = input.pageSize ?? 20;
    const constraints: QueryConstraint[] = [];

    if (input.categoryId) constraints.push(where("category_id", "==", input.categoryId));
    if (input.brandId) constraints.push(where("brand_id", "==", input.brandId));
    if (input.status) constraints.push(where("status", "==", input.status));
    if (typeof input.show === "boolean") constraints.push(where("show", "==", input.show));

    constraints.push(orderBy("created_at", "desc"));
    constraints.push(limit(pageSize));
    if (input.cursor) constraints.push(startAfter(input.cursor));

    const q = query(collection($db, "products"), ...constraints);
    const snap = await getDocs(q);
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as ProductRecord))
      .filter((item) => input.includeDeleted ? true : !isSoftDeletedProduct(item));
    const nextCursor: PageCursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    return {
      items,
      nextCursor,
      hasMore: snap.docs.length === pageSize,
    };
  };

  const getProducts = async (count = 50, options: { includeDeleted?: boolean } = {}) => {
    const page = await getProductsPage({ pageSize: count, includeDeleted: options.includeDeleted });
    return page.items;
  };

  const getProductById = async (productId: string): Promise<ProductRecord | null> => {
    const pRef = doc($db, "products", productId);
    const snap = await getDoc(pRef);
    if (!snap.exists()) return null;

    const product = { id: snap.id, ...snap.data() } as ProductRecord;
    return isSoftDeletedProduct(product) ? null : product;
  };

  const createProduct = async (payload: ProductInput) => {
    const batch = writeBatch($db);
    const pRef = payload.id ? doc($db, "products", payload.id) : doc(collection($db, "products"));

    const status: ProductStatus = payload.status ?? "ACTIVE";
    const show = payload.show ?? true;
    const slug = normalizeProductSlug(payload.slug || payload.name);
    const folderPath = `products/${pRef.id}`;
    await assertUniqueProductSlug(slug, payload.id);
    if (show) {
      await assertCategoryBrandMappingExists(payload.category_id, payload.brand_id);
    }

    const uploadedCoverImage = payload.cover_file ? await uploadImage(payload.cover_file, folderPath) : null;
    const uploadedImages = await uploadImages(payload.image_files, folderPath);
    if (payload.cover_file && !uploadedCoverImage) {
      throw new Error("รูปปกอัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
    assertExpectedUploads(payload.image_files, uploadedImages, "รูปสินค้า");
    const uploadedUrls = [uploadedCoverImage, ...uploadedImages].filter((url): url is string => Boolean(url));
    const images = sanitizeProductImageUrls([...(payload.images ?? []), ...uploadedImages]);
    const coverImage = String(uploadedImages[0] ?? payload.cover_image ?? uploadedCoverImage ?? images[0] ?? "").trim();
    const { sku, sku_seq } = await allocateNextProductSku($db);
    assertPublicReadyProduct({
      ...payload,
      slug,
      status,
      show,
      images,
      cover_image: coverImage,
    });

    batch.set(pRef, {
      sku,
      sku_seq,
      name: payload.name,
      slug,
      category_id: payload.category_id,
      category_name: payload.category_name,
      brand_id: payload.brand_id,
      brand_name: payload.brand_name,
      seo_title: payload.seo_title ?? "",
      seo_description: payload.seo_description ?? "",
      seo_image: payload.seo_image ?? "",
      cost_price: payload.cost_price,
      sell_price: payload.sell_price,
      condition: normalizeProductCondition(payload.condition),
      shutter: payload.shutter ?? null,
      defect_detail: payload.defect_detail ?? "",
      free_gift_detail: payload.free_gift_detail ?? "",
      cover_image: coverImage,
      images,
      status,
      show,
      is_sellable: status === "ACTIVE",
      last_status_before_sold: null,
      sold_at: null,
      sold_price: null,
      sold_channel: null,
      sold_ref: null,
      is_deleted: false,
      deleted_at: null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    batch.set(
      globalRef($db),
      {
        total_products: increment(1),
        active_products: increment(status === "ACTIVE" ? 1 : 0),
        reserved_products: increment(status === "RESERVED" ? 1 : 0),
        sold_products: increment(status === "SOLD" ? 1 : 0),
        visible_products: increment(show ? 1 : 0),
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );

    await commitWithUploadRollback(() => batch.commit(), uploadedUrls);
    return { id: pRef.id, sku };
  };

  const updateProduct = async (payload: ProductInput) => {
    if (!payload.id) throw new Error("Product id is required");
    const slug = normalizeProductSlug(payload.slug || payload.name);
    await assertUniqueProductSlug(slug, payload.id);

    const pRef = doc($db, "products", payload.id);
    const snap = await getDoc(pRef);
    if (!snap.exists()) throw new Error("Product not found");

    const current = { id: snap.id, ...snap.data() } as ProductRecord;
    if (isSoftDeletedProduct(current)) throw new Error("Product not found");
    if (current.show) {
      await assertCategoryBrandMappingExists(payload.category_id, payload.brand_id);
    }

    const folderPath = `products/${pRef.id}`;
    const hasExplicitImages = payload.images !== undefined || payload.image_files !== undefined;
    const uploadedCoverImage = payload.cover_file ? await uploadImage(payload.cover_file, folderPath) : null;
    const uploadedImages = await uploadImages(payload.image_files, folderPath);
    if (payload.cover_file && !uploadedCoverImage) {
      throw new Error("รูปปกอัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
    assertExpectedUploads(payload.image_files, uploadedImages, "รูปสินค้า");
    const uploadedUrls = [uploadedCoverImage, ...uploadedImages].filter((url): url is string => Boolean(url));
    const images = hasExplicitImages
      ? sanitizeProductImageUrls([...(payload.images ?? []), ...uploadedImages])
      : sanitizeProductImageUrls(Array.isArray(current.images) ? current.images : []);
    const coverImage = String(uploadedImages[0]
      ?? payload.cover_image
      ?? uploadedCoverImage
      ?? images[0]
      ?? (hasExplicitImages ? "" : current.cover_image ?? "")).trim();
    const previousImages = Array.isArray(current.images) ? current.images : [];
    const previousCoverImage = typeof current.cover_image === "string" ? current.cover_image : "";
    const nextImageUrlSet = new Set([coverImage, ...images].filter(Boolean));
    const removedUrls = [...new Set([...previousImages, previousCoverImage].filter((url) => url && !nextImageUrlSet.has(url)))];
    assertPublicReadyProduct({
      ...current,
      ...payload,
      slug,
      show: current.show,
      images,
      cover_image: coverImage,
    });

    const batch = writeBatch($db);
    batch.update(pRef, {
      name: payload.name,
      slug,
      category_id: payload.category_id,
      category_name: payload.category_name,
      brand_id: payload.brand_id,
      brand_name: payload.brand_name,
      seo_title: payload.seo_title ?? current.seo_title ?? "",
      seo_description: payload.seo_description ?? current.seo_description ?? "",
      seo_image: payload.seo_image ?? current.seo_image ?? "",
      cost_price: payload.cost_price,
      sell_price: payload.sell_price,
      condition: normalizeProductCondition(payload.condition ?? current.condition),
      shutter: payload.shutter ?? null,
      defect_detail: payload.defect_detail ?? "",
      free_gift_detail: payload.free_gift_detail ?? "",
      cover_image: coverImage,
      images,
      updated_at: serverTimestamp(),
    });

    await commitWithUploadRollback(() => batch.commit(), uploadedUrls);
    await cleanupUploadedUrls(removedUrls);

    return pRef.id;
  };

  const deleteProduct = async (productId: string) => {
    const pRef = doc($db, "products", productId);
    const snap = await getDoc(pRef);
    if (!snap.exists()) return;

    const p = { id: snap.id, ...snap.data() } as ProductRecord;
    if (isSoftDeletedProduct(p)) return;
    const status = getProductStatus(p);
    assertDeletableProduct(p);
    const show = Boolean(p.show);

    const batch = writeBatch($db);
    batch.update(pRef, {
      is_deleted: true,
      deleted_at: serverTimestamp(),
      show: false,
      is_sellable: false,
      updated_at: serverTimestamp(),
    });
    batch.set(
      globalRef($db),
      {
        total_products: increment(-1),
        active_products: increment(status === "ACTIVE" ? -1 : 0),
        reserved_products: increment(status === "RESERVED" ? -1 : 0),
        sold_products: increment(status === "SOLD" ? -1 : 0),
        visible_products: increment(show ? -1 : 0),
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();
  };

  const toggleShow = async (productId: string, nextShow: boolean) => {
    const pRef = doc($db, "products", productId);
    const snap = await getDoc(pRef);
    if (!snap.exists()) throw new Error("Product not found");

    const current = { id: snap.id, ...snap.data() } as ProductRecord;
    if (isSoftDeletedProduct(current)) throw new Error("Product not found");
    if (nextShow) {
      assertPublicReadyProduct({ ...current, show: true });
      await assertCategoryBrandMappingExists(current.category_id, current.brand_id);
    }
    const currentShow = Boolean(current.show);
    if (currentShow === nextShow) return;

    const batch = writeBatch($db);
    batch.update(pRef, { show: nextShow, updated_at: serverTimestamp() });
    batch.set(
      globalRef($db),
      {
        visible_products: increment(nextShow ? 1 : -1),
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();
  };

  const setReserved = async (productId: string) => {
    const pRef = doc($db, "products", productId);
    const snap = await getDoc(pRef);
    if (!snap.exists()) throw new Error("Product not found");

    const current = { id: snap.id, ...snap.data() } as ProductRecord;
    assertReservableProduct(current);

    const batch = writeBatch($db);
    batch.update(pRef, {
      status: "RESERVED",
      is_sellable: false,
      updated_at: serverTimestamp(),
    });
    batch.set(
      globalRef($db),
      {
        active_products: increment(-1),
        reserved_products: increment(1),
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();
  };

  const setActive = async (productId: string) => {
    const pRef = doc($db, "products", productId);
    const snap = await getDoc(pRef);
    if (!snap.exists()) throw new Error("Product not found");

    const current = { id: snap.id, ...snap.data() } as ProductRecord;
    assertActivatableProduct(current);

    const batch = writeBatch($db);
    batch.update(pRef, {
      status: "ACTIVE",
      is_sellable: true,
      updated_at: serverTimestamp(),
    });
    batch.set(
      globalRef($db),
      {
        active_products: increment(1),
        reserved_products: increment(-1),
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();
  };

  return {
    getProductsPage: (input?: ProductsPageInput) => track(() => getProductsPage(input), "กำลังโหลดสินค้า..."),
    getProducts: (count?: number, options?: { includeDeleted?: boolean }) => track(() => getProducts(count, options), "กำลังโหลดสินค้า..."),
    getProductById: (productId: string) => track(() => getProductById(productId), "กำลังโหลดข้อมูลสินค้า..."),
    createProduct: (payload: ProductInput) => track(() => createProduct(payload), "กำลังบันทึกสินค้า..."),
    updateProduct: (payload: ProductInput) => track(() => updateProduct(payload), "กำลังอัปเดตสินค้า..."),
    deleteProduct: (productId: string) => track(() => deleteProduct(productId), "กำลังลบสินค้า..."),
    toggleShow: (productId: string, nextShow: boolean) => track(() => toggleShow(productId, nextShow), "กำลังอัปเดตการแสดงผลสินค้า..."),
    setReserved: (productId: string) => track(() => setReserved(productId), "กำลังอัปเดตสถานะสินค้า..."),
    setActive: (productId: string) => track(() => setActive(productId), "กำลังอัปเดตสถานะสินค้า..."),
  };
}
