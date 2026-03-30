<script lang="ts" setup>
import { format } from "date-fns";
import { useForm } from "vee-validate";
import * as yup from "yup";

type DialogMode = "category" | "subcategory" | null;
type CategoryLikeItem = Record<string, any>;
type CategoryFormValues = {
  name: string;
  seo_title: string;
  seo_description: string;
  seo_image: string;
  category_id: string;
  order: number | null;
  category_brand_order: number | null;
  image: File | null;
};

const {
  addCategory, updateCategory, deleteCategory,
  addSubcategory, updateSubcategory, deleteSubcategory,
  isCategoryNameDuplicate, isSubcategoryNameDuplicate,
  getCategories, getSubcategories,
} = useCategoriesFirestore();
const appToast = useAppToast();

const itemCategory = ref<CategoryLikeItem[]>([]);
const itemSubCategory = ref<CategoryLikeItem[]>([]);
const errorMessage = ref<string | null>(null);
const dialogMode = ref<DialogMode>(null);
const deleteCategoryId = ref<string | null>(null);
const deleteSubcategoryId = ref<string | null>(null);
const editCategoryItem = ref<CategoryLikeItem | null>(null);
const editSubcategoryItem = ref<CategoryLikeItem | null>(null);

const headers = [
  { title: "Name", key: "name" },
  { title: "Slug", key: "slug" },
  { title: "Order", key: "order" },
  { title: "Img", key: "image_url" },
  { title: "Update at", key: "updated_at" },
  { title: "Is Active", key: "is_active" },
  { title: "Action", key: "Action" },
];

const subcategoryHeaders = [
  { title: "Name", key: "name" },
  { title: "Slug", key: "slug" },
  { title: "Category", key: "category_name" },
  { title: "Brand Order", key: "order" },
  { title: "Mapping Order", key: "category_brand_order" },
  { title: "Img", key: "image_url" },
  { title: "Update at", key: "updated_at" },
  { title: "Is Active", key: "is_active" },
  { title: "Action", key: "Action" },
];

const emptyFormValues = (): CategoryFormValues => ({
  name: "",
  seo_title: "",
  seo_description: "",
  seo_image: "",
  category_id: "",
  order: null,
  category_brand_order: null,
  image: null,
});

const categoryDialog = computed({
  get: () => dialogMode.value === "category",
  set: (value) => {
    if (!value && dialogMode.value === "category") {
      dialogMode.value = null;
      editCategoryItem.value = null;
    }
  },
});

const subcategoryDialog = computed({
  get: () => dialogMode.value === "subcategory",
  set: (value) => {
    if (!value && dialogMode.value === "subcategory") {
      dialogMode.value = null;
      editSubcategoryItem.value = null;
    }
  },
});

const showCategoryDeleteDialog = computed({
  get: () => Boolean(deleteCategoryId.value),
  set: (value) => {
    if (!value) deleteCategoryId.value = null;
  },
});

const showSubcategoryDeleteDialog = computed({
  get: () => Boolean(deleteSubcategoryId.value),
  set: (value) => {
    if (!value) deleteSubcategoryId.value = null;
  },
});

const isCategoryEditMode = computed(() => editCategoryItem.value !== null);
const isSubcategoryEditMode = computed(() => editSubcategoryItem.value !== null);

const formatDate = (date: unknown) => {
  if (!date) return "";

  const normalizedDate =
    typeof date === "object" &&
    date !== null &&
    "toDate" in date &&
    typeof (date as { toDate: () => Date }).toDate === "function"
      ? (date as { toDate: () => Date }).toDate()
      : new Date(date as string | number | Date);

  try {
    return format(normalizedDate, "dd/MM/yyyy HH:mm:ss");
  } catch {
    return "";
  }
};

const categoryOptions = computed(() => itemCategory.value.map((item) => ({
  title: item.name,
  value: item.id,
})));

const schema = computed(() => {
  if (dialogMode.value === "subcategory") {
    return yup.object({
      name: yup.string().required("Name required"),
      seo_title: yup.string().nullable().default(""),
      seo_description: yup.string().nullable().default(""),
      seo_image: yup
        .string()
        .transform((value, originalValue) => (originalValue === "" || originalValue === null ? undefined : value))
        .url("SEO image must be a valid URL")
        .nullable()
        .optional(),
      category_id: yup.string().required("Category required"),
      order: yup
        .number()
        .transform((value, originalValue) => (originalValue === "" || originalValue === null ? null : value))
        .nullable()
        .min(1, "Brand order must be at least 1"),
      category_brand_order: yup
        .number()
        .transform((value, originalValue) => (originalValue === "" || originalValue === null ? null : value))
        .nullable()
        .min(1, "Mapping order must be at least 1"),
      image: isSubcategoryEditMode.value
        ? yup.mixed().nullable().optional()
        : yup.mixed().required("Image required"),
    });
  }

  return yup.object({
    name: yup.string().required("Name required"),
    seo_title: yup.string().nullable().default(""),
    seo_description: yup.string().nullable().default(""),
    seo_image: yup
      .string()
      .transform((value, originalValue) => (originalValue === "" || originalValue === null ? undefined : value))
      .url("SEO image must be a valid URL")
      .nullable()
      .optional(),
    category_id: yup.string().nullable().optional(),
    order: yup
      .number()
      .transform((value, originalValue) => (originalValue === "" || originalValue === null ? null : value))
      .nullable()
      .min(1, "Order must be at least 1"),
    category_brand_order: yup.number().nullable().optional(),
    image: isCategoryEditMode.value
      ? yup.mixed().nullable().optional()
      : yup.mixed().required("Image required"),
  });
});

const { handleSubmit, setValues, resetForm } = useForm<CategoryFormValues>({
  validationSchema: schema,
});

const loadPageData = async () => {
  itemCategory.value = await getCategories();
  itemSubCategory.value = await getSubcategories();
};

const resetDialogForm = (values: CategoryFormValues) => {
  errorMessage.value = null;
  resetForm({ values });
};

const closeCategoryDialog = () => {
  categoryDialog.value = false;
  editCategoryItem.value = null;
};

const closeSubcategoryDialog = () => {
  subcategoryDialog.value = false;
  editSubcategoryItem.value = null;
};

const openCreateCategory = async () => {
  editCategoryItem.value = null;
  dialogMode.value = "category";
  await nextTick();
  resetDialogForm(emptyFormValues());
};

const toggleCategoryEdit = async (item: CategoryLikeItem) => {
  editCategoryItem.value = item;
  dialogMode.value = "category";
  await nextTick();
  resetDialogForm({
    name: item.name,
    seo_title: item.seo_title || "",
    seo_description: item.seo_description || "",
    seo_image: item.seo_image || "",
    category_id: "",
    order: typeof item.order === "number" ? item.order : null,
    category_brand_order: null,
    image: null,
  });
};

const openCreateSubcategory = async () => {
  editSubcategoryItem.value = null;
  dialogMode.value = "subcategory";
  await nextTick();
  resetDialogForm(emptyFormValues());
};

const toggleSubcategoryEdit = async (item: CategoryLikeItem) => {
  editSubcategoryItem.value = item;
  dialogMode.value = "subcategory";
  await nextTick();
  resetDialogForm({
    name: item.name,
    seo_title: item.seo_title || "",
    seo_description: item.seo_description || "",
    seo_image: item.seo_image || "",
    category_id: item.category_id || "",
    order: typeof item.order === "number" ? item.order : null,
    category_brand_order: typeof item.category_brand_order === "number" ? item.category_brand_order : null,
    image: null,
  });
};

const showDuplicateError = (label: string, name: string) => {
  errorMessage.value = `ชื่อ${label} "${name}" มีอยู่แล้วในระบบ`;
  appToast.error(errorMessage.value);
};

const normalizePositiveOrder = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value >= 1 ? Math.trunc(value) : undefined;

const submitCategory = async (values: CategoryFormValues, trimmedName: string) => {
  if (isCategoryEditMode.value && editCategoryItem.value) {
    const isDuplicate = await isCategoryNameDuplicate(trimmedName, editCategoryItem.value.id);
    if (isDuplicate) {
      showDuplicateError("หมวดหมู่", trimmedName);
      return false;
    }

    await updateCategory(editCategoryItem.value.id, {
      name: trimmedName,
      seo_title: values.seo_title?.trim() || "",
      seo_description: values.seo_description?.trim() || "",
      seo_image: values.seo_image?.trim() || null,
      order: normalizePositiveOrder(values.order),
      ...(values.image ? { file: values.image } : {}),
    });
    appToast.success("อัปเดตหมวดหมู่สำเร็จ");
    closeCategoryDialog();
    return true;
  }

  const isDuplicate = await isCategoryNameDuplicate(trimmedName);
  if (isDuplicate) {
    showDuplicateError("หมวดหมู่", trimmedName);
    return false;
  }

  await addCategory({
    name: trimmedName,
    seo_title: values.seo_title?.trim() || "",
    seo_description: values.seo_description?.trim() || "",
    seo_image: values.seo_image?.trim() || null,
    order: normalizePositiveOrder(values.order),
    ...(values.image ? { file: values.image } : {}),
  });
  appToast.success("สร้างหมวดหมู่สำเร็จ");
  closeCategoryDialog();
  return true;
};

const submitSubcategory = async (values: CategoryFormValues, trimmedName: string) => {
  if (isSubcategoryEditMode.value && editSubcategoryItem.value) {
    const isDuplicate = await isSubcategoryNameDuplicate(trimmedName, editSubcategoryItem.value.id);
    if (isDuplicate) {
      showDuplicateError("แบรนด์", trimmedName);
      return false;
    }

    await updateSubcategory(editSubcategoryItem.value.id, {
      name: trimmedName,
      category_id: values.category_id,
      seo_title: values.seo_title?.trim() || "",
      seo_description: values.seo_description?.trim() || "",
      seo_image: values.seo_image?.trim() || null,
      order: normalizePositiveOrder(values.order),
      categoryBrandOrder: normalizePositiveOrder(values.category_brand_order),
      ...(values.image ? { file: values.image } : {}),
    });
    appToast.success("อัปเดตแบรนด์สำเร็จ");
    closeSubcategoryDialog();
    return true;
  }

  const isDuplicate = await isSubcategoryNameDuplicate(trimmedName);
  if (isDuplicate) {
    showDuplicateError("แบรนด์", trimmedName);
    return false;
  }

  await addSubcategory({
    name: trimmedName,
    category_id: values.category_id,
    seo_title: values.seo_title?.trim() || "",
    seo_description: values.seo_description?.trim() || "",
    seo_image: values.seo_image?.trim() || null,
    order: normalizePositiveOrder(values.order),
    categoryBrandOrder: normalizePositiveOrder(values.category_brand_order),
    ...(values.image ? { file: values.image } : {}),
  });
  appToast.success("สร้างแบรนด์สำเร็จ");
  closeSubcategoryDialog();
  return true;
};

const submit = handleSubmit(async (values) => {
  try {
    errorMessage.value = null;
    const trimmedName = values.name?.trim() || "";
    let shouldReload = false;

    if (dialogMode.value === "category") {
      shouldReload = await submitCategory(values, trimmedName);
    } else if (dialogMode.value === "subcategory") {
      shouldReload = await submitSubcategory(values, trimmedName);
    }

    if (shouldReload) {
      await loadPageData();
    }
  } catch (error) {
    console.error("เกิดข้อผิดพลาด:", error);
    errorMessage.value = "เกิดข้อผิดพลาด กรุณาลองใหม่";
    appToast.error(errorMessage.value);
  }
});

const confirmCategoryDelete = (id: string) => {
  deleteCategoryId.value = id;
};

const confirmSubcategoryDelete = (id: string) => {
  deleteSubcategoryId.value = id;
};

const handleDelete = async (
  id: string,
  action: (value: string) => Promise<void>,
  successMessage: string,
  errorToastMessage: string,
  onFinally: () => void
) => {
  try {
    await action(id);
    await loadPageData();
    appToast.success(successMessage);
  } catch (error) {
    console.error("ลบไม่สำเร็จ:", error);
    appToast.error(errorToastMessage);
  } finally {
    onFinally();
  }
};

const handleDeleteCategory = async () => {
  if (!deleteCategoryId.value) return;

  await handleDelete(
    deleteCategoryId.value,
    deleteCategory,
    "ลบหมวดหมู่สำเร็จ",
    "ลบหมวดหมู่ไม่สำเร็จ",
    () => {
      deleteCategoryId.value = null;
    }
  );
};

const handleDeleteSubcategory = async () => {
  if (!deleteSubcategoryId.value) return;

  await handleDelete(
    deleteSubcategoryId.value,
    deleteSubcategory,
    "ลบหมวดย่อยสำเร็จ",
    "ลบหมวดย่อยไม่สำเร็จ",
    () => {
      deleteSubcategoryId.value = null;
    }
  );
};

const toggleCategoryActive = async (item: CategoryLikeItem, nextValue: boolean) => {
  const previousValue = item.is_active;
  item.is_active = nextValue;

  try {
    await updateCategory(item.id, { is_active: nextValue });
    appToast.success("อัปเดตสถานะหมวดหมู่สำเร็จ");
  } catch (error) {
    item.is_active = previousValue;
    console.error("อัปเดตสถานะ category ไม่สำเร็จ:", error);
    errorMessage.value = "อัปเดตสถานะหมวดหมู่ไม่สำเร็จ";
    appToast.error(errorMessage.value);
  }
};

const toggleSubcategoryActive = async (item: CategoryLikeItem, nextValue: boolean) => {
  const previousValue = item.is_active;
  item.is_active = nextValue;

  try {
    await updateSubcategory(item.id, { is_active: nextValue });
    appToast.success("อัปเดตสถานะแบรนด์สำเร็จ");
  } catch (error) {
    item.is_active = previousValue;
    console.error("อัปเดตสถานะ subcategory ไม่สำเร็จ:", error);
    errorMessage.value = "อัปเดตสถานะแบรนด์ไม่สำเร็จ";
    appToast.error(errorMessage.value);
  }
};

onMounted(loadPageData);
</script>

<template>
  <div class="pa-6">      
    <ModalCategory
      v-model="categoryDialog"
      persistent
      :title="isCategoryEditMode ? 'Edit Category' : 'New Category'"
    >
    <template #default>
      <v-form >
        <form-vee-text-field variant="outlined" name="name" label="Category Name" />
        <div class="tw:mb-3 tw:text-xs tw:text-neutral-500">
          Slug จะสร้างจากชื่ออัตโนมัติ และหน้า public จะ fallback ไปใช้ `name` / `image_url` หาก SEO fields ว่าง
        </div>
        <form-vee-text-field variant="outlined" name="order" label="Display Order" type="number" min="1" />
        <form-vee-text-field variant="outlined" name="seo_title" label="SEO Title" />
        <form-vee-text-area variant="outlined" name="seo_description" label="SEO Description" rows="3" auto-grow />
        <form-vee-text-field variant="outlined" name="seo_image" label="SEO Image URL" />
        <form-vee-file-input
          variant="outlined"
          name="image"
          label="Image"
          :preview-url="isCategoryEditMode ? editCategoryItem?.image_url : undefined"
        />
      </v-form>
    </template>
    <template #actions>
      <div class="tw:flex tw:justify-end tw:gap-2">
        <v-btn color="primary" @click="closeCategoryDialog">Close</v-btn>
        <v-btn color="primary" @click="submit()">Save</v-btn>
      </div>
    </template>
    </ModalCategory>

    <ModalCategory
      v-model="subcategoryDialog"
      persistent
      :title="isSubcategoryEditMode ? 'Edit Brand' : 'New Brand'"
    >
    <template #default>
      <v-form>
        <div class="tw:mb-3 tw:text-xs tw:text-neutral-500">
          หน้านี้แก้ global `brands/{brandId}` และ `category_brands/{categoryId__brandId}` เท่านั้น ไม่มี brand subcollection ใต้ category
        </div>
        <form-vee-text-field variant="outlined" name="name" label="Brand Name" />
        <form-vee-text-field variant="outlined" name="order" label="Global Brand Order" type="number" min="1" />
        <form-vee-text-field variant="outlined" name="seo_title" label="SEO Title" />
        <form-vee-text-area variant="outlined" name="seo_description" label="SEO Description" rows="3" auto-grow />
        <form-vee-text-field variant="outlined" name="seo_image" label="SEO Image URL" />
        <form-vee-select
          variant="outlined"
          name="category_id"
          label="Category"
          item-title="title"
          item-value="value"
          :items="categoryOptions"
        />
        <form-vee-text-field variant="outlined" name="category_brand_order" label="Order In Selected Category" type="number" min="1" />
        <div class="tw:mb-3 tw:text-xs tw:text-neutral-500">
          Brand dropdown ในหน้าสินค้าอ้างอิง `category_brands` เท่านั้น และใช้ลำดับจาก `category_brands.order`
        </div>
        <form-vee-file-input
          variant="outlined"
          name="image"
          label="Image"
          :preview-url="isSubcategoryEditMode ? editSubcategoryItem?.image_url : undefined"
        />
      </v-form>
    </template>
    <template #actions>
      <div class="tw:flex tw:justify-end tw:gap-2">
        <v-btn color="primary" @click="closeSubcategoryDialog">Close</v-btn>
        <v-btn color="primary" @click="submit()">Save</v-btn>
      </div>
    </template>
    </ModalCategory>
    <v-row class="tw:mt-1">
      <v-col cols="12">
        <div class="tw:mb-5 tw:flex tw:flex-col tw:gap-4 md:tw:flex-row md:tw:items-center md:tw:justify-between">
          <div class="tw:text-3xl tw:font-black tw:text-black">Categories</div>
          <v-btn
            color="#f5962f"
            rounded="pill"
            size="large"
            class="tw:self-start tw:px-7 tw:font-bold tw:normal-case tw:text-white md:tw:self-auto"
            @click="openCreateCategory()"
          >
            <v-icon start>mdi-plus</v-icon>
            New
          </v-btn>
        </div>  
      </v-col>
      <v-col cols="12">

        <v-card
          rounded="xl"
          elevation="0"
          class=" tw:overflow-hidden tw:border tw:border-black/5"
        >
        
          <v-data-table
            class="elevation-0 tw:shadow-none"
            :headers="headers"
            :items="itemCategory"
            :items-per-page="10"
            hover
          >
            <template v-slot:item.image_url="{ item }">
              <div class="tw:flex tw:items-center tw:py-1">
                <div class="tw:h-16 tw:w-16 tw:overflow-hidden tw:rounded-full tw:bg-gray-200">
                  <v-img v-if="item.image_url" :src="item.image_url" width="64" height="64" cover />
                </div>
              </div>
            </template>

            <template v-slot:item.name="{ item }">
              <span class="tw:text-md tw:text-black">{{ item.name || "-" }}</span>
            </template>

            <template v-slot:item.slug="{ item }">
              <span class="tw:text-xs tw:text-neutral-500">{{ item.slug || "-" }}</span>
            </template>

            <template v-slot:item.order="{ item }">
              <span class="tw:text-md tw:font-semibold tw:text-black">{{ item.order ?? "-" }}</span>
            </template>

            <template v-slot:item.updated_at="{ item }">
              <span class="tw:text-md tw:font-semibold tw:text-black">
                {{ formatDate(item.updated_at) }}
              </span>
            </template>

            <template v-slot:item.is_active="{ item }">
              <div class="tw:flex tw:items-center tw:gap-2">
                <form-vee-switch
                  v-model="item.is_active"
                  color="primary"
                  density="compact"
                  hide-details
                  inset
                  @update:model-value="toggleCategoryActive(item, $event)"
                />
                <span class="tw:text-sm tw:text-neutral-700">{{ item.is_active ? "on" : "off" }}</span>
              </div>
            </template>

            <template v-slot:item.Action="{ item }">
              <div class="tw:flex tw:items-center tw:gap-1">
                <v-btn icon variant="text" color="black" @click="toggleCategoryEdit(item)">
                  <v-icon size="28">mdi-pencil</v-icon>
                </v-btn>
                <v-btn icon variant="text" color="black" @click="confirmCategoryDelete(item.id)">
                  <v-icon size="28">mdi-delete</v-icon>
                </v-btn>
              </div>
            </template>
          </v-data-table>
        </v-card>
      </v-col>

      <v-col cols="12" class="tw:mt-6">
        <div class="tw:mb-5 tw:flex tw:flex-col tw:gap-4 md:tw:flex-row md:tw:items-center md:tw:justify-between">
          <div>
            <div class="tw:text-3xl tw:font-black tw:text-black">Brands</div>
            <div class="tw:text-sm tw:text-neutral-500">
              แสดง global brands พร้อม primary category mapping สำหรับงาน backoffice
            </div>
          </div>
          <v-btn
            color="#f5962f"
            rounded="pill"
            size="large"
            class="tw:self-start tw:px-7 tw:font-bold tw:normal-case tw:text-white md:tw:self-auto"
            @click="openCreateSubcategory()"
          >
            <v-icon start>mdi-plus</v-icon>
            New Brand
          </v-btn>
        </div>
      </v-col>
      <v-col cols="12">
                <v-card
          rounded="xl"
          elevation="0"
          class="tw:overflow-hidden tw:border tw:border-black/5"
        >
          <v-data-table
            class="elevation-0 tw:shadow-none"
            :headers="subcategoryHeaders"
            :items="itemSubCategory"
            :items-per-page="10"
            hover
          >
            <template v-slot:item.image_url="{ item }">
              <div class="tw:flex tw:items-center tw:py-1">
                <div class="tw:h-16 tw:w-16 tw:overflow-hidden tw:rounded-full tw:bg-gray-200">
                  <v-img v-if="item.image_url" :src="item.image_url" width="64" height="64" cover />
                </div>
              </div>
            </template>

            <template v-slot:item.name="{ item }">
              <span class="tw:text-md tw:text-black">{{ item.name || "-" }}</span>
            </template>

            <template v-slot:item.slug="{ item }">
              <span class="tw:text-xs tw:text-neutral-500">{{ item.slug || "-" }}</span>
            </template>

            <template v-slot:item.category_name="{ item }">
              <span class="tw:text-md tw:font-bold tw:text-black">{{ item.category_name || "-" }}</span>
            </template>

            <template v-slot:item.order="{ item }">
              <span class="tw:text-md tw:font-semibold tw:text-black">{{ item.order ?? "-" }}</span>
            </template>

            <template v-slot:item.category_brand_order="{ item }">
              <span class="tw:text-md tw:font-semibold tw:text-black">{{ item.category_brand_order ?? "-" }}</span>
            </template>

            <template v-slot:item.updated_at="{ item }">
              <span class="tw:text-md tw:font-semibold tw:text-black">
                {{ formatDate(item.updated_at) }}
              </span>
            </template>

            <template v-slot:item.is_active="{ item }">
              <div class="tw:flex tw:items-center tw:gap-2">
                <form-vee-switch
                  v-model="item.is_active"
                  color="primary"
                  density="compact"
                  hide-details
                  inset
                  @update:model-value="toggleSubcategoryActive(item, $event)"
                />
                <span class="tw:text-sm tw:text-neutral-700">{{ item.is_active ? "on" : "off" }}</span>
              </div>
            </template>

            <template v-slot:item.Action="{ item }">
              <div class="tw:flex tw:items-center tw:gap-1">
                <v-btn icon variant="text" color="black" @click="toggleSubcategoryEdit(item)">
                  <v-icon size="28">mdi-pencil</v-icon>
                </v-btn>
                <v-btn icon variant="text" color="black" @click="confirmSubcategoryDelete(item.id)">
                  <v-icon size="28">mdi-delete</v-icon>
                </v-btn>
              </div>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

  </div>

  <!-- Delete Confirm Dialog -->
  <v-dialog v-model="showCategoryDeleteDialog" max-width="400" persistent>
    <v-card>
      <v-card-title>ยืนยันการลบ</v-card-title>
      <v-card-text>คุณต้องการลบหมวดหมู่นี้และรูปภาพทั้งหมดใช่หรือไม่?</v-card-text>
      <v-card-actions class="justify-end">
        <v-btn @click="deleteCategoryId = null">ยกเลิก</v-btn>
        <v-btn color="error" @click="handleDeleteCategory()">ลบ</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="showSubcategoryDeleteDialog" max-width="400" persistent>
    <v-card>
      <v-card-title>ยืนยันการลบ</v-card-title>
      <v-card-text>คุณต้องการลบแบรนด์นี้และรูปภาพทั้งหมดใช่หรือไม่?</v-card-text>
      <v-card-actions class="justify-end">
        <v-btn @click="deleteSubcategoryId = null">ยกเลิก</v-btn>
        <v-btn color="error" @click="handleDeleteSubcategory()">ลบ</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

</template>
