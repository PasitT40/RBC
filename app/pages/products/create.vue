<script setup lang="ts">
import { useForm } from "vee-validate";
import * as yup from "yup";
import ProductEditorForm from "../../components/products/ProductEditorForm.vue";
import { normalizeProductCondition } from "../../composables/firestore/condition";
import { getPublicProductIssues, normalizeProductSlug } from "../../composables/firestore/publication";

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
  condition: number;
  shutter: number | null;
  defect_detail: string;
  free_gift_detail: string;
  image_files: File[];
  show: boolean;
};

const MAX_DETAIL_IMAGES = 4;

const router = useRouter();
const appToast = useAppToast();
const { getCategories, getBrandsByCategory } = useCategoriesFirestore();
const { createProduct } = useProductsFirestore();

const loading = ref(false);
const taxonomyRefreshing = ref(false);
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
  image_files: yup.array().of(yup.mixed<File>()).when("show", {
    is: true,
    then: (schema) => schema.min(1, "กรุณาใส่รูปสินค้าอย่างน้อย 1 รูปก่อนเปิดแสดงบนเว็บไซต์").required("กรุณาใส่รูปสินค้าอย่างน้อย 1 รูปก่อนเปิดแสดงบนเว็บไซต์"),
    otherwise: (schema) => schema.default([]),
  }),
  show: yup.boolean().default(true),
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
    condition: 4,
    shutter: null,
    defect_detail: "",
    free_gift_detail: "",
    image_files: [],
    show: true,
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

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const slugPreview = computed(() => normalizeProductSlug(values.name ?? ""));
const skuPreview = "ระบบจะสร้างให้อัตโนมัติเมื่อบันทึก";
const derivedCoverImageLabel = computed(() => {
  const firstSlot = detailImageSlots.value.find((item) => item.file);
  return firstSlot?.file?.name || "";
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
    images: normalizeFiles(values.image_files).map((file) => file.name),
    show: values.show,
  })
);

const revokePreview = (url: string) => {
  if (url) URL.revokeObjectURL(url);
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
    appToast.error("เลือกประเภทสินค้าและแบรนด์ให้ครบก่อนบันทึก");
    return;
  }

  loading.value = true;

  try {
    const imageFiles = normalizeFiles(formValues.image_files);

    const created = await createProduct({
      name: formValues.name.trim(),
      slug: slugPreview.value,
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
      image_files: imageFiles,
      status: "ACTIVE",
      show: Boolean(formValues.show),
    });

    appToast.success(`สร้างสินค้าสำเร็จ (${created.sku})`);
    router.push("/products");
  } catch (error) {
    console.error("สร้างสินค้าไม่สำเร็จ", error);
    appToast.error(getErrorMessage(error, "สร้างสินค้าไม่สำเร็จ"));
  } finally {
    loading.value = false;
  }
}, ({ errors: submitErrors }) => {
  const firstError = Object.values(submitErrors)[0];
  appToast.error(typeof firstError === "string" ? firstError : "เช็กข้อมูลที่ยังกรอกไม่ครบอีกนิด");
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
  <product-editor-form
    title="เพิ่มสินค้าใหม่"
    :save-loading="loading"
    :category-options="categoryOptions"
    :brand-options="brandOptions"
    :brand-disabled="!values.category_id"
    :taxonomy-refresh-loading="taxonomyRefreshing"
    :slug-preview="slugPreview"
    :sku-value="skuPreview"
    :seo-fallback-hint="'ถ้ายังไม่ได้กรอก SEO ระบบจะใช้ชื่อสินค้า รายละเอียด และรูปปกให้อัตโนมัติ'"
    :public-readiness-issues="publicReadinessIssues"
    :hidden-info-message="'สินค้านี้จะถูกบันทึกแบบซ่อนไว้ก่อน และค่อยเปิดแสดงบนเว็บไซต์ภายหลังได้'"
    :publish-active="values.show"
    :image-hint="`รูปแรกจะถูกใช้เป็นรูปปกอัตโนมัติ${derivedCoverImageLabel ? ` ตอนนี้รูปปกคือ ${derivedCoverImageLabel}` : ''}`"
    @cancel="goBack"
    @submit="submit()"
    @refresh-taxonomy="refreshTaxonomy"
    @select-images="onDetailSelected"
  >
    <template #top-aside>
      <v-sheet rounded="lg" color="grey-lighten-5" class="pa-4 fill-height">
        <v-row align="center">
          <v-col cols="8">
            <div class="text-body-2 font-weight-medium">แสดงสินค้านี้บนเว็บไซต์</div>
            <div class="text-caption text-medium-emphasis">ถ้ายังเตรียมข้อมูลไม่ครบ สามารถซ่อนไว้ก่อนได้</div>
          </v-col>
          <v-col cols="4" class="d-flex justify-end">
            <form-vee-switch
              name="show"
              color="primary"
              inset
              hide-details
            />
          </v-col>
          <v-col cols="12">
            <div class="text-caption text-medium-emphasis">SKU: {{ skuPreview }}</div>
            <div class="text-caption text-medium-emphasis">ลิงก์สินค้าที่ระบบจะสร้างให้: {{ slugPreview || "-" }}</div>
            <div class="text-caption text-medium-emphasis">ถ้ายังไม่กรอก SEO ระบบจะใช้ชื่อสินค้า รายละเอียด และรูปปกให้อัตโนมัติ</div>
          </v-col>
        </v-row>
      </v-sheet>
    </template>
  </product-editor-form>
</template>
