<script setup lang="ts">
import { useField } from "vee-validate"

const props = defineProps({
  name: {
    type: String,
    required: true
  }
})

const { value, errorMessage, handleChange } =
  useField(() => props.name)
</script>

<template>

<v-textarea
  v-bind="$attrs"
  :model-value="value"
  @update:model-value="handleChange"
  :error-messages="errorMessage"
/>

</template>