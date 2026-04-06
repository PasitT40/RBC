<script setup lang="ts">
import { computed } from "vue";
import { useField } from "vee-validate";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
  name?: string;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
}>(), {
  name: undefined,
  min: 0,
  max: 5,
  step: 0.5,
  label: "",
});

const modelValue = defineModel<number | null>({
  default: null,
});

const hasFieldName = computed(() => Boolean(props.name));
const field = props.name
  ? useField<number | null>(() => props.name as string)
  : null;

const clampValue = (value: number) => Math.min(props.max, Math.max(props.min, value));
const roundToStep = (value: number) => Math.round(value / props.step) * props.step;

const numericValue = computed<number>({
  get() {
    const rawValue = hasFieldName.value && field ? field.value.value : modelValue.value;
    const nextValue = typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : props.min;
    return clampValue(roundToStep(nextValue));
  },
  set(nextValue) {
    const normalized = clampValue(roundToStep(nextValue));
    if (hasFieldName.value && field) {
      field.handleChange(normalized);
      return;
    }
    modelValue.value = normalized;
  },
});

const displayValue = computed(() => numericValue.value.toFixed(1));
const decrementDisabled = computed(() => numericValue.value <= props.min);
const incrementDisabled = computed(() => numericValue.value >= props.max);
const errorMessage = computed(() => {
  if (!hasFieldName.value || !field) return undefined;
  return field.errorMessage.value;
});

const decrement = () => {
  numericValue.value = numericValue.value - props.step;
};

const increment = () => {
  numericValue.value = numericValue.value + props.step;
};
</script>

<template>
  <div class="vee-number-stepper">
    <div v-if="props.label" class="text-body-2 font-weight-medium mb-2">{{ props.label }}</div>
    <div class="vee-number-stepper__controls">
      <v-btn
        icon="mdi-minus"
        variant="outlined"
        color="grey-darken-1"
        :disabled="decrementDisabled"
        @click="decrement"
      />
      <v-text-field
        v-bind="$attrs"
        :model-value="displayValue"
        readonly
        hide-details
        variant="outlined"
        density="comfortable"
        class="vee-number-stepper__field"
      />
      <v-btn
        icon="mdi-plus"
        variant="outlined"
        color="grey-darken-1"
        :disabled="incrementDisabled"
        @click="increment"
      />
    </div>
    <div class="text-caption text-medium-emphasis mt-2">
      ปรับได้ตั้งแต่ {{ props.min.toFixed(1) }} ถึง {{ props.max.toFixed(1) }} ทีละ {{ props.step.toFixed(1) }}
    </div>
    <div v-if="errorMessage" class="text-caption text-error mt-1">{{ errorMessage }}</div>
  </div>
</template>

<style scoped>
.vee-number-stepper__controls {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
}

.vee-number-stepper__field :deep(input) {
  text-align: center;
  font-weight: 700;
}
</style>
