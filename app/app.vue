<script setup lang="ts">
const { isLoading, message } = useGlobalLoading();
</script>

<template>
  <VApp>
    <VProgressLinear
      :active="isLoading"
      :indeterminate="isLoading"
      color="#f5962f"
      height="3"
      absolute
      location="top"
    />

    <VOverlay
      :model-value="isLoading"
      persistent
      class="d-flex align-center justify-center"
      scrim="rgba(255, 255, 255, 0.32)"
    >
      <div class="tw:flex tw:min-w-[220px] tw:flex-col tw:items-center tw:gap-4 tw:rounded-2xl tw:bg-white tw:px-8 tw:py-7 tw:shadow-xl">
        <VProgressCircular
          indeterminate
          color="#f5962f"
          size="54"
          width="5"
        />
        <div class="tw:text-sm tw:font-semibold tw:text-neutral-700">{{ message }}</div>
      </div>
    </VOverlay>

    <VMain>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </VMain>
  </VApp>
</template>
