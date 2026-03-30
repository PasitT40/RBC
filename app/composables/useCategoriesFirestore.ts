import { collection, doc, getDoc, getDocs, updateDoc, addDoc, deleteDoc, limit, orderBy, query, startAfter, where, serverTimestamp, writeBatch, type QueryConstraint } from "firebase/firestore";
import { deleteStorageFolder, deleteStorageUrl, deleteStorageUrls, uploadImageAsWebP } from "./firestore/media";
import type { BrandRecord, CategoriesPageInput, CategoryBrandRecord, CategoryRecord, PageCursor, PageResult, SubcategoriesPageInput } from "./firestore/types";

export function useCategoriesFirestore() {
  const { $db, $storage } = useNuxtApp() as { $db: any, $storage: any };
  const { track } = useGlobalLoading();
  const toSlug = (value: string): string => value.toLowerCase().trim().replace(/\s+/g, "-");
  const normalizeName = (value: string): string => value.trim().toLowerCase();
  const uploadImage = async (rawFile: File, folderPath: string): Promise<string | null> =>
    uploadImageAsWebP($storage, rawFile, folderPath);
  const deleteImage = async (url: string | null | undefined): Promise<void> => deleteStorageUrl($storage, url);
  const deleteImages = async (urls: string[]): Promise<void> => deleteStorageUrls($storage, urls);
  const deleteFolder = async (folderPath: string): Promise<void> => deleteStorageFolder($storage, folderPath);
  const commitWithUploadRollback = async (commit: () => Promise<void>, uploadedUrls: string[]) => {
    try {
      await commit();
    } catch (error) {
      await deleteImages(uploadedUrls);
      throw error;
    }
  };

  type OrderScope = {
    categoryId?: string;
  };

  const buildOrderConstraints = (targetOrder: number, scope: OrderScope = {}): QueryConstraint[] => {
    const constraints: QueryConstraint[] = [where("order", ">=", targetOrder)];
    if (scope.categoryId) {
      constraints.push(where("category_id", "==", scope.categoryId));
    }
    constraints.push(orderBy("order", "asc"));
    return constraints;
  };

  const buildNextOrderConstraints = (scope: OrderScope = {}): QueryConstraint[] => {
    const constraints: QueryConstraint[] = [];
    if (scope.categoryId) {
      constraints.push(where("category_id", "==", scope.categoryId));
    }
    constraints.push(orderBy("order", "desc"));
    constraints.push(limit(1));
    return constraints;
  };

  const chunk = <T>(items: T[], size: number): T[][] => {
    const groups: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      groups.push(items.slice(index, index + size));
    }
    return groups;
  };

  const isNameDuplicate = async (collectionName: string, name: string, excludeId?: string): Promise<boolean> => {
    const normalizedTarget = normalizeName(name);
    const snap = await getDocs(collection($db, collectionName));
    return snap.docs.some((d) => {
      if (excludeId && d.id === excludeId) return false;
      const docName = typeof d.data().name === "string" ? normalizeName(d.data().name) : "";
      return docName === normalizedTarget;
    });
  };

  // เช็คชื่อหมวดหมู่ซ้ำ (case-insensitive)
  const isCategoryNameDuplicate = async (name: string, excludeId?: string): Promise<boolean> => {
    return isNameDuplicate("categories", name, excludeId);
  };

  // "Subcategory" is only a backoffice label. Persisted data stays in global
  // brands/{brandId} plus category_brands/{categoryId__brandId}.
  const isSubcategoryNameDuplicate = async (name: string, excludeId?: string): Promise<boolean> => {
    return isNameDuplicate("brands", name, excludeId);
  };

  // paginate หมวดหมู่ (categories)
  const getCategoriesPage = async (input: CategoriesPageInput = {}): Promise<PageResult<CategoryRecord>> => {
    const pageSize = input.pageSize ?? 10;
    const constraints: QueryConstraint[] = [];

    if (typeof input.isActive === "boolean") {
      constraints.push(where("is_active", "==", input.isActive));
    }
    constraints.push(orderBy("order", "asc"));
    constraints.push(limit(pageSize));

    if (input.cursor) constraints.push(startAfter(input.cursor));

    const q = query(collection($db, "categories"), ...constraints);
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CategoryRecord));
    const nextCursor: PageCursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    return {
      items,
      nextCursor,
      hasMore: snap.docs.length === pageSize,
    };
  };

  const getCategories = async (input: { isActive?: boolean } = {}) => {
    const items: CategoryRecord[] = [];
    let cursor: PageCursor = null;
    let hasMore = true;

    while (hasMore) {
      const page = await getCategoriesPage({ pageSize: 1000, isActive: input.isActive, cursor });
      items.push(...page.items);
      cursor = page.nextCursor;
      hasMore = page.hasMore && !!cursor;
    }

    return items;
  };

  // Paginate the backoffice "subcategory" view from global brands enriched with
  // one primary category_brands mapping for display only.
  const getSubcategoriesPage = async (input: SubcategoriesPageInput = {}): Promise<PageResult<(BrandRecord & {
    category_id: string | null;
    category_name: string | null;
    category_brand_id: string | null;
    category_brand_order: number | null;
  })>> => {
    const pageSize = input.pageSize ?? 20;
    const constraints: QueryConstraint[] = [];

    if (typeof input.isActive === "boolean") {
      constraints.push(where("is_active", "==", input.isActive));
    }
    constraints.push(orderBy("order", "asc"));
    constraints.push(limit(pageSize));
    if (input.cursor) constraints.push(startAfter(input.cursor));

    const q = query(collection($db, "brands"), ...constraints);
    const snap = await getDocs(q);
    const brandIds = snap.docs.map((d) => d.id);
    const primaryMappingByBrandId = new Map<string, CategoryBrandRecord>();

    for (const group of chunk(brandIds, 10)) {
      if (!group.length) continue;
      const mappingSnap = await getDocs(
        query(
          collection($db, "category_brands"),
          where("brand_id", "in", group)
        )
      );

      const sortedMappings = mappingSnap.docs
        .map((mappingDoc) => ({ id: mappingDoc.id, ...mappingDoc.data() } as CategoryBrandRecord))
        .sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER));

      for (const mappingData of sortedMappings) {
        if (!mappingData.brand_id || primaryMappingByBrandId.has(mappingData.brand_id)) continue;
        primaryMappingByBrandId.set(mappingData.brand_id, mappingData);
      }
    }

    const items = snap.docs.map((d) => {
      const brandData = { id: d.id, ...d.data() } as BrandRecord;
      const mapping = primaryMappingByBrandId.get(d.id);
      return {
        ...brandData,
        category_id: mapping?.category_id ?? null,
        category_name: mapping?.category_name ?? null,
        category_brand_id: mapping?.id ?? null,
        category_brand_order: mapping?.order ?? null,
      };
    });
    const nextCursor: PageCursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    return {
      items,
      nextCursor,
      hasMore: snap.docs.length === pageSize,
    };
  };

  const getSubcategories = async (input: { isActive?: boolean } = {}) => {
    const items: (BrandRecord & {
      category_id: string | null;
      category_name: string | null;
      category_brand_id: string | null;
      category_brand_order: number | null;
    })[] = [];
    let cursor: PageCursor = null;
    let hasMore = true;

    while (hasMore) {
      const page = await getSubcategoriesPage({ pageSize: 200, isActive: input.isActive, cursor });
      items.push(...page.items);
      cursor = page.nextCursor;
      hasMore = page.hasMore && !!cursor;
    }

    return items;
  };

  const getBrandsByCategory = async (categoryId: string) => {
    if (!categoryId) return [];

    const q = query(
      collection($db, "category_brands"),
      where("category_id", "==", categoryId),
      where("is_active", "==", true)
    );
    const snap = await getDocs(q);

    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as CategoryBrandRecord))
      .sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER));
  };

  const getNextCollectionOrder = async (collectionName: string, scope: OrderScope = {}) => {
    if (collectionName === "category_brands" && scope.categoryId) {
      const snap = await getDocs(
        query(collection($db, collectionName), where("category_id", "==", scope.categoryId))
      );
      const maxOrder = snap.docs.reduce((currentMax, docSnap) => {
        const nextOrder = Number(docSnap.data().order || 0);
        return Math.max(currentMax, nextOrder);
      }, 0);
      return maxOrder + 1;
    }

    const q = query(collection($db, collectionName), ...buildNextOrderConstraints(scope));
    const snap = await getDocs(q);
    if (snap.empty) return 1;
    const data = snap.docs[0]?.data();
    return (data?.order || 0) + 1;
  };

  const shiftOrders = async (collectionName: string, targetOrder: number, scope: OrderScope = {}) => {
    const snap = collectionName === "category_brands" && scope.categoryId
      ? await getDocs(
          query(collection($db, collectionName), where("category_id", "==", scope.categoryId))
        )
      : await getDocs(query(collection($db, collectionName), ...buildOrderConstraints(targetOrder, scope)));

    const updatePromises = snap.docs
      .filter((docSnap) => Number(docSnap.data().order || 0) >= targetOrder)
      .map((docSnap) => {
        const currentOrder = docSnap.data().order || 0;
        return updateDoc(docSnap.ref, { order: currentOrder + 1 });
      });

    await Promise.all(updatePromises);
  };

  /**
   * Create a new category.
   * Pass `file` (File) for the image — we create the Firestore doc first to get
   * the ID, then upload to categories/[id]/, then patch image_url back.
   */
  const addCategory = async (data: { name: string; file?: File; order?: number; [key: string]: any }) => {
    let orderToUse = data.order;
    if (typeof orderToUse === 'number') {
      await shiftOrders("categories", orderToUse);
    } else {
      orderToUse = await getNextCollectionOrder("categories");
    }

    // 1. Create doc (image_url = null for now)
    const { file, ...firestoreData } = data;
    const docRef = await addDoc(collection($db, "categories"), {
      ...firestoreData,
      slug: firestoreData.slug || toSlug(data.name),
      image_url: null,
      seo_title: firestoreData.seo_title ?? "",
      seo_description: firestoreData.seo_description ?? "",
      seo_image: firestoreData.seo_image ?? null,
      is_active: true,
      order: orderToUse,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    // 2. Upload image to categories/[id]/ then patch image_url
    let uploadedImageUrl: string | null = null;
    if (file) {
      uploadedImageUrl = await uploadImage(file, `categories/${docRef.id}`);
      if (!uploadedImageUrl) {
        await deleteDoc(docRef);
        throw new Error("Category image upload failed");
      }
    }

    if (uploadedImageUrl) {
      try {
        await updateDoc(docRef, { image_url: uploadedImageUrl });
      } catch (error) {
        await deleteImage(uploadedImageUrl);
        throw error;
      }
    }

    return docRef.id;
  };

  const addSubcategory = async (data: any) => {
    const name = `${data.name ?? ""}`.trim();
    if (!name) throw new Error("Subcategory name is required");

    let orderToUse = data.order;
    if (typeof orderToUse === 'number') {
      await shiftOrders("brands", orderToUse);
    } else {
      orderToUse = await getNextCollectionOrder("brands");
    }

    const brandRef = doc(collection($db, "brands"));
    const imageUrl = data.file ? await uploadImage(data.file, `brands/${brandRef.id}`) : (data.image_url ?? null);
    if (data.file && !imageUrl) {
      throw new Error("Brand image upload failed");
    }
    const brandPayload = {
      name,
      slug: data.slug || toSlug(name),
      image_url: imageUrl,
      seo_title: data.seo_title ?? "",
      seo_description: data.seo_description ?? "",
      seo_image: data.seo_image ?? null,
      is_active: data.is_active ?? true,
      order: orderToUse,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    const batch = writeBatch($db);
    batch.set(brandRef, brandPayload);

    if (data.category_id) {
      const categoryRef = doc($db, "categories", data.category_id);
      const categorySnap = await getDoc(categoryRef);
      if (!categorySnap.exists()) throw new Error("Category not found");

      let catBrandOrderToUse = data.categoryBrandOrder;
      if (typeof catBrandOrderToUse === "number") {
        await shiftOrders("category_brands", catBrandOrderToUse, { categoryId: data.category_id });
      } else {
        catBrandOrderToUse = await getNextCollectionOrder("category_brands", { categoryId: data.category_id });
      }

      const categoryData = { id: categorySnap.id, ...categorySnap.data() } as CategoryRecord;
      const mappingRef = doc($db, "category_brands", `${data.category_id}__${brandRef.id}`);
      batch.set(mappingRef, {
        category_id: data.category_id,
        category_name: categoryData.name ?? "",
        category_slug: categoryData.slug || toSlug(categoryData.name ?? data.category_id),
        brand_id: brandRef.id,
        brand_name: name,
        brand_image_url: imageUrl,
        is_active: data.is_active ?? true,
        order: catBrandOrderToUse,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }, { merge: true });
    }

    await commitWithUploadRollback(() => batch.commit(), imageUrl ? [imageUrl] : []);
    return brandRef.id;
  };

  /**
   * Update a category.
   * Pass `file` (File) to replace the image — old image is deleted automatically.
   * Name change alone requires NO Storage operations (folder = doc ID, not name).
   */
  const updateCategory = async (id: string, data: { name?: string; file?: File; is_active?: boolean; order?: number; [key: string]: any }) => {
    if (typeof data.order === 'number') {
      await shiftOrders("categories", data.order);
    }

    const docRef = doc($db, "categories", id);
    const { file, ...firestoreData } = data;
    const oldDoc = file ? await getDoc(docRef) : null;
    const oldImageUrl = oldDoc?.exists() ? oldDoc.data().image_url : null;
    let uploadedImageUrl: string | null = null;

    if (file) {
      uploadedImageUrl = await uploadImage(file, `categories/${id}`);
      if (!uploadedImageUrl) {
        throw new Error("Category image upload failed");
      }
      firestoreData.image_url = uploadedImageUrl;
    }
    // ถ้าไม่มีรูปใหม่ + ชื่อเปลี่ยน → ไม่ต้องแตะ Storage เลย ✅ (folder = id ไม่เปลี่ยน)

    await commitWithUploadRollback(
      () => updateDoc(docRef, {
        ...firestoreData,
        ...(typeof firestoreData.name === "string" ? { slug: firestoreData.slug || toSlug(firestoreData.name) } : {}),
        ...(Object.prototype.hasOwnProperty.call(firestoreData, "seo_image")
          ? { seo_image: firestoreData.seo_image || null }
          : {}),
        updated_at: serverTimestamp(),
      }),
      uploadedImageUrl ? [uploadedImageUrl] : []
    );

    if (uploadedImageUrl && oldImageUrl) {
      await deleteImage(oldImageUrl);
    }
  };

  const deleteCategory = async (id: string) => {
    await deleteFolder(`categories/${id}`);
    const qCatBrand = query(collection($db, "category_brands"), where("category_id", "==", id));
    const snapCatBrand = await getDocs(qCatBrand);

    const batch = writeBatch($db);
    batch.delete(doc($db, "categories", id));
    for (const mappingDoc of snapCatBrand.docs) {
      batch.delete(mappingDoc.ref);
    }
    await batch.commit();
  };

  const updateSubcategory = async (id: string, data: any) => {
    const docRef = doc($db, "brands", id);
    const oldDoc = await getDoc(docRef);
    if (!oldDoc.exists()) throw new Error("Subcategory not found");

    if (typeof data.order === 'number') {
      await shiftOrders("brands", data.order);
    }

    const oldData = oldDoc.data() as Record<string, any>;
    const nextName = typeof data.name === "string" ? data.name.trim() : (oldData.name ?? "");
    const nextIsActive = typeof data.is_active === "boolean" ? data.is_active : Boolean(oldData.is_active);
    const uploadedImageUrl = data.file
      ? await uploadImage(data.file, `brands/${id}`)
      : null;
    if (data.file && !uploadedImageUrl) {
      throw new Error("Brand image upload failed");
    }
    const nextImageUrl = data.file
      ? uploadedImageUrl
      : (data.image_url !== undefined ? data.image_url : oldData.image_url ?? null);

    const brandPayload: Record<string, any> = {
      name: nextName,
      slug: data.slug || toSlug(nextName),
      image_url: nextImageUrl,
      seo_title: data.seo_title ?? oldData.seo_title ?? "",
      seo_description: data.seo_description ?? oldData.seo_description ?? "",
      seo_image: data.seo_image !== undefined ? (data.seo_image || null) : oldData.seo_image ?? null,
      is_active: nextIsActive,
      updated_at: serverTimestamp(),
    };
    if (typeof data.order === "number") {
      brandPayload.order = data.order;
    }

    const qCatBrand = query(collection($db, "category_brands"), where("brand_id", "==", id));
    const snapCatBrand = await getDocs(qCatBrand);
    const categoryMappings = snapCatBrand.docs;
    const batch = writeBatch($db);
    batch.update(docRef, brandPayload);

    if (Object.prototype.hasOwnProperty.call(data, "category_id")) {
      if (data.category_id) {
        const targetMappingId = `${data.category_id}__${id}`;
        const targetDoc = categoryMappings.find((d) => d.id === targetMappingId);

        let categoryBrandOrder = data.categoryBrandOrder;
        if (typeof categoryBrandOrder === "number") {
          await shiftOrders("category_brands", categoryBrandOrder, { categoryId: data.category_id });
        } else {
          categoryBrandOrder = targetDoc?.data().order;
          if (typeof categoryBrandOrder !== "number") {
            categoryBrandOrder = await getNextCollectionOrder("category_brands", { categoryId: data.category_id });
          }
        }

        for (const mappingDoc of categoryMappings) {
          if (mappingDoc.id !== targetMappingId) {
            batch.delete(mappingDoc.ref);
          }
        }

        const categoryRef = doc($db, "categories", data.category_id);
        const categorySnap = await getDoc(categoryRef);
        if (!categorySnap.exists()) throw new Error("Category not found");
        const categoryData = { id: categorySnap.id, ...categorySnap.data() } as CategoryRecord;

        const targetMappingRef = doc($db, "category_brands", targetMappingId);
        batch.set(targetMappingRef, {
          category_id: data.category_id,
          category_name: categoryData.name ?? "",
          category_slug: categoryData.slug || toSlug(categoryData.name ?? data.category_id),
          brand_id: id,
          brand_name: nextName,
          brand_image_url: nextImageUrl,
          is_active: nextIsActive,
          order: categoryBrandOrder,
          created_at: targetDoc?.data().created_at || serverTimestamp(),
          updated_at: serverTimestamp(),
        }, { merge: true });
      } else {
        for (const mappingDoc of categoryMappings) {
          batch.delete(mappingDoc.ref);
        }
      }
    } else {
      for (const mappingDoc of categoryMappings) {
        batch.update(mappingDoc.ref, {
          brand_name: nextName,
          brand_image_url: nextImageUrl,
          is_active: nextIsActive,
          updated_at: serverTimestamp(),
        });
      }
    }

    await commitWithUploadRollback(() => batch.commit(), uploadedImageUrl ? [uploadedImageUrl] : []);

    if (data.file && oldData.image_url) {
      await deleteImage(oldData.image_url);
    }
  };

  const deleteSubcategory = async (id: string) => {
    await deleteFolder(`brands/${id}`);

    const qCatBrand = query(collection($db, "category_brands"), where("brand_id", "==", id));
    const snapCatBrand = await getDocs(qCatBrand);

    const batch = writeBatch($db);
    batch.delete(doc($db, "brands", id));
    for (const mappingDoc of snapCatBrand.docs) {
      batch.delete(mappingDoc.ref);
    }
    await batch.commit();
  };

  return {
    getCategoriesPage: (input?: CategoriesPageInput) => track(() => getCategoriesPage(input), "Loading categories..."),
    getSubcategoriesPage: (input: SubcategoriesPageInput) => track(() => getSubcategoriesPage(input), "Loading subcategories..."),
    getCategories: (input?: { isActive?: boolean }) => track(() => getCategories(input), "Loading categories..."),
    getSubcategories: (input?: { isActive?: boolean }) => track(() => getSubcategories(input), "Loading subcategories..."),
    getBrandsByCategory: (categoryId: string) => track(() => getBrandsByCategory(categoryId), "Loading brands..."),
    addCategory: (data: { name: string; file?: File; order?: number; [key: string]: any }) => track(() => addCategory(data), "Saving category..."),
    addSubcategory: (data: any) => track(() => addSubcategory(data), "Saving subcategory..."),
    updateCategory: (id: string, data: { name?: string; file?: File; is_active?: boolean; order?: number; [key: string]: any }) => track(() => updateCategory(id, data), "Updating category..."),
    updateSubcategory: (id: string, data: any) => track(() => updateSubcategory(id, data), "Updating subcategory..."),
    deleteCategory: (id: string) => track(() => deleteCategory(id), "Deleting category..."),
    deleteSubcategory: (id: string) => track(() => deleteSubcategory(id), "Deleting subcategory..."),
    uploadImage,
    deleteFolder,
    isCategoryNameDuplicate,
    isSubcategoryNameDuplicate,
  };
}
