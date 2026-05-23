<script setup lang="ts">
interface Props {
  title?: string
  width?: number | string
  persistent?: boolean
  icon?: string
}

const props = withDefaults(defineProps<Props>(), {
  width: 560,
  persistent: false,
  icon: 'mdi-tag-outline',
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
    <div class="rbc-modal">
      <!-- Header -->
      <div class="rbc-modal__header">
        <div class="rbc-modal__header-left">
          <div class="rbc-modal__icon">
            <v-icon :icon="icon" size="18" color="white" />
          </div>
          <span class="rbc-modal__title">{{ title }}</span>
        </div>
        <button class="rbc-modal__close" @click="close">
          <v-icon size="20">mdi-close</v-icon>
        </button>
      </div>

      <!-- Body -->
      <div class="rbc-modal__body">
        <slot />
      </div>

      <!-- Footer -->
      <div class="rbc-modal__footer">
        <slot name="actions" />
      </div>
    </div>
  </v-dialog>
</template>
