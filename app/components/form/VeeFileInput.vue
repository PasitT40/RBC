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
  (e: "update:model-value", value: File | Blob | File[] | null): void
  (e: "reorder-previews", value: string[]): void
  (e: "remove-preview", index: number): void
}>()

const appToast = useAppToast()
const { errorMessage, handleChange, setErrors } = useField(() => props.name)

const { processImage } = useImageUpload()

const selectedFiles = ref<File[]>([])
const selectedBlobs = ref<(Blob | null)[]>([])
const previews = ref<string[]>([])
const existingPreviews = ref<string[]>([])
const progress = ref<number[]>([])
const previewDialog = ref(false)
const activePreviewIndex = ref(0)
const dragIndex = ref<number | null>(null)
const processing = ref(false)
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
    // Emit blobs (processed WebP/PNG) when constraint is provided
    const blobs = selectedBlobs.value.filter((b): b is Blob => b !== null)
    const nextValue = props.multiple ? blobs : (blobs[0] ?? null)
    handleChange(nextValue)
    emit("update:model-value", nextValue)
  } else {
    const nextValue = props.multiple ? [...selectedFiles.value] : (selectedFiles.value[0] ?? null)
    handleChange(nextValue)
    emit("update:model-value", nextValue)
  }
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
  selectedBlobs.value = []
  constraintWarning.value = undefined
  constraintError.value = undefined

  processing.value = props.constraint !== undefined && fileArray.length > 0

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
        processing.value = false
        return
      }
      if (result.warning) {
        constraintWarning.value = result.warning
      }
      selectedFiles.value.push(file)
      selectedBlobs.value.push(result.blob)
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

  processing.value = false
  emitSelectedFiles()
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
    const nextPreviews = [...previews.value]
    const nextProgress = [...progress.value]
    const [movedFile] = nextFiles.splice(fromIndex, 1)
    const [movedPreview] = nextPreviews.splice(fromIndex, 1)
    const [movedProgress] = nextProgress.splice(fromIndex, 1)

    if (!movedFile || movedPreview === undefined || movedProgress === undefined) {
      dragIndex.value = null
      return
    }

    nextFiles.splice(index, 0, movedFile)
    nextPreviews.splice(index, 0, movedPreview)
    nextProgress.splice(index, 0, movedProgress)

    selectedFiles.value = nextFiles
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
<div
  class="vee-file-drop"
  @drop="onDrop"
  @dragover="onDragOver"
>

  <!-- Constraint label shown inside the upload zone -->
  <div v-if="constraint" class="constraint-label">
    {{ constraint.label }}
  </div>

  <v-file-input
    :variant="variant"
    :label="label"
    :hint="hint"
    :persistent-hint="Boolean(hint)"
    :accept="accept"
    :multiple="multiple"
    :error-messages="errorMessage"
    :disabled="processing"
    @update:model-value="handleFiles"
  />

  <!-- Processing spinner -->
  <div v-if="processing" class="processing-state">
    <v-progress-circular indeterminate color="primary" size="24" />
    <span class="processing-label">กำลังประมวลผลรูปภาพ...</span>
  </div>

  <!-- Constraint warning (orange, non-blocking) -->
  <div v-if="constraintWarning && !processing" class="constraint-warning">
    <v-icon size="16" color="warning">mdi-alert</v-icon>
    {{ constraintWarning }}
  </div>

  <!-- Constraint error (red, blocking) -->
  <div v-if="constraintError && !processing" class="constraint-error">
    <v-icon size="16" color="error">mdi-alert-circle</v-icon>
    {{ constraintError }}
  </div>

  <div v-if="displayItems.length && !processing" class="preview-grid">
    <div
      v-for="(item, i) in displayItems"
      :key="`${item.source}-${item.src}-${i}`"
      class="preview-item"
      @dragover.prevent.stop
      @drop.stop="onPreviewDrop(i, $event)"
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
    </div>
  </div>

  <v-dialog v-model="previewDialog" max-width="960">
    <v-card rounded="xl">
      <div class="dialog-toolbar">
        <div class="dialog-title">Image Preview</div>
        <v-btn icon variant="text" color="black" @click="closePreview">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </div>
      <div class="dialog-body">
        <img
          v-if="activePreviewItem"
          :src="activePreviewItem.src"
          class="dialog-image"
        >
      </div>
    </v-card>
  </v-dialog>
</div>
</template>

<style scoped>

.vee-file-drop{
  border:2px dashed #ddd;
  padding:16px;
  border-radius:8px;
}

.preview-grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,120px);
  gap:12px;
  margin-top:12px;
}

.preview-item{
  position:relative;
}

.constraint-label {
  font-size: 12px;
  color: #555;
  margin-bottom: 8px;
  font-weight: 500;
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
  font-size: 13px;
  color: #e65100;
}

.constraint-error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 13px;
  color: #c62828;
}

.preview-button{
  display:block;
  width:120px;
  border:0;
  background:transparent;
  padding:0;
  cursor:pointer;
  /* aspect-ratio set via inline style when constraint present */
}

.preview-item img{
  width:120px;
  height:120px;
  object-fit:cover;
  border-radius:8px;
  /* aspect-ratio set via inline style when constraint present; height auto-follows */
}

.preview-meta{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  margin-top:4px;
}

.preview-meta-left{
  display:flex;
  align-items:center;
  gap:6px;
}

.current-label {
  font-size: 11px;
  color: #888;
}

.drag-handle{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:24px;
  height:24px;
  border:0;
  border-radius:999px;
  background:#f1f1f1;
  color:#333;
  cursor:grab;
}

.drag-handle:active{
  cursor:grabbing;
}

.remove-btn{
  flex-shrink:0;
}

.dialog-toolbar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:12px 16px;
  border-bottom:1px solid rgba(0,0,0,.08);
}

.dialog-title{
  font-size:16px;
  font-weight:600;
}

.dialog-body{
  display:flex;
  justify-content:center;
  align-items:center;
  padding:16px;
  background:#111;
  min-height:360px;
}

.dialog-image{
  max-width:100%;
  max-height:70vh;
  object-fit:contain;
}

</style>
