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
}>();

const emit = defineEmits<{
  (e: "cancel"): void;
  (e: "submit"): void;
  (e: "refresh-taxonomy"): void;
  (e: "select-images", value: File | File[] | null): void;
  (e: "reorder-previews", value: string[]): void;
  (e: "remove-preview", index: number): void;
}>();

const hasWarning = computed(() => Boolean(props.publishActive && props.publicReadinessIssues?.length));
const hasHiddenInfo = computed(() => props.publishActive === false && Boolean(props.hiddenInfoMessage));
</script>

<template>
  <v-container fluid class="pa-6">
    <v-row justify="center">
      <v-col cols="10">
        <v-row align="center" class="mb-6">
          <v-col cols="7">
            <div class="text-h4 font-weight-black">{{ title }}</div>
            <div class="text-body-2 text-medium-emphasis">กรอกข้อมูลหลักให้ครบ แล้วค่อยเปิดขายบนหน้าเว็บเมื่อพร้อม</div>
          </v-col>

        </v-row>

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

            <v-col cols="12" class="mb-6">
              <v-card rounded="xl" elevation="0">
                <v-card-item>
                  <v-card-title>ข้อมูลหลัก</v-card-title>
                  <v-card-subtitle>ใช้สำหรับขาย ค้นหา และแสดงผลบนหน้าเว็บ</v-card-subtitle>
                </v-card-item>
                <v-card-text>
                  <v-row>
                    <v-col cols="6">
                      <form-vee-text-field
                        name="name"
                        label="ชื่อสินค้า *"
                        variant="outlined"
                        density="comfortable"
                        hide-details="auto"
                      />
                    </v-col>

                    <v-col cols="6">
                      <form-vee-text-field
                        name="seo_title"
                        label="ชื่อสำหรับ SEO"
                        variant="outlined"
                        density="comfortable"
                        hide-details="auto"
                      />
                    </v-col>

                    <v-col cols="6">
                      <slot name="top-aside">
                        <v-sheet rounded="lg" color="grey-lighten-4" class="pa-4 fill-height">
                          <div class="text-body-2 font-weight-medium">{{ seoFallbackHint }}</div>
                          <div class="text-caption text-medium-emphasis">SKU: {{ skuValue || "ระบบจะสร้างให้อัตโนมัติเมื่อบันทึก" }}</div>
                          <div class="text-caption text-medium-emphasis">ลิงก์สินค้าที่ระบบจะสร้างให้: {{ slugPreview || "-" }}</div>
                        </v-sheet>
                      </slot>
                    </v-col>
                    <v-col cols="6">
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



                    <v-col cols="6">
                      <form-vee-number-stepper
                        name="condition"
                        label="คุณภาพสินค้า *"
                        :min="0"
                        :max="5"
                        :step="0.5"
                      />
                    </v-col>


                    <v-col cols="6" class="d-flex tw:items-center" >
                      <form-vee-text-field 
                        name="shutter"
                        label="จำนวนชัตเตอร์"
                        variant="outlined"
                        density="comfortable"
                        type="text"
                        hide-details="auto"
                      />
                    </v-col>


                    <v-col cols="6">
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

                    <v-col cols="6">
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

                  </v-row>
                </v-card-text>
              </v-card>
            </v-col>

            <v-col cols="12">
              <v-card rounded="xl" elevation="0">
                <v-card-item>
                  <v-card-title>รายละเอียดเพิ่มเติม</v-card-title>
                  <v-card-subtitle>ช่วยให้ข้อมูลสินค้าครบขึ้น ทั้งสำหรับลูกค้าและทีมงานหลังบ้าน</v-card-subtitle>
                </v-card-item>
                <v-card-text>
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
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </template>

          <v-col cols="12">
            <v-row dense justify="end">
              <v-col cols="1">
                <v-btn
                  block
                  variant="outlined"
                  color="black"
                  rounded="pill"
                  @click="emit('cancel')"
                >
                  ยกเลิก
                </v-btn>
              </v-col>
              <v-col cols="1">
                <v-btn
                  block
                  color="#f5962f"
                  class="text-white"
                  rounded="pill"
                  :loading="saveLoading"
                  :disabled="saveDisabled"
                  @click="emit('submit')"
                >
                  {{ saveLabel || "บันทึก" }}
                </v-btn>
              </v-col>
            </v-row>
          </v-col>
      </v-col>
    </v-row>
  </v-container>
</template>
