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
  <div class="login-card">
    <div class="login-card__header">
      <h1 class="login-card__title">เข้าสู่ระบบหลังบ้าน</h1>
      <p class="login-card__subtitle">
        ใช้บัญชี Google ที่ได้รับสิทธิ์เพื่อจัดการสินค้า รายงาน และการตั้งค่าหน้าเว็บ
      </p>
    </div>

    <div v-if="error || deniedMessage" class="login-card__error">
      {{ error || deniedMessage }}
    </div>

    <button
      type="button"
      class="login-card__button"
      :disabled="loading"
      @click="handleGoogleSignIn"
    >
      <span class="login-card__button-inner" :class="{ 'login-card__button-inner--loading': loading }">
        <img src="/img/ext-google.png" alt="Continue with Google" class="login-card__google">
        <span>{{ loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วย Google" }}</span>
      </span>
    </button>
  </div>
</template>

<style scoped>
.login-card {
  width: 100%;
  border-radius: 28px;
  padding: 40px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 20px 60px rgba(70, 42, 10, 0.16);
  backdrop-filter: blur(6px);
}

.login-card__header {
  text-align: center;
}

.login-card__title {
  margin: 0;
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 900;
  color: #20170f;
}

.login-card__subtitle {
  margin: 12px 0 0;
  font-size: 1rem;
  line-height: 1.6;
  color: #6c5a4c;
}

.login-card__error {
  margin-top: 24px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid rgba(183, 28, 28, 0.18);
  background: #fff1f1;
  color: #9f1d1d;
  font-size: 0.95rem;
  line-height: 1.5;
}

.login-card__button {
  width: 100%;
  margin-top: 24px;
  border: 1px solid #d7c4af;
  border-radius: 999px;
  padding: 16px 20px;
  background: #ffffff;
  color: #20170f;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

.login-card__button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 30px rgba(70, 42, 10, 0.08);
}

.login-card__button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.login-card__button-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 1.05rem;
  font-weight: 700;
}

.login-card__button-inner--loading {
  opacity: 0.8;
}

.login-card__google {
  width: auto;
  height: 32px;
}
</style>
