<script setup lang="ts">
import { useField } from "vee-validate"

const props = defineProps({
  name: {
    type: String,
    required: true
  }
})

const { value, handleChange } =
  useField(() => props.name)
</script>

<template>

<v-checkbox
  v-bind="$attrs"
  :model-value="value"
  @update:model-value="handleChange"
/>

</template>