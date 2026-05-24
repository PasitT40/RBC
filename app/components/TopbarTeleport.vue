<script setup lang="ts">
const props = defineProps<{
  to: string;
}>();

const route = useRoute();
const mounted = ref(false);
const targetReady = ref(false);

const refreshTarget = () => {
  if (!import.meta.client) return;
  targetReady.value = Boolean(document.querySelector(props.to));
};

onMounted(async () => {
  mounted.value = true;
  await nextTick();
  refreshTarget();
});

watch(
  () => [route.fullPath, props.to],
  async () => {
    targetReady.value = false;
    await nextTick();
    refreshTarget();
  },
  { flush: "post" }
);

onBeforeUnmount(() => {
  targetReady.value = false;
});
</script>

<template>
  <Teleport v-if="mounted && targetReady" :to="to">
    <slot />
  </Teleport>
</template>
