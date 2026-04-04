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
    console.error("โหลดการตั้งค่าหน้าเว็บไม่สำเร็จ", error);
    appToast.error("โหลดการตั้งค่าหน้าเว็บไม่สำเร็จ");
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

    appToast.success("บันทึกการตั้งค่าหน้าเว็บเรียบร้อยแล้ว");
    await loadSettings();
  } catch (error) {
    console.error("บันทึกการตั้งค่าหน้าเว็บไม่สำเร็จ", error);
    appToast.error("บันทึกการตั้งค่าหน้าเว็บไม่สำเร็จ");
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
  <v-container fluid class="pa-6">
    <v-row>
      <v-col cols="7">
        <div class="text-h4 font-weight-bold">ตั้งค่าหน้าเว็บ</div>
        <div class="text-subtitle-1 text-medium-emphasis">
          จัดการแบนเนอร์หน้าแรก โลโก้เครดิต และจังหวะการเลื่อนอัตโนมัติ
        </div>
      </v-col>
      <v-col cols="5">
        <v-row justify="end">
          <v-col cols="auto">
            <v-btn variant="outlined" rounded="pill" size="large" :disabled="saving" @click="onCancel()">
              ยกเลิกการแก้ไข
            </v-btn>
          </v-col>
          <v-col cols="auto">
            <v-btn color="#f5962f" rounded="pill" size="large" class="text-white" :loading="saving" @click="onSave()">
              บันทึกการเปลี่ยนแปลง
            </v-btn>
          </v-col>
        </v-row>
      </v-col>

      <v-col v-if="loading" cols="12">
        <v-sheet border rounded="lg" class="pa-8">
          <div class="text-h6">กำลังโหลดการตั้งค่าหน้าเว็บ...</div>
          <div class="text-body-2 text-medium-emphasis">
            รอสักครู่ ระบบกำลังดึงข้อมูลล่าสุดมาให้
          </div>
        </v-sheet>
      </v-col>

      <template v-else>
        <v-col cols="12">
          <v-card rounded="lg" elevation="2">
            <v-card-item>
              <v-card-title>แบนเนอร์หน้าแรก</v-card-title>
              <v-card-subtitle>ตั้งค่ารูปหลักด้านบนหน้าแรก พร้อมลำดับและสถานะการแสดงผล</v-card-subtitle>
            </v-card-item>
            <v-card-text>
              <v-row>
                <v-col cols="4">
                  <form-vee-text-field
                    v-model="bannerAutoSlideSec"
                    label="เลื่อนอัตโนมัติทุกกี่วินาที"
                    type="number"
                    min="1"
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="8">
                  <v-row justify="end">
                    <v-col cols="auto">
                      <v-btn color="#f5962f" rounded="pill" variant="outlined" @click="addBanner()">เพิ่มแบนเนอร์</v-btn>
                    </v-col>
                  </v-row>
                </v-col>

                <v-col cols="12">
                  <v-alert
                    type="info"
                    variant="tonal"
                    density="comfortable"
                    text="แนะนำให้ใช้ภาพแนวนอนที่คมชัด เพื่อให้ส่วนบนหน้าแรกดูเต็มและอ่านง่าย"
                  />
                </v-col>

                <v-col
                  v-for="(item, index) in banners"
                  :key="`banner-${item.id}-${index}`"
                  cols="12"
                >
                  <v-sheet border rounded="lg" class="pa-6">
                    <v-row>
                      <v-col cols="5">
                        <div class="text-h6">แบนเนอร์ {{ index + 1 }}</div>
                        <div class="text-body-2 text-medium-emphasis">
                          ภาพนี้จะแสดงในส่วนบนของหน้าแรก เลือกรูปที่เห็นตัวสินค้าเด่นและไม่แน่นเกินไป
                        </div>
                        <v-sheet
                          border
                          rounded="lg"
                          color="grey-lighten-5"
                          height="280"
                          class="mt-4 d-flex align-center justify-center"
                        >
                          <v-img
                            v-if="item.preview_url"
                            :src="item.preview_url"
                            :alt="`banner-${index + 1}`"
                            cover
                            height="280"
                          />
                          <div v-else class="text-body-2 text-medium-emphasis">ยังไม่ได้เลือกรูปแบนเนอร์</div>
                        </v-sheet>
                      </v-col>
                      <v-col cols="7">
                        <v-row>
                          <v-col cols="12">
                            <v-sheet border rounded="lg" color="grey-lighten-5" class="pa-5">
                              <div class="text-subtitle-1 font-weight-bold">การตั้งค่าการแสดงผล</div>
                              <div class="text-body-2 text-medium-emphasis">
                                เลือกลำดับและกำหนดว่าจะให้แบนเนอร์นี้แสดงบนหน้าเว็บหรือยัง
                              </div>
                              <v-row class="mt-2">
                                <v-col cols="4">
                                  <form-vee-text-field
                                    v-model="item.order"
                                    label="ลำดับการแสดง"
                                    type="number"
                                    min="1"
                                    variant="outlined"
                                  />
                                </v-col>
                                <v-col cols="8">
                                  <v-sheet border rounded="lg" class="pa-4">
                                    <div class="text-body-1 font-weight-medium">
                                      {{ item.active ? "แบนเนอร์นี้เปิดใช้งานอยู่" : "แบนเนอร์นี้ยังไม่แสดงบนหน้าเว็บ" }}
                                    </div>
                                    <div class="text-body-2 text-medium-emphasis">
                                      {{ item.active ? "บันทึกแล้วจะเห็นบนหน้าแรกตามลำดับที่ตั้งไว้" : "บันทึกได้เลย แต่ระบบจะยังไม่แสดงภาพนี้บนหน้าแรก" }}
                                    </div>
                                    <form-vee-switch
                                      v-model="item.active"
                                      color="primary"
                                      hide-details
                                      inset
                                      label="เปิดแสดงบนหน้าเว็บ"
                                    />
                                  </v-sheet>
                                </v-col>
                              </v-row>
                            </v-sheet>
                          </v-col>

                          <v-col cols="12">
                            <v-sheet border rounded="lg" class="pa-5">
                              <div class="text-subtitle-1 font-weight-bold">อัปโหลดรูปแบนเนอร์</div>
                              <div class="text-body-2 text-medium-emphasis">
                                รองรับไฟล์ PNG, JPG และ WebP
                              </div>
                              <form-vee-file-input
                                :name="`banner_file_${index}`"
                                label="เลือกรูปแบนเนอร์ใหม่"
                                hint="ถ้าอัปโหลดรูปใหม่ ระบบจะใช้รูปใหม่แทนรูปเดิมทันทีหลังบันทึก แนะนำความละเอียดไม่เกิน 1600 x 900 px และขนาดไฟล์ไม่เกิน 8 MB"
                                accept="image/png,image/jpeg,image/webp"
                                variant="outlined"
                                :max-size="8000000"
                                class="mt-4"
                                @update:model-value="updateBannerFile(item, normalizeSingleFile($event))"
                              />
                            </v-sheet>
                          </v-col>

                          <v-col cols="12">
                            <v-row justify="end">
                              <v-col cols="auto">
                                <v-btn size="small" variant="text" color="error" @click="removeBanner(index)">
                                  ลบแบนเนอร์นี้
                                </v-btn>
                              </v-col>
                            </v-row>
                          </v-col>
                        </v-row>
                      </v-col>
                    </v-row>
                  </v-sheet>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12">
          <v-card rounded="lg" elevation="2">
            <v-card-item>
              <v-card-title>โลโก้และเครดิต</v-card-title>
              <v-card-subtitle>ตั้งค่าภาพโลโก้หรือเครดิตที่แสดงใต้หมวดหมู่บนหน้าแรก</v-card-subtitle>
            </v-card-item>
            <v-card-text>
              <v-row>
                <v-col cols="8">
                  <div class="text-body-2 text-medium-emphasis">
                    เรียงลำดับจากซ้ายไปขวาตามหมายเลขที่กำหนดไว้
                  </div>
                </v-col>
                <v-col cols="4">
                  <v-row justify="end">
                    <v-col cols="auto">
                      <v-btn color="#f5962f" rounded="pill" variant="outlined" @click="addCredit()">เพิ่มโลโก้หรือเครดิต</v-btn>
                    </v-col>
                  </v-row>
                </v-col>

                <v-col cols="12">
                  <v-alert
                    type="info"
                    variant="tonal"
                    density="comfortable"
                    text="ใช้ส่วนนี้กับโลโก้พาร์ตเนอร์หรือภาพเครดิตที่ต้องการให้เห็นใต้หมวดหมู่บนหน้าแรก"
                  />
                </v-col>

                <v-col
                  v-for="(item, index) in credits"
                  :key="`credit-${item.id}-${index}`"
                  cols="6"
                >
                  <v-sheet border rounded="lg" class="pa-6">
                    <v-row>
                      <v-col cols="12">
                        <div class="text-h6">เครดิต {{ index + 1 }}</div>
                        <div class="text-body-2 text-medium-emphasis">
                          ใช้กับโลโก้พาร์ตเนอร์หรือภาพเครดิตด้านล่างหน้าแรก
                        </div>
                      </v-col>
                      <v-col cols="12">
                        <v-sheet
                          border
                          rounded="lg"
                          color="grey-lighten-5"
                          height="220"
                          class="d-flex align-center justify-center"
                        >
                          <v-img
                            v-if="item.preview_url"
                            :src="item.preview_url"
                            :alt="`credit-${index + 1}`"
                            contain
                            height="220"
                          />
                          <div v-else class="text-body-2 text-medium-emphasis">ยังไม่ได้เลือกรูปเครดิต</div>
                        </v-sheet>
                      </v-col>

                      <v-col cols="4">
                        <form-vee-text-field
                          v-model="item.order"
                          label="ลำดับการแสดง"
                          type="number"
                          min="1"
                          variant="outlined"
                        />
                      </v-col>
                      <v-col cols="8">
                        <form-vee-file-input
                          :name="`credit_file_${index}`"
                          label="เลือกรูปเครดิตใหม่"
                          hint="รองรับไฟล์ PNG, JPG และ WebP แนะนำความละเอียดไม่เกิน 800 x 800 px และขนาดไฟล์ไม่เกิน 5 MB"
                          accept="image/png,image/jpeg,image/webp"
                          variant="outlined"
                          :max-size="5000000"
                          @update:model-value="updateCreditFile(item, normalizeSingleFile($event))"
                        />
                      </v-col>

                      <v-col cols="12">
                        <v-row justify="end">
                          <v-col cols="auto">
                            <v-btn size="small" variant="text" color="error" @click="removeCredit(index)">
                              ลบรายการนี้
                            </v-btn>
                          </v-col>
                        </v-row>
                      </v-col>
                    </v-row>
                  </v-sheet>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </template>
    </v-row>
  </v-container>
</template>
