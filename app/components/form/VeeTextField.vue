<script setup lang="ts">
import { computed } from "vue"
import { useField } from "vee-validate"

defineOptions({ inheritAttrs: false })

const props = defineProps({
  name: {
    type: String,
    required: false,
  },
  label: {
    type: String,
    default: "",
  },
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
<div class="rbc-form-field">
  <label v-if="label" class="rbc-form-field__label">{{ label }}</label>
  <v-text-field
    v-bind="$attrs"
    v-model="inputValue"
    :error-messages="errorMessage"
    variant="outlined"
    hide-details="auto"
    density="compact"
  />
</div>
</template>
