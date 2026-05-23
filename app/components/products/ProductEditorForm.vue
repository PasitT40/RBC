<script setup lang="ts">
type SelectOption = {
  title: string;
  value: string;
};

const props = defineProps<{
  title: string;
  saveLabel?: string;
  saveLoading?: boolean;
  saveDisabled?: boolean;
  pageLoading?: boolean;
  categoryOptions: SelectOption[];
  brandOptions: SelectOption[];
  brandDisabled?: boolean;
  taxonomyRefreshLoading?: boolean;
  slugPreview?: string;
  skuValue?: string;
  seoFallbackHint?: string;
  publicReadinessIssues?: string[];
  hiddenInfoMessage?: string;
  publishActive?: boolean | null;
  imageHint?: string;
  coverPreviewUrl?: string;
  coverPreviewAlt?: string;
  previewUrls?: string[];
  currentStep?: 1 | 2 | 3;
  costPrice?: number;
  sellPrice?: number;
}>();

const emit = defineEmits<{
  (e: "cancel"): void;
  (e: "submit"): void;
  (e: "refresh-taxonomy"): void;
  (e: "select-images", value: File | File[] | null): void;
  (e: "reorder-previews", value: string[]): void;
  (e: "remove-preview", index: number): void;
  (e: "go-step", step: number): void;
}>();

const steps = ['ข้อมูลทั่วไป', 'รูปภาพ & ราคา', 'ตรวจสอบ'];

const hasWarning = computed(() => Boolean(props.publishActive && props.publicReadinessIssues?.length));
const hasHiddenInfo = computed(() => props.publishActive === false && Boolean(props.hiddenInfoMessage));
</script>

<template>
  <div class="rbc-steps mb-6 tw:px-6" style="max-width: 1000px; margin-left: auto; margin-right: auto;">
    <div
      v-for="(step, i) in steps"
      :key="i"
      class="rbc-step"
      :class="{ 'rbc-step--clickable': i + 1 < (currentStep ?? 1) }"
      @click="i + 1 < (currentStep ?? 1) ? emit('go-step', i + 1) : undefined"
    >
      <div
        class="rbc-step__dot"
        :class="{
          'rbc-step__dot--done': i + 1 < (currentStep ?? 1),
          'rbc-step__dot--active': i + 1 === (currentStep ?? 1),
          'rbc-step__dot--pending': i + 1 > (currentStep ?? 1),
        }"
      >
        <v-icon v-if="i + 1 < (currentStep ?? 1)" size="14">mdi-check</v-icon>
        <span v-else>{{ i + 1 }}</span>
      </div>
      <div class="rbc-step__label">{{ step }}</div>
      <div v-if="i < steps.length - 1" class="rbc-step__line" />
    </div>
  </div>

  <div class="rbc-page-container tw:py-6" style="max-width: 1000px;">
    <div v-if="pageLoading" class="py-16 d-flex justify-center">
      <v-progress-circular indeterminate color="#f5962f" />
    </div>

    <template v-else>
      <slot name="summary" />

      <v-row>
        <v-col cols="12" class="py-0">
          <v-alert
            v-if="hasWarning"
            type="warning"
            variant="tonal"
            class="mb-6"
          >
            <slot name="warning-message">
              ยังเปิดขายบนหน้าเว็บไม่ได้ เพราะข้อมูลยังไม่ครบ: {{ publicReadinessIssues?.join(", ") }}
            </slot>
          </v-alert>

          <v-alert
            v-else-if="hasHiddenInfo"
            type="info"
            variant="tonal"
            class="mb-6"
          >
            {{ hiddenInfoMessage }}
          </v-alert>
        </v-col>

        <v-col cols="12">
          <div class="rbc-card tw:mb-6">
            <div class="rbc-card__header">
              <div class="rbc-card__title"><v-icon size="16" color="primary">mdi-package-variant</v-icon>ข้อมูลหลัก</div>
            </div>
            <div class="rbc-card__body">
              <v-row>
                <v-col cols="12" md="6">
                  <form-vee-text-field
                    name="name"
                    label="ชื่อสินค้า *"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                  />
                </v-col>

                <v-col cols="12" md="6">
                  <form-vee-text-field
                    name="seo_title"
                    label="ชื่อสำหรับ SEO"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                  />
                </v-col>

                <v-col cols="12" md="6">
                  <slot name="top-aside">
                    <v-sheet rounded="lg" color="grey-lighten-4" class="pa-4 fill-height">
                      <div class="text-body-2 font-weight-medium">{{ seoFallbackHint }}</div>
                      <div class="text-caption text-medium-emphasis">SKU: {{ skuValue || "ระบบจะสร้างให้อัตโนมัติเมื่อบันทึก" }}</div>
                      <div class="text-caption text-medium-emphasis">ลิงก์สินค้าที่ระบบจะสร้างให้: {{ slugPreview || "-" }}</div>
                    </v-sheet>
                  </slot>
                </v-col>
                <v-col cols="12" md="6">
                  <v-row>
                    <v-col cols="12" class="pt-0">
                      <div class="d-flex justify-end">
                        <v-btn
                          variant="text"
                          color="primary"
                          :loading="taxonomyRefreshLoading"
                          prepend-icon="mdi-refresh"
                          @click="emit('refresh-taxonomy')"
                        >
                          รีเฟรชหมวดหมู่ / แบรนด์
                        </v-btn>
                      </div>
                    </v-col>
                    <v-col cols="12">
                      <form-vee-select
                        name="category_id"
                        label="ประเภทสินค้า *"
                        variant="outlined"
                        density="comfortable"
                        item-title="title"
                        item-value="value"
                        :items="categoryOptions"
                        hide-details="auto"
                      />
                    </v-col>
                    <v-col cols="12">
                      <form-vee-select
                        name="brand_id"
                        label="แบรนด์ *"
                        variant="outlined"
                        density="comfortable"
                        item-title="title"
                        item-value="value"
                        :items="brandOptions"
                        :disabled="brandDisabled"
                        hide-details="auto"
                      />
                    </v-col>
                  </v-row>
                </v-col>

                <v-col cols="12" md="6">
                  <form-vee-number-stepper
                    name="condition"
                    label="คุณภาพสินค้า *"
                    :min="0"
                    :max="5"
                    :step="0.5"
                  />
                </v-col>

                <v-col cols="12" md="6" class="d-flex tw:items-center">
                  <form-vee-text-field
                    name="shutter"
                    label="จำนวนชัตเตอร์"
                    variant="outlined"
                    density="comfortable"
                    type="text"
                    hide-details="auto"
                  />
                </v-col>

                <v-col cols="12" md="6">
                  <form-vee-text-field
                    name="cost_price"
                    label="ราคา - ทุน *"
                    variant="outlined"
                    density="comfortable"
                    type="number"
                    min="0"
                    hide-details="auto"
                  />
                </v-col>

                <v-col cols="12" md="6">
                  <form-vee-text-field
                    name="sell_price"
                    label="ราคา - ขาย *"
                    variant="outlined"
                    density="comfortable"
                    type="number"
                    min="0"
                    hide-details="auto"
                  />
                </v-col>

                <v-col cols="12" v-if="typeof costPrice === 'number' && typeof sellPrice === 'number' && costPrice >= 0 && sellPrice >= 0">
                  <div class="tw:rounded-xl tw:bg-orange-50 tw:border tw:border-orange-200 tw:p-4 tw:flex tw:flex-wrap tw:items-center tw:gap-6">
                    <div>
                      <div class="tw:text-xs tw:font-semibold tw:text-slate-500 tw:uppercase tw:tracking-wide">กำไรโดยประมาณ</div>
                      <div class="tw:text-2xl tw:font-bold tw:mt-1" :style="{ color: sellPrice - costPrice >= 0 ? '#16a34a' : '#dc2626' }">
                        {{ sellPrice - costPrice >= 0 ? '+' : '' }}{{ (sellPrice - costPrice).toLocaleString('th-TH') }} ฿
                      </div>
                    </div>
                    <div v-if="costPrice > 0" class="tw:border-l tw:border-orange-200 tw:pl-6">
                      <div class="tw:text-xs tw:font-semibold tw:text-slate-500 tw:uppercase tw:tracking-wide">Margin</div>
                      <div class="tw:text-lg tw:font-bold tw:mt-1 tw:text-slate-700">
                        {{ ((sellPrice - costPrice) / costPrice * 100).toFixed(1) }}%
                      </div>
                    </div>
                  </div>
                </v-col>

              </v-row>
            </div>
          </div>
        </v-col>

        <v-col cols="12">
          <div class="rbc-card tw:mb-6">
            <div class="rbc-card__header">
              <div class="rbc-card__title"><v-icon size="16" color="primary">mdi-text-box-outline</v-icon>รายละเอียดเพิ่มเติม</div>
            </div>
            <div class="rbc-card__body">
              <v-row>
                <v-col cols="12">
                  <slot name="before-details" />
                </v-col>

                <v-col cols="12">
                  <div class="text-body-2 font-weight-medium mb-2">รูปสินค้า</div>
                  <div class="text-caption text-medium-emphasis mb-4">{{ imageHint }}</div>
                  <form-vee-file-input
                    name="image_files"
                    label="เลือกรูปสินค้า"
                    variant="outlined"
                    accept="image/*"
                    hint="แนะนำภาพสี่เหลี่ยมจัตุรัส ความละเอียดไม่เกิน 1600 x 1600 px และขนาดไฟล์ไม่เกิน 10 MB"
                    persistent-hint
                    multiple
                    :max-size="10000000"
                    :max-files="10"
                    :preview-urls="previewUrls"
                    sortable
                    removable
                    @update:model-value="emit('select-images', $event)"
                    @reorder-previews="emit('reorder-previews', $event)"
                    @remove-preview="emit('remove-preview', $event)"
                  />
                </v-col>

                <v-col cols="12">
                  <form-vee-text-area
                    name="seo_description"
                    label="คำอธิบายสำหรับ SEO"
                    variant="outlined"
                    rows="3"
                    auto-grow
                    hide-details="auto"
                  />
                </v-col>

                <v-col cols="12">
                  <form-vee-text-field
                    name="seo_image"
                    label="ลิงก์รูปสำหรับ SEO"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                  />
                </v-col>

                <v-col cols="12">
                  <form-vee-text-area
                    name="defect_detail"
                    label="รายละเอียดตำหนิ *"
                    variant="outlined"
                    rows="5"
                    auto-grow
                    hide-details="auto"
                  />
                </v-col>

                <v-col cols="12">
                  <form-vee-text-area
                    name="free_gift_detail"
                    label="ของแถม"
                    variant="outlined"
                    rows="5"
                    auto-grow
                    hide-details="auto"
                  />
                </v-col>

              </v-row>
            </div>
          </div>
        </v-col>
      </v-row>
    </template>
  </div>

  <div class="rbc-form-sticky-bar">
    <div class="rbc-form-sticky-bar__inner">
      <v-btn variant="outlined" color="grey-darken-1" rounded="lg" @click="emit('cancel')">ยกเลิก</v-btn>
      <v-btn class="rbc-btn-primary" rounded="lg" :loading="saveLoading" :disabled="saveDisabled" @click="emit('submit')">{{ saveLabel || 'บันทึก' }}</v-btn>
    </div>
  </div>
</template>

<style scoped>
.rbc-form-sticky-bar {
  position: sticky;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-top: 1px solid #f1f5f9;
  padding: 12px 0;
  z-index: 10;
}
.rbc-form-sticky-bar__inner {
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 0 24px;
}
</style>
