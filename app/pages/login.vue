<script setup lang="ts">
import { useAuthFirebase } from "~/composables/useAuthFirebase";

definePageMeta({ layout: "login" });
const { loading, error, signInWithGoogle, checkRedirectResult } = useAuthFirebase();
const route = useRoute();
const deniedMessage = computed(() =>
  route.query.denied === "1" ? "บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบหลังบ้าน" : ""
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
      <div class="login-card__logo">
        <div class="login-card__logo-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" fill="white"/>
          </svg>
        </div>
        <div class="login-card__logo-name">RBC Camera</div>
      </div>
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
  border-radius: 10px;
  border-left: 4px solid #f87171;
  background: #fff5f5;
  color: #9f1d1d;
  font-size: 0.9rem;
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

.login-card__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 20px;
}

.login-card__logo-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f97316, #ea580c);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.35);
}

.login-card__logo-name {
  font-size: 1.25rem;
  font-weight: 800;
  color: #20170f;
  letter-spacing: -0.02em;
}
</style>
