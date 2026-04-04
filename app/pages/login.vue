<script setup lang="ts">
import { useAuthFirebase } from "~/composables/useAuthFirebase";

definePageMeta({ layout: "login" });
const { loading, error, signInWithGoogle, checkRedirectResult } = useAuthFirebase();
const route = useRoute();
const deniedMessage = computed(() =>
  route.query.denied === "1" ? "บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าใช้งานหลังบ้าน" : ""
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
  <v-card rounded="xl" elevation="8" max-width="560" width="100%">
    <v-card-text class="pa-10">
      <v-row>
        <v-col cols="12" class="text-center">
          <div class="text-h4 font-weight-black">เข้าสู่ระบบหลังบ้าน</div>
          <div class="text-subtitle-1 text-medium-emphasis mt-2">
            ใช้บัญชี Google ที่ได้รับสิทธิ์เพื่อจัดการสินค้า รายงาน และการตั้งค่าหน้าเว็บ
          </div>
        </v-col>

        <v-col cols="12">
          <v-alert v-if="error || deniedMessage" type="error" variant="tonal" density="comfortable">
            {{ error || deniedMessage }}
          </v-alert>
        </v-col>

        <v-col cols="12">
          <v-btn
            block
            size="x-large"
            variant="outlined"
            :loading="loading"
            :disabled="loading"
            class="text-none"
            @click="handleGoogleSignIn"
          >
            <img src="/img/ext-google.png" alt="Continue with Google" height="32" class="mr-3">
            เข้าสู่ระบบด้วย Google
          </v-btn>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>
