<script setup lang="ts">
type EditableBanner = {
  id: string;
  image_url: string;
  active: boolean;
  order: number;
  file: File | null;
  preview_url: string;
};

type EditableCredit = {
  id: string;
  image_url: string;
  order: number;
  file: File | null;
  preview_url: string;
};

const { getSiteSettings, updateSiteSettings } = useBackofficeFirestore();
const appToast = useAppToast();

const loading = ref(false);
const saving = ref(false);
const bannerAutoSlideSec = ref(5);
const banners = ref<EditableBanner[]>([]);
const credits = ref<EditableCredit[]>([]);

const createBannerItem = (index: number): EditableBanner => ({
  id: `banner-${index + 1}`,
  image_url: "",
  active: true,
  order: index + 1,
  file: null,
  preview_url: "",
});

const createCreditItem = (index: number): EditableCredit => ({
  id: `credit-${index + 1}`,
  image_url: "",
  order: index + 1,
  file: null,
  preview_url: "",
});

const revokePreviewUrl = (url?: string) => {
  if (!url?.startsWith("blob:")) return;
  URL.revokeObjectURL(url);
};

const resetItems = () => {
  banners.value.forEach((item) => revokePreviewUrl(item.preview_url));
  credits.value.forEach((item) => revokePreviewUrl(item.preview_url));
  banners.value = [];
  credits.value = [];
};

const ensureRows = () => {
  if (!banners.value.length) banners.value = [createBannerItem(0)];
  if (!credits.value.length) credits.value = [createCreditItem(0)];
};

const fillForm = async () => {
  const settings = await getSiteSettings();
  resetItems();
  bannerAutoSlideSec.value = Number(settings.banner_auto_slide_sec ?? 5);
  banners.value = settings.banners.map((item, index) => ({
    id: item.id || `banner-${index + 1}`,
    image_url: item.image_url ?? "",
    active: item.active !== false,
    order: Number(item.order ?? index + 1),
    file: null,
    preview_url: item.image_url ?? "",
  }));
  credits.value = settings.credits.map((item, index) => ({
    id: item.id || `credit-${index + 1}`,
    image_url: item.image_url ?? "",
    order: Number(item.order ?? index + 1),
    file: null,
    preview_url: item.image_url ?? "",
  }));
  ensureRows();
};

const loadSettings = async () => {
  loading.value = true;
  try {
    await fillForm();
  } catch (error) {
    console.error("โหลด site settings ไม่สำเร็จ", error);
    appToast.error("โหลด site settings ไม่สำเร็จ");
  } finally {
    loading.value = false;
  }
};

const updateBannerFile = (item: EditableBanner, file: File | null) => {
  revokePreviewUrl(item.preview_url);
  item.file = file;
  item.preview_url = file ? URL.createObjectURL(file) : item.image_url;
};

const updateCreditFile = (item: EditableCredit, file: File | null) => {
  revokePreviewUrl(item.preview_url);
  item.file = file;
  item.preview_url = file ? URL.createObjectURL(file) : item.image_url;
};

const normalizeSingleFile = (value: File | File[] | null | undefined) => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const addBanner = () => {
  banners.value.push(createBannerItem(banners.value.length));
};

const addCredit = () => {
  credits.value.push(createCreditItem(credits.value.length));
};

const normalizeOrders = () => {
  banners.value = [...banners.value]
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
    .map((item, index) => ({ ...item, order: index + 1 }));
  credits.value = [...credits.value]
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
    .map((item, index) => ({ ...item, order: index + 1 }));
};

const removeBanner = (index: number) => {
  revokePreviewUrl(banners.value[index]?.preview_url);
  banners.value = banners.value.filter((_, itemIndex) => itemIndex !== index);
  ensureRows();
};

const removeCredit = (index: number) => {
  revokePreviewUrl(credits.value[index]?.preview_url);
  credits.value = credits.value.filter((_, itemIndex) => itemIndex !== index);
  ensureRows();
};

const onCancel = async () => {
  await loadSettings();
};

const onSave = async () => {
  saving.value = true;
  try {
    normalizeOrders();
    await updateSiteSettings({
      banner_auto_slide_sec: Number(bannerAutoSlideSec.value || 5),
      banners: banners.value.map((item, index) => ({
        id: item.id || `banner-${index + 1}`,
        image_url: item.file ? undefined : item.image_url,
        file: item.file,
        active: item.active,
        order: item.order || index + 1,
      })),
      credits: credits.value.map((item, index) => ({
        id: item.id || `credit-${index + 1}`,
        image_url: item.file ? undefined : item.image_url,
        file: item.file,
        order: item.order || index + 1,
      })),
    });

    appToast.success("บันทึก site settings สำเร็จ");
    await loadSettings();
  } catch (error) {
    console.error("บันทึก site settings ไม่สำเร็จ", error);
    appToast.error("บันทึก site settings ไม่สำเร็จ");
  } finally {
    saving.value = false;
  }
};

onMounted(loadSettings);

onBeforeUnmount(() => {
  resetItems();
});
</script>

<template>
  <v-row no-gutters class="pa-5">
  <v-col cols="12">
    <v-row>
        <v-col cols="6">
          <span class="tw:text-2xl tw:font-bold">Setting Images</span>
        </v-col>

        <v-col cols="6" class="tw:flex tw:justify-end">
          <v-btn variant="outlined" :disabled="saving" @click="onCancel()">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="onSave()">Save</v-btn>
        </v-col>
    </v-row>
  </v-col>

    <v-col v-if="loading" cols="12">
      <div>
        Loading settings...
      </div>
    </v-col>

    <v-col cols="12" v-else>
      <v-row>
        <v-col cols="12">
          <span class="tw:text-lg tw:font-bold">ส่วนแบนเนอร์ด้านบน</span>
          <span class="tw:text-sm">ใช้สำหรับภาพหลักส่วนบนของหน้าแรก และควบคุมการเปิด/ปิดแต่ละแบนเนอร์</span>
        </v-col>
        <v-col cols="12">
          <div>
            <label>เวลาเลื่อนอัตโนมัติ (วินาที)</label>
            <form-vee-text-field
              v-model="bannerAutoSlideSec"
              type="number"
              min="1"
              variant="outlined"
            />
          </div>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <v-btn variant="outlined" @click="addBanner()">เพิ่มแบนเนอร์</v-btn>
        </v-col>
      </v-row>

      <v-row>
        <v-col
          v-for="(item, index) in banners"
          :key="`banner-${item.id}-${index}`"
          cols="12"
        >
          <div>
            <v-row align="center">
              <v-col cols="12" md="4">
                <div>แบนเนอร์ {{ index + 1 }}</div>
              </v-col>
              <v-col cols="12" md="8">
                <div>
                  <label>ลำดับ</label>
                  <form-vee-text-field
                    v-model="item.order"
                    type="number"
                    min="1"
                    variant="outlined"
                  />
                </div>
                <form-vee-switch
                  v-model="item.active"
                  color="primary"
                  hide-details
                  inset
                />
                <span>{{ item.active ? "เปิดใช้งาน" : "ปิดใช้งาน" }}</span>
                <v-btn size="small" variant="text" color="error" @click="removeBanner(index)">ลบ</v-btn>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" md="6">
                <div>
                  <img
                    v-if="item.preview_url"
                    :src="item.preview_url"
                    :alt="`banner-${index + 1}`"
                  >
                  <div v-else>
                    ยังไม่มีรูปแบนเนอร์
                  </div>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <form-vee-file-input
                  :name="`banner_file_${index}`"
                  label="อัปโหลดรูปแบนเนอร์"
                  accept="image/png,image/jpeg,image/webp"
                  variant="outlined"
                  @update:model-value="updateBannerFile(item, normalizeSingleFile($event))"
                />
              </v-col>
            </v-row>
          </div>
        </v-col>
      </v-row>

      <v-row align="center">
        <v-col cols="12" md="8">
          <h2>ส่วนเครดิต / โลโก้</h2>
          <p>ใช้สำหรับภาพโลโก้หรือเครดิตที่แสดงใต้ส่วนหมวดหมู่ในหน้าแรก</p>
        </v-col>
        <v-col cols="12" md="4">
          <v-btn variant="outlined" @click="addCredit()">เพิ่มเครดิต</v-btn>
        </v-col>
      </v-row>

      <v-row>
        <v-col
          v-for="(item, index) in credits"
          :key="`credit-${item.id}-${index}`"
          cols="12"
          md="6"
        >
          <div>
            <v-row align="center">
              <v-col cols="12" sm="6">
                <div>เครดิต {{ index + 1 }}</div>
              </v-col>
              <v-col cols="12" sm="6">
                <div>
                  <label>ลำดับ</label>
                  <form-vee-text-field
                    v-model="item.order"
                    type="number"
                    min="1"
                    variant="outlined"
                  />
                </div>
                <v-btn size="small" variant="text" color="error" @click="removeCredit(index)">ลบ</v-btn>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12">
                <div>
                  <img
                    v-if="item.preview_url"
                    :src="item.preview_url"
                    :alt="`credit-${index + 1}`"
                  >
                  <div v-else>
                    ยังไม่มีรูปเครดิต
                  </div>
                </div>
              </v-col>
              <v-col cols="12">
                <form-vee-file-input
                  :name="`credit_file_${index}`"
                  label="อัปโหลดรูปเครดิต"
                  accept="image/png,image/jpeg,image/webp"
                  variant="outlined"
                  @update:model-value="updateCreditFile(item, normalizeSingleFile($event))"
                />
              </v-col>
            </v-row>
          </div>
        </v-col>
      </v-row>
    </v-col>
  </v-row>
</template>
