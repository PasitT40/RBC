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
const activeTab = ref('banners');
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
    appToast.error(error, "โหลดการตั้งค่าหน้าเว็บไม่สำเร็จ");
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
    appToast.error(error, "บันทึกการตั้งค่าหน้าเว็บไม่สำเร็จ");
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
  <div>
    <TopbarTeleport to="#rbc-topbar-subtitle">
      <span>{{ banners.length }} แบนเนอร์ · {{ credits.length }} เครดิต</span>
    </TopbarTeleport>
    <TopbarTeleport to="#rbc-topbar-actions">
      <v-btn variant="outlined" color="grey-darken-1" :disabled="saving" @click="onCancel()">
        ยกเลิกการแก้ไข
      </v-btn>
      <v-btn class="rbc-btn-primary ml-2" :loading="saving" @click="onSave()">
        บันทึกการเปลี่ยนแปลง
      </v-btn>
    </TopbarTeleport>

    <div class="settings-page rbc-page-container">
      <div v-if="loading" class="settings-loading">
        <v-progress-circular indeterminate color="primary" size="48" />
      </div>

      <template v-else>
        <div class="settings-tabs-container">
          <v-tabs v-model="activeTab" color="primary" class="settings-tabs">
            <v-tab value="banners">แบนเนอร์ ({{ banners.length }})</v-tab>
            <v-tab value="credits">เครดิต ({{ credits.length }})</v-tab>
          </v-tabs>
        </div>

        <v-window v-model="activeTab" class="settings-window">
          <v-window-item value="banners">
            <section class="settings-section">
              <div class="settings-slide-strip">
                <span class="settings-slide-strip__label">เลื่อนแบนเนอร์ทุกกี่วินาที</span>
                <v-text-field
                  v-model="bannerAutoSlideSec"
                  class="settings-slide-strip__field"
                  type="number"
                  min="1"
                  variant="outlined"
                  density="compact"
                  hide-details
                />
              </div>

              <header class="settings-section__header">
                <div class="settings-section__heading">
                  <div class="settings-section__icon">
                    <v-icon size="18">mdi-image-multiple-outline</v-icon>
                  </div>
                  <div>
                    <h2>แบนเนอร์หน้าแรก</h2>
                    <p>1440 x 800 px, JPG/PNG/WebP, ไม่เกิน 500 KB หลังประมวลผล</p>
                  </div>
                </div>
                <v-btn color="primary" variant="outlined" rounded="lg" prepend-icon="mdi-plus" @click="addBanner()">
                  เพิ่มแบนเนอร์
                </v-btn>
              </header>

              <div class="settings-section__body">
                <div v-if="!banners.length" class="settings-empty">
                  <div class="settings-empty__icon">
                    <v-icon size="22">mdi-image-area</v-icon>
                  </div>
                  <div>
                    <strong>ยังไม่มีแบนเนอร์</strong>
                    <span>เพิ่มรูปหลักสำหรับหน้าแรกได้จากปุ่มด้านบน</span>
                  </div>
                </div>

                <div v-else class="settings-banner-list">
                  <article
                    v-for="(item, index) in banners"
                    :key="`banner-${item.id}-${index}`"
                    class="settings-banner-item"
                  >
                    <div class="settings-banner-preview">
                      <v-img
                        v-if="item.preview_url"
                        :src="item.preview_url"
                        :alt="`banner-${index + 1}`"
                        cover
                      />
                      <div v-else class="settings-banner-preview__empty">
                        <v-icon size="24">mdi-image-outline</v-icon>
                        <span>ยังไม่มีรูปแบนเนอร์</span>
                      </div>
                    </div>

                    <div class="settings-banner-editor">
                      <div class="settings-item-title">
                        <strong>แบนเนอร์ {{ index + 1 }}</strong>
                        <span :class="{ 'settings-status--muted': !item.active }" class="settings-status">
                          {{ item.active ? "แสดงบนเว็บ" : "ซ่อนอยู่" }}
                        </span>
                      </div>

                      <div class="settings-inline-controls">
                        <v-text-field
                          v-model="item.order"
                          class="settings-order-field"
                          type="number"
                          min="1"
                          variant="outlined"
                          density="compact"
                          label="ลำดับ"
                          hide-details
                        />
                        <v-switch
                          v-model="item.active"
                          color="primary"
                          hide-details
                          inset
                          density="compact"
                          :label="item.active ? 'เปิดแสดง' : 'ซ่อน'"
                        />
                      </div>

                      <div class="settings-upload">
                        <form-vee-file-input
                          :name="`banner_file_${index}`"
                          label="เลือกหรือเปลี่ยนรูปแบนเนอร์"
                          accept="image/png,image/jpeg,image/webp"
                          variant="outlined"
                          :max-size="8000000"
                          :constraint="{ width: 1440, height: 800, maxSizeKB: 500, label: '1440 x 800 px' }"
                          @update:model-value="updateBannerFile(item, normalizeSingleFile($event))"
                        />
                      </div>
                    </div>

                    <v-btn
                      aria-label="ลบแบนเนอร์"
                      class="settings-delete"
                      icon="mdi-trash-can-outline"
                      variant="text"
                      color="error"
                      @click="removeBanner(index)"
                    />
                  </article>
                </div>
              </div>
            </section>
          </v-window-item>

          <v-window-item value="credits">
            <section class="settings-section">
              <header class="settings-section__header">
                <div class="settings-section__heading">
                  <div class="settings-section__icon settings-section__icon--soft">
                    <v-icon size="18">mdi-store-outline</v-icon>
                  </div>
                  <div>
                    <h2>เครดิต</h2>
                    <p>1200 x 1200 px, PNG, ไม่เกิน 300 KB หลังประมวลผล</p>
                  </div>
                </div>
                <v-btn color="primary" variant="outlined" rounded="lg" prepend-icon="mdi-plus" @click="addCredit()">
                  เพิ่มเครดิต
                </v-btn>
              </header>

              <div class="settings-section__body">
                <div v-if="!credits.length" class="settings-empty">
                  <div class="settings-empty__icon settings-empty__icon--soft">
                    <v-icon size="22">mdi-image-multiple-outline</v-icon>
                  </div>
                  <div>
                    <strong>ยังไม่มีเครดิต</strong>
                    <span>เพิ่มภาพที่จะใช้ใต้หมวดหมู่บนหน้าแรก</span>
                  </div>
                </div>

                <div v-else class="settings-credit-grid">
                  <article
                    v-for="(item, index) in credits"
                    :key="`credit-${item.id}-${index}`"
                    class="settings-credit-item"
                  >
                    <div class="settings-credit-preview">
                      <v-img
                        v-if="item.preview_url"
                        :src="item.preview_url"
                        :alt="`credit-${index + 1}`"
                        contain
                      />
                      <div v-else class="settings-credit-preview__empty">
                        <v-icon size="22">mdi-image-outline</v-icon>
                        <span>ยังไม่มีรูป</span>
                      </div>
                    </div>

                    <div class="settings-item-title">
                      <strong>เครดิต {{ index + 1 }}</strong>
                      <v-btn
                        aria-label="ลบเครดิต"
                        icon="mdi-trash-can-outline"
                        size="small"
                        variant="text"
                        color="error"
                        @click="removeCredit(index)"
                      />
                    </div>

                    <v-text-field
                      v-model="item.order"
                      class="settings-order-field"
                      type="number"
                      min="1"
                      variant="outlined"
                      density="compact"
                      label="ลำดับ"
                      hide-details
                    />

                    <div class="settings-upload">
                      <form-vee-file-input
                        :name="`credit_file_${index}`"
                        label="เลือกรูป"
                        accept="image/png,image/jpeg,image/webp"
                        variant="outlined"
                        :max-size="5000000"
                        :constraint="{ width: 1200, height: 1200, maxSizeKB: 300, keepPng: true, label: '1200 x 1200 px' }"
                        @update:model-value="updateCreditFile(item, normalizeSingleFile($event))"
                      />
                    </div>
                  </article>
                </div>
              </div>
            </section>
          </v-window-item>
        </v-window>
      </template>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 1180px;
  padding: 28px 0 40px;
}

.settings-loading {
  display: flex;
  min-height: 420px;
  align-items: center;
  justify-content: center;
}

.settings-tabs-container {
  margin-bottom: 14px;
  overflow: hidden;
  border: 1px solid var(--rbc-slate-200);
  border-radius: 14px;
  background: #ffffff;
  box-shadow: var(--rbc-shadow-soft);
}

.settings-tabs :deep(.v-tab) {
  font-size: 14px;
  font-weight: 700;
  text-transform: none;
  letter-spacing: 0;
}

.settings-window {
  overflow: visible;
}

.settings-slide-strip {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 14px 22px;
  border-bottom: 1px solid var(--rbc-slate-100);
  background: var(--rbc-slate-50);
}

.settings-slide-strip__label {
  color: var(--rbc-slate-700);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.settings-slide-strip__field {
  max-width: 140px;
}

.settings-section {
  margin-top: 14px;
  overflow: hidden;
  border: 1px solid var(--rbc-slate-200);
  border-radius: 18px;
  background: #ffffff;
  box-shadow: var(--rbc-shadow-soft);
}

.settings-section__header {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--rbc-slate-100);
}

.settings-section__heading {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.settings-section__heading h2 {
  margin: 0;
  color: var(--rbc-slate-900);
  font-size: 16px;
  font-weight: 800;
  line-height: 1.25;
}

.settings-section__heading p {
  margin: 3px 0 0;
  color: var(--rbc-slate-500);
  font-size: 12px;
  line-height: 1.35;
}

.settings-section__icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--rbc-orange-200);
  border-radius: 11px;
  background: var(--rbc-orange-50);
  color: var(--rbc-orange-600);
}

.settings-section__icon--soft {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
}

.settings-section__body {
  padding: 18px 22px 22px;
}

.settings-empty {
  display: flex;
  gap: 14px;
  align-items: center;
  min-height: 116px;
  padding: 22px;
  border: 1px dashed var(--rbc-slate-200);
  border-radius: 14px;
  background: var(--rbc-slate-50);
  color: var(--rbc-slate-500);
}

.settings-empty strong,
.settings-empty span {
  display: block;
}

.settings-empty strong {
  margin-bottom: 3px;
  color: var(--rbc-slate-900);
  font-size: 14px;
}

.settings-empty span {
  font-size: 13px;
}

.settings-empty__icon {
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 13px;
  background: var(--rbc-orange-100);
  color: var(--rbc-orange-600);
}

.settings-empty__icon--soft {
  background: #dbeafe;
  color: #2563eb;
}

.settings-banner-list {
  display: grid;
  gap: 12px;
}

.settings-banner-item {
  display: grid;
  grid-template-columns: minmax(230px, 292px) minmax(0, 1fr) 42px;
  gap: 16px;
  align-items: start;
  padding: 14px;
  border: 1px solid var(--rbc-slate-200);
  border-radius: 16px;
  background: var(--rbc-slate-50);
}

.settings-banner-preview {
  overflow: hidden;
  min-height: 164px;
  border: 1px solid var(--rbc-slate-200);
  border-radius: 12px;
  background: #ffffff;
}

.settings-banner-preview :deep(.v-img) {
  height: 164px;
}

.settings-banner-preview__empty,
.settings-credit-preview__empty {
  display: grid;
  min-height: inherit;
  place-content: center;
  gap: 7px;
  color: var(--rbc-slate-400);
  text-align: center;
  font-size: 12px;
  font-weight: 700;
}

.settings-banner-editor {
  min-width: 0;
}

.settings-item-title {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
  margin-bottom: 8px;
}

.settings-item-title strong {
  color: var(--rbc-slate-900);
  font-size: 14px;
  font-weight: 800;
}

.settings-status {
  padding: 4px 9px;
  border-radius: 99px;
  background: #dcfce7;
  color: #15803d;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.settings-status--muted {
  background: var(--rbc-slate-100);
  color: var(--rbc-slate-500);
}

.settings-inline-controls {
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.settings-order-field {
  width: 96px;
  flex: 0 0 auto;
}

.settings-delete {
  align-self: start;
}

.settings-upload :deep(.rbc-upload-zone) {
  padding: 12px;
  border-color: var(--rbc-slate-200);
  border-radius: 14px;
  background: #ffffff;
  text-align: left;
}

.settings-upload :deep(.rbc-upload-zone__constraint) {
  margin-top: 0;
  margin-bottom: 8px;
}

.settings-upload :deep(.preview-grid) {
  grid-template-columns: repeat(auto-fill, minmax(84px, 84px));
}

.settings-upload :deep(.preview-button),
.settings-upload :deep(.preview-item img) {
  width: 84px;
}

.settings-credit-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.settings-credit-item {
  display: grid;
  gap: 11px;
  align-content: start;
  padding: 14px;
  border: 1px solid var(--rbc-slate-200);
  border-radius: 16px;
  background: var(--rbc-slate-50);
}

.settings-credit-preview {
  overflow: hidden;
  min-height: 156px;
  border: 1px solid var(--rbc-slate-200);
  border-radius: 12px;
  background: #ffffff;
}

.settings-credit-preview :deep(.v-img) {
  height: 156px;
}

@media (max-width: 959px) {
  .settings-page {
    padding-top: 18px;
  }

  .settings-banner-item {
    grid-template-columns: minmax(0, 1fr);
  }

  .settings-banner-preview,
  .settings-banner-preview :deep(.v-img) {
    min-height: 188px;
    height: 188px;
  }

  .settings-delete {
    justify-self: end;
    order: -1;
  }

  .settings-credit-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 599px) {
  .settings-section__header {
    align-items: stretch;
    flex-direction: column;
    padding: 16px;
  }

  .settings-section__body {
    padding: 14px;
  }

  .settings-empty {
    min-height: 0;
    padding: 18px;
  }

  .settings-inline-controls {
    gap: 8px;
  }

  .settings-credit-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
