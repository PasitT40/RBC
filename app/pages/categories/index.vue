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
const categorySearch = ref("");
const brandSearch = ref("");
const errorMessage = ref<string | null>(null);
const dialogMode = ref<DialogMode>(null);
const deleteCategoryId = ref<string | null>(null);
const deleteSubcategoryId = ref<string | null>(null);
const editCategoryItem = ref<CategoryLikeItem | null>(null);
const editSubcategoryItem = ref<CategoryLikeItem | null>(null);

const headers = [
  { title: "ชื่อ", key: "name", align: "center" as const },
  { title: "Slug", key: "slug", align: "center" as const },
  { title: "ลำดับ", key: "order", align: "center" as const },
  { title: "รูปภาพ", key: "image_url", align: "center" as const },
  { title: "อัปเดตล่าสุด", key: "updated_at", align: "center" as const },
  { title: "สถานะ", key: "is_active", align: "center" as const },
  { title: "จัดการ", key: "Action", align: "center" as const },
];

const subcategoryHeaders = [
  { title: "ชื่อ", key: "name", align: "center" as const },
  { title: "Slug", key: "slug", align: "center" as const },
  { title: "หมวดหมู่", key: "category_name", align: "center" as const },
  { title: "ลำดับในหมวดหมู่", key: "category_brand_order", align: "center" as const },
  { title: "รูปภาพ", key: "image_url", align: "center" as const },
  { title: "อัปเดตล่าสุด", key: "updated_at" },
  { title: "สถานะ", key: "is_active" },
  { title: "จัดการ", key: "Action", align: "center" as const },
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
const bannerImageHint = "แนะนำภาพแนวนอนประมาณ 1600x900 พิกเซล ระบบจะบีบอัดเป็น WebP อัตโนมัติ";

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
      name: yup.string().required("กรุณากรอกชื่อแบรนด์"),
      seo_title: yup.string().nullable().default(""),
      seo_description: yup.string().nullable().default(""),
      seo_image: yup
        .string()
        .transform((value, originalValue) => (originalValue === "" || originalValue === null ? undefined : value))
        .url("ลิงก์รูป SEO ต้องเป็น URL ที่ถูกต้อง")
        .nullable()
        .optional(),
      category_id: yup.string().required("กรุณาเลือกหมวดหมู่"),
      order: yup
        .number()
        .transform((value, originalValue) => (originalValue === "" || originalValue === null ? null : value))
        .nullable()
        .min(1, "ลำดับรวมต้องเริ่มต้นที่ 1"),
      category_brand_order: yup
        .number()
        .transform((value, originalValue) => (originalValue === "" || originalValue === null ? null : value))
        .nullable()
        .min(1, "ลำดับในหมวดหมู่ต้องเริ่มต้นที่ 1"),
      image: isSubcategoryEditMode.value
        ? yup.mixed().nullable().optional()
        : yup.mixed().required("กรุณาเลือกรูปภาพ"),
    });
  }

  return yup.object({
    name: yup.string().required("กรุณากรอกชื่อหมวดหมู่"),
    seo_title: yup.string().nullable().default(""),
    seo_description: yup.string().nullable().default(""),
    seo_image: yup
      .string()
      .transform((value, originalValue) => (originalValue === "" || originalValue === null ? undefined : value))
      .url("ลิงก์รูป SEO ต้องเป็น URL ที่ถูกต้อง")
      .nullable()
      .optional(),
    category_id: yup.string().nullable().optional(),
    order: yup
      .number()
      .transform((value, originalValue) => (originalValue === "" || originalValue === null ? null : value))
      .nullable()
      .min(1, "ลำดับต้องเริ่มต้นที่ 1"),
    category_brand_order: yup.number().nullable().optional(),
    image: isCategoryEditMode.value
      ? yup.mixed().nullable().optional()
      : yup.mixed().required("กรุณาเลือกรูปภาพ"),
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

const normalizePositiveOrder = (value: number | string | null | undefined) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 1 ? Math.trunc(numericValue) : undefined;
};

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
    const isDuplicate = await isSubcategoryNameDuplicate(trimmedName, values.category_id, editSubcategoryItem.value.id);
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
      categoryBrandOrder: normalizePositiveOrder(values.category_brand_order),
      ...(values.image ? { file: values.image } : {}),
    });
    appToast.success("อัปเดตแบรนด์สำเร็จ");
    closeSubcategoryDialog();
    return true;
  }

  const isDuplicate = await isSubcategoryNameDuplicate(trimmedName, values.category_id);
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
    errorMessage.value = appToast.resolveErrorMessage(error, "เกิดข้อผิดพลาด กรุณาลองใหม่");
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
    appToast.error(error, errorToastMessage);
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
    "ลบแบรนด์สำเร็จ",
    "ลบแบรนด์ไม่สำเร็จ",
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
    console.error("อัปเดตสถานะหมวดหมู่ไม่สำเร็จ:", error);
    errorMessage.value = appToast.resolveErrorMessage(error, "อัปเดตสถานะหมวดหมู่ไม่สำเร็จ");
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
    console.error("อัปเดตสถานะแบรนด์ไม่สำเร็จ:", error);
    errorMessage.value = appToast.resolveErrorMessage(error, "อัปเดตสถานะแบรนด์ไม่สำเร็จ");
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
      :title="isCategoryEditMode ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'"
    >
    <template #default>
      <v-form >
        <form-vee-text-field variant="outlined" name="name" label="ชื่อหมวดหมู่" />
        <div class="tw:mb-3 tw:text-xs tw:text-neutral-500">
          ระบบจะสร้าง Slug จากชื่อให้อัตโนมัติ และถ้าไม่ได้กรอก SEO ระบบจะใช้ชื่อและรูปภาพหลักแทน
        </div>

        <form-vee-text-field variant="outlined" name="order" label="ลำดับการแสดงผล" type="number" min="1" />
        <form-vee-text-field variant="outlined" name="seo_title" label="ชื่อ SEO" />
        <form-vee-text-area variant="outlined" name="seo_description" label="คำอธิบาย SEO" rows="3" auto-grow />
        <form-vee-text-field variant="outlined" name="seo_image" label="ลิงก์รูป SEO" />
        <form-vee-file-input
          variant="outlined"
          name="image"
          label="รูปภาพ"
          :hint="`${bannerImageHint} แนะนำความละเอียดไม่เกิน 1200 x 1200 px และขนาดไฟล์ไม่เกิน 8 MB`"
          :max-size="8000000"
          :preview-url="isCategoryEditMode ? editCategoryItem?.image_url : undefined"
        />
      </v-form>
    </template>
    <template #actions>
      <div class="tw:flex tw:justify-end tw:gap-2">
        <v-btn color="black" variant="outlined" @click="closeCategoryDialog">ยกเลิก</v-btn>
        <v-btn color="#f5962f" class="text-white" @click="submit()">บันทึก</v-btn>
      </div>
    </template>
    </ModalCategory>

    <ModalCategory
      v-model="subcategoryDialog"
      persistent
      :title="isSubcategoryEditMode ? 'แก้ไขแบรนด์' : 'เพิ่มแบรนด์'"
    >
    <template #default>
      <v-form>
        <div class="tw:mb-3 tw:text-xs tw:text-neutral-500">
          หน้านี้จะบันทึกข้อมูลไปที่ `brands/{brandId}` และ `category_brands/{categoryId__brandId}` เท่านั้น โดยไม่ได้เก็บแบรนด์เป็น subcollection ใต้หมวดหมู่
        </div>
        <form-vee-text-field variant="outlined" name="name" label="ชื่อแบรนด์" />
        <form-vee-text-field variant="outlined" name="seo_title" label="ชื่อ SEO" />
        <form-vee-text-area variant="outlined" name="seo_description" label="คำอธิบาย SEO" rows="3" auto-grow />
        <form-vee-text-field variant="outlined" name="seo_image" label="ลิงก์รูป SEO" />
        <form-vee-select
          variant="outlined"
          name="category_id"
          label="หมวดหมู่"
          item-title="title"
          item-value="value"
          :items="categoryOptions"
        />
        <form-vee-text-field variant="outlined" name="category_brand_order" label="ลำดับในหมวดหมู่" type="number" min="1" />
        <div class="tw:mb-3 tw:text-xs tw:text-neutral-500">
          รายการแบรนด์ในหน้าสินค้าจะอ้างอิงจาก `category_brands` เท่านั้น และเรียงตาม `category_brands.order`
        </div>
        <form-vee-file-input
          variant="outlined"
          name="image"
          label="รูปภาพ"
          :hint="`${bannerImageHint} แนะนำความละเอียดไม่เกิน 1200 x 1200 px และขนาดไฟล์ไม่เกิน 8 MB`"
          :max-size="8000000"
          :preview-url="isSubcategoryEditMode ? editSubcategoryItem?.image_url : undefined"
        />
      </v-form>
    </template>
    <template #actions>
      <div class="tw:flex tw:justify-end tw:gap-2">
        <v-btn color="black" variant="outlined" @click="closeSubcategoryDialog">ยกเลิก</v-btn>
        <v-btn color="#f5962f" class="text-white" @click="submit()">บันทึก</v-btn>
      </div>
    </template>
    </ModalCategory>
    <v-row class="tw:mt-1">
      <v-col cols="12" >
        <v-row>
          <v-col cols="6">
            <div class="tw:text-3xl tw:font-black tw:text-black">หมวดหมู่</div>
          </v-col>
          <v-col cols="6" class="d-flex tw:justify-end">
            <v-btn
            color="#f5962f"
            rounded="pill"
            size="large"
            class="tw:self-start tw:px-7 tw:font-bold tw:normal-case tw:text-white! md:tw:self-auto"
            @click="openCreateCategory()"
          >
            <v-icon start>mdi-plus</v-icon>
            เพิ่มหมวดหมู่
          </v-btn>
        </v-col>
        </v-row>
      </v-col>
      <v-col cols="12">
        <v-text-field
          v-model="categorySearch"
          variant="outlined"
          density="comfortable"
          prepend-inner-icon="mdi-magnify"
          label="ค้นหาหมวดหมู่"
          hide-details
          clearable
          class="tw:mb-4"
        />

        <v-card
          rounded="xl"
          elevation="2"
          class=" tw:overflow-hidden tw:border tw:border-black/5 mt-5"
        >
        
          <v-data-table
            class="elevation-2 tw:shadow-none"
            :headers="headers"
            :items="itemCategory"
            :search="categorySearch"
            :items-per-page="10"
            no-data-text="ไม่พบข้อมูลหมวดหมู่"
            hover
          >
            <template v-slot:item.image_url="{ item }">
              <v-row>
                <v-col v-if="item.image_url"  cols="12" class="d-flex tw:justify-center">
                  <v-img :src="item.image_url" max-height="80px" max-width="80px" width="100%" height="100%" cover />
                </v-col>
                <v-col v-else cols="12" class="d-flex tw:justify-center">
                 <v-icon icon="mdi-image-off" size="48" />
                </v-col>
              </v-row>
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
                <span class="tw:text-sm tw:text-neutral-700">{{ item.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน" }}</span>
              </div>
            </template>

            <template v-slot:item.Action="{ item }">
              <div class="tw:flex tw:justify-center">
                <div class="tw:flex tw:items-center tw:rounded-full tw:border tw:border-slate-200 tw:bg-slate-50 tw:px-1">
                <v-btn icon variant="text" color="black" @click="toggleCategoryEdit(item)">
                  <v-icon size="22">mdi-pencil</v-icon>
                </v-btn>
                <v-btn icon variant="text" color="black" @click="confirmCategoryDelete(item.id)">
                  <v-icon size="22">mdi-delete</v-icon>
                </v-btn>
                </div>
              </div>
            </template>
          </v-data-table>
        </v-card>
      </v-col>

      <v-col cols="12" class="tw:mt-6">
        <v-row>
          <v-col cols="6">
            <div class="tw:text-3xl tw:font-black tw:text-black">แบรนด์</div>
          </v-col>
          <v-col cols="6" class="d-flex tw:justify-end">
          <v-btn
            color="#f5962f"
            rounded="pill"
            size="large"
            class="tw:self-start tw:px-7 tw:font-bold tw:normal-case tw:text-white! md:tw:self-auto"
            @click="openCreateSubcategory()"
          >
            <v-icon start>mdi-plus</v-icon>
            เพิ่มแบรนด์
          </v-btn>
          </v-col>
        </v-row>
      </v-col>
      <v-col cols="12">
        <v-text-field
          v-model="brandSearch"
          variant="outlined"
          density="comfortable"
          prepend-inner-icon="mdi-magnify"
          label="ค้นหาแบรนด์"
          hide-details
          clearable
          class="tw:mb-4"
        />
                <v-card
          rounded="xl"
          elevation="2"
          class="tw:overflow-hidden tw:border tw:border-black/5 mt-5"
        >
          <v-data-table
            class="elevation-0 tw:shadow-none"
            :headers="subcategoryHeaders"
            :items="itemSubCategory"
            :search="brandSearch"
            :items-per-page="10"
            no-data-text="ไม่พบข้อมูลแบรนด์"
            hover
          >
            <template v-slot:item.image_url="{ item }">
              <v-row>
                <v-col v-if="item.image_url"  cols="12" class="d-flex tw:justify-center">
                  <v-img :src="item.image_url" max-height="80px" max-width="80px" width="100%" height="100%" cover />
                </v-col>
                <v-col v-else cols="12" class="d-flex tw:justify-center">
                 <v-icon icon="mdi-image-off" size="48" />
                </v-col>
              </v-row>
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
                <span class="tw:text-sm tw:text-neutral-700">{{ item.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน" }}</span>
              </div>
            </template>

            <template v-slot:item.Action="{ item }">
              <div class="tw:flex tw:justify-center">
                <div class="tw:flex tw:items-center tw:rounded-full tw:border tw:border-slate-200 tw:bg-slate-50 tw:px-1">
                <v-btn icon variant="text" color="black" @click="toggleSubcategoryEdit(item)">
                  <v-icon size="22">mdi-pencil</v-icon>
                </v-btn>
                <v-btn icon variant="text" color="black" @click="confirmSubcategoryDelete(item.id)">
                  <v-icon size="22">mdi-delete</v-icon>
                </v-btn>
                </div>
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
