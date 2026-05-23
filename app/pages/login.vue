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
  <div class="login-bg">
    <div class="login-card">
      <!-- Brand -->
      <div class="login-card__brand">
        <div class="login-card__brand-icon">
          <img src="/img/logo.png" alt="RB Camera" />
        </div>
        <span class="login-card__brand-name">RBC Camera</span>
      </div>

      <!-- Title -->
      <div class="login-card__title">ยินดีต้อนรับ</div>
      <div class="login-card__subtitle">เข้าสู่ระบบเพื่อจัดการ Backoffice</div>

      <!-- Error -->
      <div v-if="error || deniedMessage" class="login-card__error">{{ error || deniedMessage }}</div>

      <!-- Google button -->
      <button
        class="login-card__google-btn"
        :disabled="loading"
        @click="handleGoogleSignIn"
      >
        <template v-if="!loading">
          <img src="/img/ext-google.png" alt="Google" width="20" height="20" />
          <span>เข้าสู่ระบบด้วย Google</span>
        </template>
        <template v-else>
          <v-progress-circular indeterminate size="18" width="2" color="#f97316" />
          <span>กำลังเข้าสู่ระบบ...</span>
        </template>
      </button>
    </div>
  </div>
</template>

<style scoped>
.login-bg {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 50%, #f97316 100%);
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: #ffffff;
  border-radius: 24px;
  padding: 40px 40px 36px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.18);
}

.login-card__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 28px;
}

.login-card__brand-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.20);
  overflow: hidden;
}

.login-card__brand-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 5px;
}

.login-card__brand-name {
  font-size: 18px;
  font-weight: 800;
  color: #0f172a;
}

.login-card__title {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 4px;
}

.login-card__subtitle {
  font-size: 14px;
  color: #64748b;
  margin-bottom: 28px;
}

.login-card__error {
  background: #fff5f5;
  border-left: 4px solid #f87171;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  color: #dc2626;
  margin-bottom: 16px;
}

.login-card__google-btn {
  width: 100%;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #ffffff;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s;
}

.login-card__google-btn:hover:not(:disabled) {
  border-color: #f97316;
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.10);
}

.login-card__google-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
