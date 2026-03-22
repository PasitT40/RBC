<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { useField } from "vee-validate"

interface Props {
  name: string
  label?: string
  accept?: string
  multiple?: boolean
  maxSize?: number
  maxFiles?: number
  previewUrl?: string   // URL รูปเดิม (ใช้ตอน edit mode)
  previewUrls?: string[]
  sortable?: boolean
  removable?: boolean
  variant?:  "outlined" | "filled" | "plain" | "solo" | "solo-filled" | "solo-inverted" | "underlined" | undefined
}

const props = withDefaults(defineProps<Props>(), {
  accept: "image/*",
  multiple: false,
  maxSize: 2000000,
  maxFiles: 1,
  previewUrl: undefined,
  previewUrls: () => [],
  sortable: false,
  removable: false,
  variant: "outlined"
})

const emit = defineEmits<{
  (e: "update:model-value", value: File | File[] | null): void
  (e: "reorder-previews", value: string[]): void
  (e: "remove-preview", index: number): void
}>()

const { errorMessage, handleChange } = useField(() => props.name)

const selectedFiles = ref<File[]>([])
const previews = ref<string[]>([])
const existingPreviews = ref<string[]>([])
const progress = ref<number[]>([])
const previewDialog = ref(false)
const activePreviewIndex = ref(0)
const dragIndex = ref<number | null>(null)

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
  const nextValue = props.multiple ? [...selectedFiles.value] : (selectedFiles.value[0] ?? null)
  handleChange(nextValue)
  emit("update:model-value", nextValue)
}

function handleFiles(files: File | File[] | FileList | null) {
  const fileArray = Array.isArray(files)
    ? files
    : files instanceof FileList
      ? Array.from(files)
      : files instanceof File
        ? [files]
        : []

  if (fileArray.length > props.maxFiles) {
    alert(`Maximum ${props.maxFiles} files`)
    return
  }

  revokePreviews()
  previews.value = []
  progress.value = []
  selectedFiles.value = []

  fileArray.forEach((file, index) => {
    if (file.size > props.maxSize) {
      alert(`${file.name} too large`)
      return
    }

    selectedFiles.value.push(file)
    previews.value.push(URL.createObjectURL(file))
    progress.value.push(0)

    simulateUpload(index)
  })

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

  <v-file-input
    :variant="variant"
    :label="label"
    :accept="accept"
    :multiple="multiple"
    :error-messages="errorMessage"
    @update:model-value="handleFiles"
  />

  <div v-if="displayItems.length" class="preview-grid">
    <div
      v-for="(item, i) in displayItems"
      :key="`${item.source}-${item.src}-${i}`"
      class="preview-item"
      @dragover.prevent.stop
      @drop.stop="onPreviewDrop(i, $event)"
    >
      <button type="button" class="preview-button" @click="openPreview(i)">
        <img 
          draggable="true"
          @dragstart="onPreviewDragStart(i)"
          class="preview-image" :src="item.src" />
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

.preview-button{
  display:block;
  width:120px;
  border:0;
  background:transparent;
  padding:0;
  cursor:pointer;
}

.preview-item img{
  width:120px;
  height:120px;
  object-fit:cover;
  border-radius:8px;
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
