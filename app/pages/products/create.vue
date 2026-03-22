<script setup lang="ts">
import { useForm } from "vee-validate";
import * as yup from "yup";

type SelectOption = {
  title: string;
  value: string;
};

type DetailImageSlot = {
  file: File | null;
  preview: string;
};

type ProductCreateFormValues = {
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

const MAX_DETAIL_IMAGES = 4;

const router = useRouter();
const appToast = useAppToast();
const { getCategories, getBrandsByCategory } = useCategoriesFirestore();
const { createProduct } = useProductsFirestore();

const loading = ref(false);
const categories = ref<Record<string, any>[]>([]);
const brandMappings = ref<Record<string, any>[]>([]);
const detailImageSlots = ref<DetailImageSlot[]>(Array.from({ length: MAX_DETAIL_IMAGES }, () => ({ file: null, preview: "" })));

const isFile = (value: unknown): value is File => value instanceof File;

const normalizeFiles = (files: unknown): File[] =>
  Array.isArray(files) ? files.filter(isFile) : [];

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
  image_files: yup.array().of(yup.mixed<File>()).min(1, "กรุณาอัปโหลดรูปสินค้าอย่างน้อย 1 รูป").required("กรุณาอัปโหลดรูปสินค้า"),
});

const { errors, handleSubmit, setFieldValue, values, resetForm } = useForm<ProductCreateFormValues>({
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

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const revokePreview = (url: string) => {
  if (url) URL.revokeObjectURL(url);
};

const loadCategories = async () => {
  categories.value = await getCategories({ isActive: true });
};

const loadBrands = async (categoryId: string) => {
  brandMappings.value = categoryId ? await getBrandsByCategory(categoryId) : [];
};

const normalizeNullableNumber = (value: number | null | undefined | "") =>
  value === null || value === undefined || value === "" ? null : Number(value);

watch(
  () => values.category_id,
  async (categoryId, previousCategoryId) => {
    if (!categoryId) {
      brandMappings.value = [];
      setFieldValue("brand_id", "");
      return;
    }

    await loadBrands(categoryId);

    if (categoryId !== previousCategoryId) {
      const hasSelectedBrand = brandMappings.value.some((item) => item.brand_id === values.brand_id);
      if (!hasSelectedBrand) {
        setFieldValue("brand_id", "");
      }
    }
  }
);


const syncDetailFiles = (files: File[]) => {
  detailImageSlots.value.forEach((item) => revokePreview(item.preview));
  detailImageSlots.value = Array.from({ length: MAX_DETAIL_IMAGES }, (_, index) => {
    const file = files[index] ?? null;
    return {
      file,
      preview: file ? URL.createObjectURL(file) : "",
    };
  });
  setFieldValue("image_files", files);
};

const onDetailSelected = (files: File | File[] | null) => {
  const nextFiles = Array.isArray(files) ? files.slice(0, MAX_DETAIL_IMAGES) : files ? [files] : [];
  syncDetailFiles(nextFiles);
};

watch(
  () => values.image_files,
  (files) => {
    const normalizedFiles = normalizeFiles(files);
    const currentFiles = detailImageSlots.value.map((item) => item.file).filter((file): file is File => Boolean(file));

    if (
      normalizedFiles.length === currentFiles.length &&
      normalizedFiles.every((file, index) => file === currentFiles[index])
    ) {
      return;
    }

    syncDetailFiles(normalizedFiles.slice(0, MAX_DETAIL_IMAGES));
  }
);

const goBack = () => {
  router.push("/products");
};

const submit = handleSubmit(async (formValues) => {
  const selectedCategory = categories.value.find((item) => item.id === formValues.category_id);
  const selectedBrand = brandMappings.value.find((item) => item.brand_id === formValues.brand_id);

  if (!selectedCategory || !selectedBrand) {
    appToast.error("กรุณาเลือกประเภทสินค้าและแบรนด์ให้ครบ");
    return;
  }

  loading.value = true;

  try {
    const imageFiles = normalizeFiles(formValues.image_files);

    await createProduct({
      name: formValues.name.trim(),
      slug: toSlug(formValues.name),
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
      image_files: imageFiles,
      status: "ACTIVE",
      show: true,
    });

    appToast.success("สร้างสินค้าสำเร็จ");
    router.push("/products");
  } catch (error) {
    console.error("สร้างสินค้าไม่สำเร็จ", error);
    appToast.error("สร้างสินค้าไม่สำเร็จ");
  } finally {
    loading.value = false;
  }
}, ({ errors: submitErrors }) => {
  const firstError = Object.values(submitErrors)[0];
  appToast.error(typeof firstError === "string" ? firstError : "กรุณากรอกข้อมูลให้ครบ");
});

onMounted(async () => {
  await loadCategories();
});

onBeforeUnmount(() => {
  detailImageSlots.value.forEach((item) => revokePreview(item.preview));
  resetForm();
});
</script>

<template>
  <v-row class="pa-5">
    <v-col cols="12" class="tw:mb-8 tw:flex tw:flex-col tw:gap-4 md:tw:flex-row md:tw:items-center md:tw:justify-between">
      <div>
        <h1 class="tw:text-3xl tw:font-black tw:text-black md:tw:text-4xl">Create Product</h1>
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
          @click="submit()"
        >
          Save
        </v-btn>
      </div>
    </v-col>
    <v-col cols="12">
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
            sortable
            removable
            @update:model-value="onDetailSelected"
          />
        </div>
      </div>
    </v-col>

  </v-row>
</template>
