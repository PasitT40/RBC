<script setup lang="ts">
import { computed } from "vue"
import { useField } from "vee-validate"

const props = defineProps<{
  name?: string
}>()

const modelValue = defineModel<boolean>({
  type: Boolean,
  default: false,
})

const hasFieldName = computed(() => Boolean(props.name))
const field = props.name
  ? useField<boolean>(() => props.name as string)
  : null

const switchValue = computed<boolean>({
  get() {
    if (hasFieldName.value && field) {
      return Boolean(field.value.value)
    }
    return Boolean(modelValue.value)
  },
  set(nextValue) {
    if (hasFieldName.value && field) {
      field.handleChange(nextValue)
      return
    }
    modelValue.value = nextValue
  },
})

const errorMessage = computed(() => {
  if (!hasFieldName.value || !field) return undefined
  return field.errorMessage.value
})
</script>

<template>

<v-switch
  v-bind="$attrs"
  v-model="switchValue"
  :error-messages="errorMessage"
/>

</template>
