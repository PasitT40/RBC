<script setup lang="ts">
import { useField } from "vee-validate"

defineOptions({ inheritAttrs: false })

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    default: "",
  },
  items: Array,
})

const { value, errorMessage, handleChange } =
  useField(() => props.name)
</script>

<template>
<div class="rbc-form-field">
  <label v-if="label" class="rbc-form-field__label">{{ label }}</label>
  <v-select
    v-bind="$attrs"
    :items="items"
    :model-value="value"
    @update:model-value="handleChange"
    :error-messages="errorMessage"
    variant="outlined"
    hide-details="auto"
    density="compact"
  />
</div>
</template>
