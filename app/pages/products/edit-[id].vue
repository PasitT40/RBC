<script setup lang="ts">
import { useForm } from "vee-validate";
import * as yup from "yup";
import ProductEditorForm from "../../components/products/ProductEditorForm.vue";
import { normalizeProductCondition } from "../../composables/firestore/condition";
import type { ProductRecord } from "../../composables/firestore/types";
import { getProductStatus, isSoftDeletedProduct } from "../../composables/firestore/products";
import { getPublicProductIssues, normalizeProductSlug } from "../../composables/firestore/publication";

type SelectOption = {
  title: string;
  value: string;
};

type ProductEditFormValues = {
  name: string;
  seo_title: string;
  seo_description: string;
  seo_image: string;
  category_id: string;
  brand_id: string;
  cost_price: number | undefined;
  sell_price: number | undefined;
  condition: number;
  shutter: number | null;
  defect_detail: string;
  free_gift_detail: string;
  image_files: File[];
};

type ImageEntry =
  | { kind: "existing"; url: string }
  | { kind: "file"; file: File };

const MAX_DETAIL_IMAGES = 4;

const route = useRoute();
const router = useRouter();
const appToast = useAppToast();
const { getCategories, getBrandsByCategory } = useCategoriesFirestore();
const { getProductById, updateProduct } = useProductsFirestore();

const loading = ref(false);
const pageLoading = ref(true);
const taxonomyRefreshing = ref(false);
const categories = ref<Record<string, any>[]>([]);
const brandMappings = ref<Record<string, any>[]>([]);
const product = ref<ProductRecord | null>(null);
const imageEntries = ref<ImageEntry[]>([]);
const isHydrating = ref(false);
const derivedCoverImageUrl = ref("");

const routeId = computed(() => String(route.params.id ?? ""));

const statusMetaMap = {
  ACTIVE: { label: "พร้อมขาย", color: "success" },
  RESERVED: { label: "จองแล้ว", color: "warning" },
  SOLD: { label: "ขายแล้ว", color: "error" },
  DELETED: { label: "ลบแล้ว", color: "default" },
} as const;

const schema = yup.object({
  name: yup.string().trim().required("กรุณากรอกชื่อสินค้า"),
  seo_title: yup.string().nullable().default(""),
  seo_description: yup.string().nullable().default(""),
  seo_image: yup
    .string()
    .transform((value, originalValue) => (originalValue === "" || originalValue === null ? undefined : value))
    .url("ลิงก์รูป SEO ยังไม่ถูกต้อง")
    .nullable()
    .optional(),
  category_id: yup.string().required("กรุณาเลือกประเภทสินค้า"),
  brand_id: yup.string().required("กรุณาเลือกแบรนด์"),
  cost_price: yup
    .number()
    .typeError("กรุณากรอกราคาทุน")
    .min(0, "ราคาทุนต้องเป็น 0 หรือมากกว่า")
    .required("กรุณากรอกราคาทุน"),
  sell_price: yup
    .number()
    .typeError("กรุณากรอกราคาขาย")
    .min(0, "ราคาขายต้องเป็น 0 หรือมากกว่า")
    .required("กรุณากรอกราคาขาย"),
  condition: yup
    .number()
    .typeError("กรุณาระบุคุณภาพสินค้า")
    .min(0, "คุณภาพสินค้าต้องอยู่ระหว่าง 0 ถึง 5")
    .max(5, "คุณภาพสินค้าต้องอยู่ระหว่าง 0 ถึง 5")
    .test("step", "คุณภาพสินค้าต้องเพิ่มทีละ 0.5", (value) =>
      typeof value === "number" ? Number.isInteger(value * 2) : false)
    .required("กรุณาระบุคุณภาพสินค้า"),
  shutter: yup
    .number()
    .transform((value, originalValue) => (originalValue === "" || originalValue === null ? null : value))
    .typeError("กรุณากรอกจำนวนชัตเตอร์")
    .nullable()
    .min(0, "จำนวนชัตเตอร์ต้องเป็น 0 หรือมากกว่า")
    .required("กรุณากรอกจำนวนชัตเตอร์"),
  defect_detail: yup.string().trim().required("กรุณากรอกรายละเอียดตำหนิ"),
  free_gift_detail: yup.string().trim().required("กรุณากรอกรายละเอียดของแถม"),
  image_files: yup.array().of(yup.mixed<File>()).nullable(),
});

const { handleSubmit, setFieldValue, setValues, values, resetForm } = useForm<ProductEditFormValues>({
  validationSchema: schema,
  initialValues: {
    name: "",
    seo_title: "",
    seo_description: "",
    seo_image: "",
    category_id: "",
    brand_id: "",
    cost_price: undefined,
    sell_price: undefined,
    condition: 4,
    shutter: null,
    defect_detail: "",
    free_gift_detail: "",
    image_files: [],
  },
});

const categoryOptions = computed<SelectOption[]>(() =>
  categories.value
    .filter((item) => item.is_active !== false)
    .map((item) => ({
      title: item.name,
      value: item.id,
    }))
);

const brandOptions = computed<SelectOption[]>(() =>
  brandMappings.value.map((item) => ({
    title: item.brand_name,
    value: item.brand_id,
  }))
);

const existingPreviewUrls = computed(() =>
  imageEntries.value
    .filter((entry): entry is Extract<ImageEntry, { kind: "existing" }> => entry.kind === "existing")
    .map((entry) => entry.url)
);

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const slugPreview = computed(() => normalizeProductSlug(values.name ?? ""));

const derivedCoverImageLabel = computed(() => {
  const firstEntry = imageEntries.value[0];
  if (!firstEntry) return "";
  return firstEntry.kind === "existing" ? firstEntry.url : firstEntry.file.name;
});

const formatDateTime = (value: unknown) => {
  const date =
    typeof (value as { toDate?: () => Date })?.toDate === "function"
      ? (value as { toDate: () => Date }).toDate()
      : value
        ? new Date(value as string | number | Date)
        : null;

  if (!date || Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatCurrency = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("th-TH").format(value);
};

const displayStatus = computed<keyof typeof statusMetaMap>(() =>
  product.value && isSoftDeletedProduct(product.value) ? "DELETED" : getProductStatus(product.value)
);

const statusMeta = computed(() => statusMetaMap[displayStatus.value]);

const currentCoverImageUrl = computed(() => {
  if (derivedCoverImageUrl.value) return derivedCoverImageUrl.value;
  if (typeof product.value?.cover_image === "string" && product.value.cover_image.trim()) {
    return product.value.cover_image.trim();
  }
  return "";
});

const currentImageCount = computed(() => {
  const imageCount = Array.isArray(product.value?.images) ? product.value?.images.length : 0;
  if (imageEntries.value.length) return imageEntries.value.length;
  return imageCount;
});

const publicReadinessIssues = computed(() =>
  getPublicProductIssues({
    name: values.name,
    slug: slugPreview.value,
    category_id: values.category_id,
    brand_id: values.brand_id,
    cost_price: typeof values.cost_price === "number" ? values.cost_price : Number.NaN,
    sell_price: typeof values.sell_price === "number" ? values.sell_price : Number.NaN,
    condition: values.condition,
    shutter: typeof values.shutter === "number" ? values.shutter : Number.NaN,
    defect_detail: values.defect_detail,
    free_gift_detail: values.free_gift_detail,
    images: imageEntries.value.map((entry) => (entry.kind === "existing" ? entry.url : entry.file.name)),
    show: Boolean(product.value?.show),
  })
);

const syncImageFilesField = () => {
  setFieldValue(
    "image_files",
    imageEntries.value
      .filter((entry): entry is Extract<ImageEntry, { kind: "file" }> => entry.kind === "file")
      .map((entry) => entry.file)
  );
};

const loadCategories = async () => {
  categories.value = await getCategories({ isActive: true });
};

const loadBrands = async (categoryId: string) => {
  brandMappings.value = categoryId ? await getBrandsByCategory(categoryId) : [];
};

const refreshTaxonomy = async () => {
  taxonomyRefreshing.value = true;
  try {
    await loadCategories();
    if (values.category_id) {
      await loadBrands(values.category_id);
      const hasSelectedBrand = brandMappings.value.some((item) => item.brand_id === values.brand_id);
      if (!hasSelectedBrand) setFieldValue("brand_id", "");
    } else {
      brandMappings.value = [];
    }
    appToast.success("รีเฟรชหมวดหมู่และแบรนด์สำเร็จ");
  } catch (error) {
    console.error("รีเฟรชหมวดหมู่และแบรนด์ไม่สำเร็จ", error);
    appToast.error("รีเฟรชหมวดหมู่และแบรนด์ไม่สำเร็จ");
  } finally {
    taxonomyRefreshing.value = false;
  }
};

const normalizeNullableNumber = (value: number | null | undefined | "") =>
  value === null || value === undefined || value === "" ? null : Number(value);

const applyExistingImages = (images: string[]) => {
  imageEntries.value = images.slice(0, MAX_DETAIL_IMAGES).map((url) => ({ kind: "existing", url }));
  syncImageFilesField();
};

const onDetailSelected = (files: File | File[] | null) => {
  const nextFiles = (Array.isArray(files) ? files : files ? [files] : []).slice(0, MAX_DETAIL_IMAGES);
  imageEntries.value = nextFiles.map((file) => ({
    kind: "file",
    file,
  }));
  syncImageFilesField();
};

const reorderExistingImages = (urls: string[]) => {
  imageEntries.value = urls.slice(0, MAX_DETAIL_IMAGES).map((url) => ({ kind: "existing", url }));
  syncImageFilesField();
};

const removeDetailImage = (index: number) => {
  imageEntries.value = imageEntries.value.filter((_, itemIndex) => itemIndex !== index);
  syncImageFilesField();
};

const revokeDerivedCoverImageUrl = () => {
  if (derivedCoverImageUrl.value.startsWith("blob:")) {
    URL.revokeObjectURL(derivedCoverImageUrl.value);
  }
  derivedCoverImageUrl.value = "";
};

const goBack = () => {
  router.push("/products");
};

watch(
  () => values.category_id,
  async (categoryId, previousCategoryId) => {
    if (!categoryId) {
      brandMappings.value = [];
      if (!isHydrating.value) setFieldValue("brand_id", "");
      return;
    }

    await loadBrands(categoryId);

    if (isHydrating.value) return;
    if (categoryId !== previousCategoryId) {
      const hasSelectedBrand = brandMappings.value.some((item) => item.brand_id === values.brand_id);
      if (!hasSelectedBrand) setFieldValue("brand_id", "");
    }
  }
);

watch(
  imageEntries,
  (entries) => {
    revokeDerivedCoverImageUrl();
    const firstEntry = entries[0];
    if (!firstEntry) return;
    derivedCoverImageUrl.value = firstEntry.kind === "existing" ? firstEntry.url : URL.createObjectURL(firstEntry.file);
  },
  { deep: true, immediate: true }
);

const hydrateForm = async () => {
  pageLoading.value = true;

  try {
    await loadCategories();

    const foundProduct = await getProductById(routeId.value);
    if (!foundProduct) {
      appToast.error("ไม่พบสินค้า");
      router.replace("/products");
      return;
    }

    product.value = foundProduct;
    isHydrating.value = true;
    await loadBrands(foundProduct.category_id);

    const nextFormValues = {
      name: foundProduct.name ?? "",
      seo_title: foundProduct.seo_title ?? "",
      seo_description: foundProduct.seo_description ?? "",
      seo_image: foundProduct.seo_image ?? "",
      category_id: foundProduct.category_id ?? "",
      brand_id: foundProduct.brand_id ?? "",
      cost_price: typeof foundProduct.cost_price === "number" ? foundProduct.cost_price : undefined,
      sell_price: typeof foundProduct.sell_price === "number" ? foundProduct.sell_price : undefined,
      condition: normalizeProductCondition(foundProduct.condition),
      shutter: typeof foundProduct.shutter === "number" ? foundProduct.shutter : null,
      defect_detail: foundProduct.defect_detail ?? "",
      free_gift_detail: foundProduct.free_gift_detail ?? "",
      image_files: [],
    } satisfies ProductEditFormValues;

    resetForm({ values: nextFormValues });
    applyExistingImages(Array.isArray(foundProduct.images) ? foundProduct.images : []);

    // ProductEditorForm mounts its Vee fields after the loading gate flips off.
    // Re-apply current values on the next tick so registered fields receive them.
    await nextTick();
    setValues(nextFormValues, false);
  } catch (error) {
    console.error("โหลดข้อมูลสินค้าไม่สำเร็จ", error);
    appToast.error("โหลดข้อมูลสินค้าไม่สำเร็จ");
  } finally {
    isHydrating.value = false;
    pageLoading.value = false;
  }
};

const submit = handleSubmit(async (formValues) => {
  if (!product.value?.id) {
    appToast.error("ไม่พบสินค้า");
    return;
  }

  const selectedCategory = categories.value.find((item) => item.id === formValues.category_id);
  const selectedBrand = brandMappings.value.find((item) => item.brand_id === formValues.brand_id);

  if (!selectedCategory || !selectedBrand) {
    appToast.error("เลือกประเภทสินค้าและแบรนด์ให้ครบก่อนบันทึก");
    return;
  }

  loading.value = true;

  try {
    const existingImages = imageEntries.value
      .filter((entry): entry is Extract<ImageEntry, { kind: "existing" }> => entry.kind === "existing")
      .map((entry) => entry.url);
    const imageFiles = imageEntries.value
      .filter((entry): entry is Extract<ImageEntry, { kind: "file" }> => entry.kind === "file")
      .map((entry) => entry.file);
    const nextSlug = slugPreview.value;

    await updateProduct({
      id: product.value.id,
      name: formValues.name.trim(),
      slug: nextSlug,
      category_id: selectedCategory.id,
      category_name: selectedCategory.name ?? "",
      brand_id: selectedBrand.brand_id,
      brand_name: selectedBrand.brand_name ?? "",
      seo_title: formValues.seo_title?.trim() || undefined,
      seo_description: formValues.seo_description?.trim() || undefined,
      seo_image: formValues.seo_image?.trim() || undefined,
      cost_price: Number(formValues.cost_price),
      sell_price: Number(formValues.sell_price),
      condition: normalizeProductCondition(formValues.condition),
      shutter: normalizeNullableNumber(formValues.shutter),
      defect_detail: formValues.defect_detail?.trim() ?? "",
      free_gift_detail: formValues.free_gift_detail?.trim() ?? "",
      images: existingImages,
      image_files: imageFiles,
    });

    appToast.success("อัปเดตสินค้าสำเร็จ");
    router.push("/products");
  } catch (error) {
    console.error("อัปเดตสินค้าไม่สำเร็จ", error);
    appToast.error(getErrorMessage(error, "อัปเดตสินค้าไม่สำเร็จ"));
  } finally {
    loading.value = false;
  }
}, ({ errors }) => {
  const firstError = Object.values(errors)[0];
  appToast.error(typeof firstError === "string" ? firstError : "เช็กข้อมูลที่ยังกรอกไม่ครบอีกนิด");
});

onMounted(hydrateForm);

onBeforeUnmount(() => {
  revokeDerivedCoverImageUrl();
  resetForm();
});
</script>

<template>
  <product-editor-form
    title="แก้ไขข้อมูลสินค้า"
    :save-loading="loading"
    :save-disabled="pageLoading"
    :page-loading="pageLoading"
    :category-options="categoryOptions"
    :brand-options="brandOptions"
    :brand-disabled="!values.category_id"
    :taxonomy-refresh-loading="taxonomyRefreshing"
    :slug-preview="slugPreview"
    :sku-value="product?.sku || '-'"
    :seo-fallback-hint="'ถ้ายังไม่ได้กรอก SEO ระบบจะใช้ชื่อสินค้า รายละเอียด และรูปปกให้อัตโนมัติ'"
    :public-readiness-issues="publicReadinessIssues"
    :hidden-info-message="'สินค้านี้ยังถูกซ่อนไว้จากเว็บไซต์อยู่ จึงยังไม่จำเป็นต้องกรอกข้อมูลให้พร้อมแสดงครบทุกจุด'"
    :publish-active="product?.show ?? null"
    :image-hint="`รูปแรกในลำดับจะถูกใช้เป็นรูปปกอัตโนมัติ${derivedCoverImageLabel ? ` ตอนนี้รูปปกคือ ${derivedCoverImageLabel}` : ''}`"
    :cover-preview-url="derivedCoverImageUrl"
    cover-preview-alt="cover-image-preview"
    :preview-urls="existingPreviewUrls"
    @cancel="goBack"
    @submit="submit()"
    @refresh-taxonomy="refreshTaxonomy"
    @select-images="onDetailSelected"
    @reorder-previews="reorderExistingImages"
    @remove-preview="removeDetailImage"
  >
    <template #summary>
      <v-card rounded="xl" elevation="1" class="mb-6">
        <v-card-item>
          <v-row align="center">
            <v-col cols="8">
              <v-card-title>ข้อมูลที่บันทึกอยู่ตอนนี้</v-card-title>
              <v-card-subtitle>ดูภาพรวมก่อน แล้วค่อยแก้ข้อมูลด้านล่างได้เลย</v-card-subtitle>
            </v-col>
            <v-col cols="4" class="d-flex justify-end">
              <v-chip
                :color="statusMeta.color"
                variant="tonal"
                rounded="pill"
              >
                {{ statusMeta.label }}
              </v-chip>
            </v-col>
          </v-row>
        </v-card-item>
        <v-card-text>
          <v-row>
            <v-col cols="8">
              <v-row>
                <v-col cols="6">
                  <v-sheet rounded="lg" color="grey-lighten-4" class="pa-4">
                    <div class="text-caption text-medium-emphasis">SKU</div>
                    <div class="text-body-2 font-weight-medium">{{ product?.sku || "-" }}</div>
                  </v-sheet>
                </v-col>
                <v-col cols="6">
                  <v-sheet rounded="lg" color="grey-lighten-4" class="pa-4">
                    <div class="text-caption text-medium-emphasis">หมวดหมู่ / แบรนด์</div>
                    <div class="text-body-2 font-weight-medium">{{ product?.category_name || "-" }} / {{ product?.brand_name || "-" }}</div>
                  </v-sheet>
                </v-col>
                <v-col cols="6">
                  <v-sheet rounded="lg" color="grey-lighten-4" class="pa-4">
                    <div class="text-caption text-medium-emphasis">การแสดงผลบนเว็บไซต์</div>
                    <div class="text-body-2 font-weight-medium">{{ product?.show ? "เปิดอยู่" : "ซ่อนอยู่" }}</div>
                  </v-sheet>
                </v-col>
                <v-col cols="6">
                  <v-sheet rounded="lg" color="grey-lighten-4" class="pa-4">
                    <div class="text-caption text-medium-emphasis">ราคาทุน / ราคาขาย</div>
                    <div class="text-body-2 font-weight-medium">{{ formatCurrency(product?.cost_price) }} / {{ formatCurrency(product?.sell_price) }} บาท</div>
                  </v-sheet>
                </v-col>
                <v-col cols="6">
                  <v-sheet rounded="lg" color="grey-lighten-4" class="pa-4">
                    <div class="text-caption text-medium-emphasis">จำนวนรูป</div>
                    <div class="text-body-2 font-weight-medium">{{ currentImageCount }} รูป</div>
                  </v-sheet>
                </v-col>
                <v-col cols="6">
                  <v-sheet rounded="lg" color="grey-lighten-4" class="pa-4">
                    <div class="text-caption text-medium-emphasis">สร้างเมื่อ</div>
                    <div class="text-body-2 font-weight-medium">{{ formatDateTime(product?.created_at) }}</div>
                  </v-sheet>
                </v-col>
                <v-col cols="6">
                  <v-sheet rounded="lg" color="grey-lighten-4" class="pa-4">
                    <div class="text-caption text-medium-emphasis">อัปเดตล่าสุด</div>
                    <div class="text-body-2 font-weight-medium">{{ formatDateTime(product?.updated_at) }}</div>
                  </v-sheet>
                </v-col>
                <v-col cols="6">
                  <v-sheet rounded="lg" color="grey-lighten-4" class="pa-4">
                    <div class="text-caption text-medium-emphasis">วันที่ขาย</div>
                    <div class="text-body-2 font-weight-medium">{{ formatDateTime(product?.sold_at) }}</div>
                  </v-sheet>
                </v-col>
                <v-col cols="6">
                  <v-sheet rounded="lg" color="grey-lighten-4" class="pa-4">
                    <div class="text-caption text-medium-emphasis">ช่องทาง / ราคาที่ขายได้</div>
                    <div class="text-body-2 font-weight-medium">{{ product?.sold_channel || "-" }} / {{ formatCurrency(product?.sold_price) }} บาท</div>
                  </v-sheet>
                </v-col>
              </v-row>
            </v-col>

            <v-col cols="4">
              <v-sheet rounded="lg" color="grey-lighten-4" class="pa-4 fill-height">
                <div class="text-body-2 font-weight-medium mb-2">รูปปกตอนนี้</div>
                <v-sheet
                  v-if="currentCoverImageUrl"
                  rounded="lg"
                  color="white"
                  border
                  class="overflow-hidden mb-3"
                >
                  <v-img :src="currentCoverImageUrl" alt="product-cover-preview" height="208" cover />
                </v-sheet>
                <v-sheet
                  v-else
                  rounded="lg"
                  color="white"
                  border
                  height="208"
                  class="d-flex align-center justify-center text-body-2 text-medium-emphasis mb-3"
                >
                  ยังไม่มีรูปปกในตอนนี้
                </v-sheet>
                <div class="text-caption text-medium-emphasis">SKU: {{ product?.sku || "-" }}</div>
                <div class="text-caption text-medium-emphasis">ลิงก์สินค้าที่ระบบจะสร้างให้: {{ slugPreview || "-" }}</div>
                <div class="text-caption text-medium-emphasis">หากต้องการเปลี่ยนการแสดงผลบนเว็บไซต์ ให้ไปที่หน้ารายการสินค้า</div>
              </v-sheet>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </template>

    <template #warning-message>
      สินค้านี้กำลังแสดงอยู่บนเว็บไซต์ แต่ข้อมูลยังไม่ครบ: {{ publicReadinessIssues.join(", ") }}
    </template>
  </product-editor-form>
</template>
