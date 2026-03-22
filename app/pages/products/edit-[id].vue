<script setup lang="ts">
import { useForm } from "vee-validate";
import * as yup from "yup";
import type { ProductRecord } from "../../composables/firestore/types";

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
  condition: string;
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
const categories = ref<Record<string, any>[]>([]);
const brandMappings = ref<Record<string, any>[]>([]);
const product = ref<ProductRecord | null>(null);
const imageEntries = ref<ImageEntry[]>([]);
const isHydrating = ref(false);

const routeId = computed(() => String(route.params.id ?? ""));

const schema = yup.object({
  name: yup.string().trim().required("กรุณากรอกชื่อสินค้า"),
  seo_title: yup.string().nullable().default(""),
  seo_description: yup.string().nullable().default(""),
  seo_image: yup
    .string()
    .transform((value, originalValue) => (originalValue === "" || originalValue === null ? undefined : value))
    .url("กรุณากรอก URL รูป SEO ให้ถูกต้อง")
    .nullable()
    .optional(),
  category_id: yup.string().required("กรุณาเลือกประเภทสินค้า"),
  brand_id: yup.string().required("กรุณาเลือกแบรนด์"),
  cost_price: yup
    .number()
    .typeError("กรุณากรอกราคาทุน")
    .min(0, "ราคาทุนต้องมากกว่าหรือเท่ากับ 0")
    .required("กรุณากรอกราคาทุน"),
  sell_price: yup
    .number()
    .typeError("กรุณากรอกราคาขาย")
    .min(0, "ราคาขายต้องมากกว่าหรือเท่ากับ 0")
    .required("กรุณากรอกราคาขาย"),
  condition: yup.string().nullable().default("GOOD"),
  shutter: yup
    .number()
    .transform((value, originalValue) => (originalValue === "" || originalValue === null ? null : value))
    .nullable()
    .min(0, "Shutter ต้องมากกว่าหรือเท่ากับ 0"),
  defect_detail: yup.string().nullable(),
  free_gift_detail: yup.string().nullable(),
  image_files: yup.array().of(yup.mixed<File>()).nullable(),
});

const { handleSubmit, setFieldValue, values, resetForm } = useForm<ProductEditFormValues>({
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
    condition: "GOOD",
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

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

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

    resetForm({
      values: {
        name: foundProduct.name ?? "",
        seo_title: foundProduct.seo_title ?? "",
        seo_description: foundProduct.seo_description ?? "",
        seo_image: foundProduct.seo_image ?? "",
        category_id: foundProduct.category_id ?? "",
        brand_id: foundProduct.brand_id ?? "",
        cost_price: typeof foundProduct.cost_price === "number" ? foundProduct.cost_price : undefined,
        sell_price: typeof foundProduct.sell_price === "number" ? foundProduct.sell_price : undefined,
        condition: foundProduct.condition ?? "GOOD",
        shutter: typeof foundProduct.shutter === "number" ? foundProduct.shutter : null,
        defect_detail: foundProduct.defect_detail ?? "",
        free_gift_detail: foundProduct.free_gift_detail ?? "",
        image_files: [],
      },
    });
    applyExistingImages(Array.isArray(foundProduct.images) ? foundProduct.images : []);
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
    appToast.error("กรุณาเลือกประเภทสินค้าและแบรนด์ให้ครบ");
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
    const nextSlug = toSlug(formValues.name);

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
      condition: formValues.condition?.trim() || "GOOD",
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
    appToast.error("อัปเดตสินค้าไม่สำเร็จ");
  } finally {
    loading.value = false;
  }
}, ({ errors }) => {
  const firstError = Object.values(errors)[0];
  appToast.error(typeof firstError === "string" ? firstError : "กรุณากรอกข้อมูลให้ครบ");
});

onMounted(hydrateForm);

onBeforeUnmount(() => {
  resetForm();
});
</script>

<template>
  <v-row class="pa-5">
    <v-col cols="12" class="tw:mb-8 tw:flex tw:flex-col tw:gap-4 md:tw:flex-row md:tw:items-center md:tw:justify-between">
      <div>
        <h1 class="tw:text-3xl tw:font-black tw:text-black md:tw:text-4xl">Edit Product</h1>
      </div>

      <div class="tw:flex tw:items-center tw:justify-end tw:gap-3">
        <v-btn
          variant="outlined"
          color="black"
          rounded="pill"
          class="tw:px-6 tw:font-semibold tw:normal-case"
          @click="goBack"
        >
          Cancel
        </v-btn>
        <v-btn
          color="#f5962f"
          rounded="pill"
          class="tw:px-7 tw:font-semibold tw:normal-case tw:text-white"
          :loading="loading"
          :disabled="pageLoading"
          @click="submit()"
        >
          Save
        </v-btn>
      </div>
    </v-col>

    <v-col cols="12">
      <div v-if="pageLoading" class="tw:flex tw:justify-center tw:py-16">
        <v-progress-circular indeterminate color="#f5962f" />
      </div>

      <template v-else>
        <div class="tw:grid tw:grid-cols-1 tw:gap-x-6 tw:gap-y-4 md:tw:grid-cols-2">
          <form-vee-text-field
            name="name"
            label="ชื่อสินค้า"
            variant="outlined"
            density="comfortable"
            hide-details="auto"
          />

          <form-vee-text-field
            name="seo_title"
            label="SEO Title"
            variant="outlined"
            density="comfortable"
            hide-details="auto"
          />

          <form-vee-select
            name="category_id"
            label="ประเภทสินค้า"
            variant="outlined"
            density="comfortable"
            item-title="title"
            item-value="value"
            :items="categoryOptions"
            hide-details="auto"
          />

          <form-vee-select
            name="brand_id"
            label="Brand"
            variant="outlined"
            density="comfortable"
            item-title="title"
            item-value="value"
            :items="brandOptions"
            :disabled="!values.category_id"
            hide-details="auto"
          />

          <form-vee-text-field
            name="condition"
            label="คุณภาพของสินค้า"
            variant="outlined"
            density="comfortable"
            hide-details="auto"
          />

          <form-vee-text-field
            name="cost_price"
            label="ราคา - ทุน"
            variant="outlined"
            density="comfortable"
            type="number"
            min="0"
            hide-details="auto"
          />

          <form-vee-text-field
            name="sell_price"
            label="ราคา - ขาย"
            variant="outlined"
            density="comfortable"
            type="number"
            min="0"
            hide-details="auto"
          />

          <form-vee-text-field
            name="shutter"
            label="Shutter"
            variant="outlined"
            density="comfortable"
            type="number"
            min="0"
            hide-details="auto"
          />
        </div>

        <div class="tw:mt-6 tw:grid tw:grid-cols-1 tw:gap-6">
          <form-vee-text-area
            name="seo_description"
            label="SEO Description"
            variant="outlined"
            rows="3"
            auto-grow
            hide-details="auto"
          />

          <form-vee-text-field
            name="seo_image"
            label="SEO Image URL"
            variant="outlined"
            density="comfortable"
            hide-details="auto"
          />

          <form-vee-text-area
            name="defect_detail"
            label="รายละเอียดตำหนิ"
            variant="outlined"
            rows="5"
            auto-grow
            hide-details="auto"
          />

          <form-vee-text-area
            name="free_gift_detail"
            label="ของแถม"
            variant="outlined"
            rows="5"
            auto-grow
            hide-details="auto"
          />

          <div>
            <div class="tw:mb-3 tw:text-sm tw:font-semibold tw:text-neutral-800">รูปสินค้า (รายละเอียด)</div>
            <form-vee-file-input
              name="image_files"
              label="เลือกรูปรายละเอียดสินค้า"
              variant="outlined"
              accept="image/*"
              multiple
              :max-files="4"
              :preview-urls="existingPreviewUrls"
              sortable
              removable
              @update:model-value="onDetailSelected"
              @reorder-previews="reorderExistingImages"
              @remove-preview="removeDetailImage"
            />
          </div>
        </div>
      </template>
    </v-col>
  </v-row>
</template>
