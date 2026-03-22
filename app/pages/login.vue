<script setup lang="ts">
import { useAuthFirebase } from "~/composables/useAuthFirebase";

definePageMeta({ layout: "login" });
const { loading, error, signInWithGoogle, checkRedirectResult } = useAuthFirebase();
const route = useRoute();
const deniedMessage = computed(() =>
  route.query.denied === "1" ? "This account does not have backoffice access" : ""
);

const handleGoogleSignIn = () => {
  if (loading.value) return;
  signInWithGoogle();
};

onMounted(() => {
  checkRedirectResult();
});
</script>

<template>
  <div class="tw:bg-white tw:rounded-[24px] tw:p-10! tw:w-full tw:max-w-[600px] tw:max-h-[600px] tw:flex tw:flex-col tw:items-center tw:shadow-lg">
    <div class="tw:w-24 tw:h-24 tw:bg-gray-300 tw:rounded-full tw:mb-8"></div>

    <v-alert
      v-if="error || deniedMessage"
      type="error"
      variant="tonal"
      density="comfortable"
      class="tw:mb-4 tw:w-full"
    >
      {{ error || deniedMessage }}
    </v-alert>

    <div
      class="tw:w-full tw:border tw:p-5! tw:rounded-full tw:flex tw:items-center tw:justify-center tw:gap-2 tw:mt-5! tw:transition-opacity"
      :class="loading ? 'tw:cursor-not-allowed tw:opacity-60' : 'tw:cursor-pointer'"
      @click="handleGoogleSignIn"
    >
        <img src="/img/ext-google.png" alt="Continue with Google" class="tw:mx-auto tw:h-10">
        <span class="tw:text-black tw:font-bold tw:text-xl">Log in with google</span>
    </div>
  </div>
</template>
