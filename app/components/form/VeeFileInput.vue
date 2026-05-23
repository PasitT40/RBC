<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { useField } from "vee-validate"
import type { ImageConstraint } from "~/composables/useImageUpload"
import { useImageUpload } from "~/composables/useImageUpload"

interface Props {
  name: string
  label?: string
  hint?: string
  accept?: string
  multiple?: boolean
  maxSize?: number
  maxFiles?: number
  aspectRatio?: number
  aspectRatioLabel?: string
  previewUrl?: string   // URL รูปเดิม (ใช้ตอน edit mode)
  previewUrls?: string[]
  sortable?: boolean
  removable?: boolean
  variant?:  "outlined" | "filled" | "plain" | "solo" | "solo-filled" | "solo-inverted" | "underlined" | undefined
  constraint?: ImageConstraint
}

const props = withDefaults(defineProps<Props>(), {
  accept: "image/*",
  multiple: false,
  maxSize: 2000000,
  maxFiles: 1,
  aspectRatio: undefined,
  aspectRatioLabel: "",
  previewUrl: undefined,
  previewUrls: () => [],
  sortable: false,
  removable: false,
  variant: "outlined",
  constraint: undefined,
})

const emit = defineEmits<{
  (e: "update:model-value", value: File | File[] | null): void
  (e: "reorder-previews", value: string[]): void
  (e: "remove-preview", index: number): void
}>()

const appToast = useAppToast()
const { errorMessage, handleChange, setErrors } = useField(() => props.name)

const { processImage } = useImageUpload()

const selectedFiles = ref<File[]>([])
const processedFiles = ref<File[]>([])
const previews = ref<string[]>([])
const existingPreviews = ref<string[]>([])
const progress = ref<number[]>([])
const previewDialog = ref(false)
const activePreviewIndex = ref(0)
const dragIndex = ref<number | null>(null)
const processingCount = ref(0)
const constraintWarning = ref<string | undefined>(undefined)
const constraintError = ref<string | undefined>(undefined)

// Compute preview aspect ratio from constraint if provided
const previewAspectRatio = computed(() => {
  if (props.constraint) return props.constraint.width / props.constraint.height
  if (props.aspectRatio) return props.aspectRatio
  return 1
})

const normalizedExistingPreviews = computed(() => {
  const urls = props.previewUrls.length ? props.previewUrls : props.previewUrl ? [props.previewUrl] : []
  return urls.filter(Boolean)
})

const displayItems = computed(() => {
  if (previews.value.length) {
    return previews.value.map((src) => ({ src, source: "selected" as const }))
  }

  return existingPreviews.value.map((src) => ({ src, source: "existing" as const }))
})

const activePreviewItem = computed(() => displayItems.value[activePreviewIndex.value] ?? null)

const formatBytes = (bytes: number) => {
  if (bytes >= 1000 * 1000) return `${(bytes / (1000 * 1000)).toFixed(1)} MB`
  if (bytes >= 1000) return `${Math.round(bytes / 1000)} KB`
  return `${bytes} B`
}

watch(
  normalizedExistingPreviews,
  (urls) => {
    existingPreviews.value = [...urls]
  },
  { immediate: true }
)

function revokePreviews() {
  previews.value.forEach((src) => URL.revokeObjectURL(src))
}

function emitSelectedFiles() {
  if (props.constraint) {
    const nextValue = props.multiple ? [...processedFiles.value] : (processedFiles.value[0] ?? null)
    handleChange(nextValue)
    emit("update:model-value", nextValue)
  } else {
    const nextValue = props.multiple ? [...selectedFiles.value] : (selectedFiles.value[0] ?? null)
    handleChange(nextValue)
    emit("update:model-value", nextValue)
  }
}

function createProcessedFile(sourceFile: File, blob: Blob) {
  const fileStem = sourceFile.name.replace(/\.[^.]+$/, "") || "image"
  const extension =
    blob.type === "image/png"
      ? "png"
      : blob.type === "image/webp"
        ? "webp"
        : sourceFile.name.split(".").pop() || "jpg"

  return new File([blob], `${fileStem}.${extension}`, {
    type: blob.type || sourceFile.type,
    lastModified: sourceFile.lastModified,
  })
}

const getImageDimensions = (file: File): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
      URL.revokeObjectURL(objectUrl)
    }

    image.onerror = () => {
      reject(new Error("invalid-image"))
      URL.revokeObjectURL(objectUrl)
    }

    image.src = objectUrl
  })

const isAspectRatioAllowed = (width: number, height: number) => {
  if (!props.aspectRatio) return true
  const ratio = width / height
  return Math.abs(ratio - props.aspectRatio) <= 0.03
}

async function handleFiles(files: File | File[] | FileList | null) {
  const fileArray = Array.isArray(files)
    ? files
    : files instanceof FileList
      ? Array.from(files)
      : files instanceof File
        ? [files]
        : []

  if (fileArray.length > props.maxFiles) {
    appToast.error(`เลือกได้สูงสุด ${props.maxFiles} ไฟล์`)
    return
  }

  revokePreviews()
  previews.value = []
  progress.value = []
  selectedFiles.value = []
  processedFiles.value = []
  constraintWarning.value = undefined
  constraintError.value = undefined

  if (props.constraint !== undefined && fileArray.length > 0) {
    processingCount.value++
  }

  try {
    for (const [index, file] of fileArray.entries()) {
      // Skip size check when constraint is provided — processImage handles sizing
      if (!props.constraint && file.size > props.maxSize) {
        appToast.error(`${file.name} มีขนาดใหญ่เกินไป ระบบรองรับไม่เกิน ${formatBytes(props.maxSize)}`)
        continue
      }

      if (props.constraint) {
        // Process via constraint — resize, crop, convert
        const result = await processImage(file, props.constraint)
        if (!result.ok || !result.blob) {
          constraintError.value = result.error ?? "ประมวลผลรูปภาพไม่สำเร็จ"
          setErrors(constraintError.value)
          return
        }
        if (result.warning) {
          constraintWarning.value = result.warning
        }
        selectedFiles.value.push(file)
        processedFiles.value.push(createProcessedFile(file, result.blob))
        const previewUrl = URL.createObjectURL(result.blob)
        previews.value.push(previewUrl)
        progress.value.push(0)
      } else {
        if (props.aspectRatio) {
          try {
            const { width, height } = await getImageDimensions(file)
            if (!isAspectRatioAllowed(width, height)) {
              const ratioLabel = props.aspectRatioLabel || props.aspectRatio.toFixed(2)
              appToast.error(`${file.name} สัดส่วนภาพไม่ถูกต้อง กรุณาใช้สัดส่วน ${ratioLabel}`)
              continue
            }
          } catch {
            appToast.error(`${file.name} ไม่สามารถอ่านขนาดรูปได้ กรุณาเลือกไฟล์ภาพใหม่`)
            continue
          }
        }
        selectedFiles.value.push(file)
        previews.value.push(URL.createObjectURL(file))
        progress.value.push(0)
      }

      simulateUpload(index)
    }

    emitSelectedFiles()
  } finally {
    if (props.constraint !== undefined && fileArray.length > 0) {
      processingCount.value--
    }
  }
}

function simulateUpload(index:number) {
  const interval = setInterval(() => {
    if (progress.value[index] !== undefined) {
      progress.value[index] += 10
      if (progress.value[index] >= 100) {
        clearInterval(interval)
      }
    }
  }, 200)
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  if (dragIndex.value !== null) return
  const files = Array.from(e.dataTransfer?.files || [])
  if (!files.length) return
  handleFiles(files)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
}

function openPreview(index: number) {
  activePreviewIndex.value = index
  previewDialog.value = true
}

function closePreview() {
  previewDialog.value = false
}

function onPreviewDragStart(index: number) {
  if (!props.sortable || displayItems.value.length <= 1) return
  dragIndex.value = index
}

function onPreviewDrop(index: number, e: DragEvent) {
  e.preventDefault()
  if (!props.sortable || dragIndex.value === null || dragIndex.value === index) {
    dragIndex.value = null
    return
  }

  const fromIndex = dragIndex.value

  if (previews.value.length) {
    const nextFiles = [...selectedFiles.value]
    const nextProcessedFiles = [...processedFiles.value]
    const nextPreviews = [...previews.value]
    const nextProgress = [...progress.value]
    const [movedFile] = nextFiles.splice(fromIndex, 1)
    const [movedProcessedFile] = nextProcessedFiles.splice(fromIndex, 1)
    const [movedPreview] = nextPreviews.splice(fromIndex, 1)
    const [movedProgress] = nextProgress.splice(fromIndex, 1)

    if (
      !movedFile ||
      movedPreview === undefined ||
      movedProgress === undefined ||
      (props.constraint && !movedProcessedFile)
    ) {
      dragIndex.value = null
      return
    }

    nextFiles.splice(index, 0, movedFile)
    if (movedProcessedFile) {
      nextProcessedFiles.splice(index, 0, movedProcessedFile)
    }
    nextPreviews.splice(index, 0, movedPreview)
    nextProgress.splice(index, 0, movedProgress)

    selectedFiles.value = nextFiles
    processedFiles.value = nextProcessedFiles
    previews.value = nextPreviews
    progress.value = nextProgress
    emitSelectedFiles()
  } else {
    const nextExisting = [...existingPreviews.value]
    const [movedPreview] = nextExisting.splice(fromIndex, 1)
    if (movedPreview === undefined) {
      dragIndex.value = null
      return
    }
    nextExisting.splice(index, 0, movedPreview)
    existingPreviews.value = nextExisting
    emit("reorder-previews", nextExisting)
  }

  dragIndex.value = null
}

function removePreview(index: number) {
  if (previews.value.length) {
    const [removedPreview] = previews.value.splice(index, 1)
    selectedFiles.value.splice(index, 1)
    if (processedFiles.value.length > index) {
      processedFiles.value.splice(index, 1)
    }
    progress.value.splice(index, 1)
    if (removedPreview) URL.revokeObjectURL(removedPreview)
    emitSelectedFiles()
    return
  }

  existingPreviews.value = existingPreviews.value.filter((_, itemIndex) => itemIndex !== index)
  emit("remove-preview", index)
}

onBeforeUnmount(() => {
  revokePreviews()
})
</script>

<template>
<div class="rbc-form-field">
  <label v-if="label" class="rbc-form-field__label">{{ label }}</label>

  <div
    class="rbc-upload-zone"
    :class="{ 'rbc-upload-zone--error': errorMessage }"
    @drop="onDrop"
    @dragover="onDragOver"
  >
    <!-- Constraint label -->
    <div v-if="constraint" class="rbc-upload-zone__constraint">{{ constraint.label }}</div>

    <!-- Custom visible zone content -->
    <div class="rbc-upload-zone__body">
      <v-icon size="32" color="#ea580c">mdi-camera</v-icon>
      <div class="rbc-upload-zone__cta">คลิกเลือก หรือลากรูปมาวาง</div>
      <div class="rbc-upload-zone__hint">{{ hint || `PNG, JPG · สูงสุด ${formatBytes(maxSize)} ต่อไฟล์` }}</div>
    </div>

    <!-- Invisible file input covering the entire zone for click-to-browse -->
    <v-file-input
      class="rbc-upload-zone__input"
      :accept="accept"
      :multiple="multiple"
      :disabled="processingCount > 0"
      hide-details
      @update:model-value="handleFiles"
    />

    <!-- Processing spinner -->
    <div v-if="processingCount > 0" class="processing-state">
      <v-progress-circular indeterminate color="primary" size="24" />
      <span class="processing-label">กำลังประมวลผลรูปภาพ...</span>
    </div>

    <!-- Constraint warning -->
    <div v-if="constraintWarning && processingCount === 0" class="constraint-warning">
      <v-icon size="16" color="warning">mdi-alert</v-icon>
      {{ constraintWarning }}
    </div>

    <!-- Constraint error -->
    <div v-if="constraintError && processingCount === 0" class="constraint-error">
      <v-icon size="16" color="error">mdi-alert-circle</v-icon>
      {{ constraintError }}
    </div>
  </div>

  <!-- Preview grid lives outside the drop zone -->
  <div v-if="displayItems.length && processingCount === 0" class="preview-grid">
    <div
      v-for="(item, i) in displayItems"
      :key="`${item.source}-${item.src}-${i}`"
      class="preview-item"
      @dragover.prevent.stop
      @drop.prevent.stop="onPreviewDrop(i, $event)"
    >
      <button
        type="button"
        class="preview-button"
        :style="{ aspectRatio: String(previewAspectRatio), height: 'auto' }"
        @click="openPreview(i)"
      >
        <img
          draggable="true"
          @dragstart="onPreviewDragStart(i)"
          class="preview-image"
          :style="{ aspectRatio: String(previewAspectRatio), height: 'auto' }"
          :src="item.src"
        />
      </button>
      <button
        v-if="removable"
        type="button"
        class="remove-overlay-btn"
        @click.stop="removePreview(i)"
      >
        <v-icon size="14" color="white">mdi-close</v-icon>
      </button>
    </div>
  </div>

  <!-- Field error message -->
  <div v-if="errorMessage" class="rbc-upload-zone__error-msg">{{ errorMessage }}</div>

  <v-dialog v-model="previewDialog" max-width="960">
    <v-card rounded="xl">
      <div class="tw:flex tw:items-center tw:justify-between tw:px-6 tw:py-4 tw:border-b tw:border-slate-100">
        <div class="tw:text-[15px] tw:font-semibold tw:text-slate-800">ดูรูปภาพ</div>
        <v-btn icon variant="text" @click="closePreview"><v-icon>mdi-close</v-icon></v-btn>
      </div>
      <div class="tw:flex tw:justify-center tw:items-center tw:p-4 tw:bg-slate-900" style="min-height: 360px;">
        <img v-if="activePreviewItem" :src="activePreviewItem.src" class="dialog-image">
      </div>
    </v-card>
  </v-dialog>
</div>
</template>

<style scoped>

.rbc-upload-zone {
  position: relative;
  border: 2px dashed var(--rbc-orange-200);
  border-radius: 12px;
  background: var(--rbc-orange-50);
  padding: 28px 20px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.rbc-upload-zone--error {
  border-color: var(--rbc-red-600);
  background: #fef2f2;
  box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.10);
}

.rbc-upload-zone__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}

.rbc-upload-zone__cta {
  font-size: 14px;
  font-weight: 700;
  color: var(--rbc-orange-600);
}

.rbc-upload-zone__hint {
  font-size: 12px;
  color: var(--rbc-slate-400);
}

/* Invisible v-file-input overlay — captures clicks anywhere on the zone */
.rbc-upload-zone__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  z-index: 1;
}

.rbc-upload-zone__input :deep(input[type="file"]) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.rbc-upload-zone__error-msg {
  font-size: 12px;
  color: var(--rbc-red-600);
  margin-top: 4px;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 84px);
  gap: 8px;
  margin-top: 12px;
}

.preview-item {
  position: relative;
}

.remove-overlay-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 99px;
  background: rgba(0, 0, 0, 0.55);
  border: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  z-index: 2;
}
.remove-overlay-btn:hover {
  background: rgba(220, 38, 38, 0.85);
}

.processing-state {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  color: #555;
}

.processing-label {
  font-size: 13px;
}

.constraint-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
  color: #e65100;
}

.constraint-error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
  color: #c62828;
}

.preview-button {
  display: block;
  width: 84px;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.preview-item img {
  width: 84px;
  height: 84px;
  object-fit: cover;
  border-radius: 8px;
}

.dialog-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
}

</style>
