<script setup lang="ts">
import { useField } from "vee-validate"

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  items: Array
})

const { value, errorMessage, handleChange } =
  useField(() => props.name)
</script>

<template>

<v-select
  v-bind="$attrs"
  :items="items"
  :model-value="value"
  @update:model-value="handleChange"
  :error-messages="errorMessage"
/>

</template>