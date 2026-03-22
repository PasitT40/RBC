<script setup lang="ts">
interface Props {
  title?: string
  width?: number | string
  persistent?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  width: 500,
  persistent: false
})

const modelValue = defineModel('modelValue', {
  type: Boolean,
  default: false
})

function close() {
  modelValue.value = false
}
</script>

<template>
<v-dialog
  :model-value="modelValue"
  :width="width"
  :persistent="persistent"
  @update:model-value="modelValue = $event"
>

  <v-card class="pa-5 tw:gap-5">
    <div v-if="title">
      <span class="tw:text-xl tw:font-bold">{{ title }}</span>
    </div>
    <div>
      <slot />
    </div>
    <div class="tw:flex tw:justify-end tw:gap-2">
      <slot name="actions" />
    </div>
  </v-card>

</v-dialog>
</template>