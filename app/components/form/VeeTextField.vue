<script setup lang="ts">
import { computed, watch } from "vue"
import { useField } from "vee-validate"

defineOptions({ inheritAttrs:false })

const props = defineProps({
  name: {
    type: String,
    required: false
  }
})

const modelValue = defineModel<string | number | null>({
  default: null,
})

const hasFieldName = computed(() => Boolean(props.name))
const field = props.name
  ? useField<string | number | null>(() => props.name as string)
  : null

const inputValue = computed<string | number | null>({
  get() {
    if (hasFieldName.value && field) {
      return field.value.value
    }
    return modelValue.value
  },
  set(nextValue) {
    modelValue.value = nextValue
    if (hasFieldName.value && field) {
      field.handleChange(nextValue)
    }
  },
})

watch(modelValue, (nextValue) => {
  if (!hasFieldName.value || !field) return
  if (field.value.value !== nextValue) {
    field.handleChange(nextValue)
  }
}, { immediate: true })

if (field) {
  watch(field.value, (nextValue) => {
    if (modelValue.value !== nextValue) {
      modelValue.value = nextValue
    }
  })
}

const errorMessage = computed(() => {
  if (!hasFieldName.value || !field) return undefined
  return field.errorMessage.value
})
</script>

<template>

<v-text-field
  v-bind="$attrs"
  v-model="inputValue"
  :error-messages="errorMessage"
/>

</template>
