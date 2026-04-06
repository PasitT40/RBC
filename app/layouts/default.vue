<script setup lang="ts">
const { logout } = useAuthFirebase();
const runtimeConfig = useRuntimeConfig();
const firestoreDatabaseId = computed(() => String(runtimeConfig.public.firestoreDatabaseId || ""));

const menu = ref([
  { title: "ภาพรวม", icon: "mdi-view-dashboard", to: "/" },
  { title: "หมวดหมู่และแบรนด์", icon: "mdi-shape", to: "/categories" },
  { title: "สินค้า", icon: "mdi-sitemap", to: "/products" },
  { title: "รายงาน", icon: "mdi-poll", to: "/report" },
  { title: "ตั้งค่าหน้าเว็บ", icon: "mdi-image-multiple", to: "/settings" },
]);
</script>

<template>
  <div class="backoffice-shell">
    <aside class="backoffice-sidebar">
      <div class="backoffice-brand">
        <img src="/img/logo.png" alt="Logo" class="backoffice-brand__logo">
        <div>
          <div class="backoffice-brand__title">หลังบ้าน</div>
          <div class="backoffice-brand__subtitle">Ratchaburi Camera</div>
        </div>
      </div>

      <v-list nav class="backoffice-nav">
        <v-list-item v-for="(item, index) in menu" :key="index" link :to="item.to" rounded="lg">
          <template #prepend>
            <v-icon :icon="item.icon" size="20" />
          </template>
          <template #title>
            <span>{{ item.title }}</span>
          </template>
          <template #append>
            <v-icon icon="mdi-chevron-right" size="18" />
          </template>
        </v-list-item>
      </v-list>

      <div class="backoffice-sidebar__footer">
        <v-btn
          block
          color="error"
          variant="tonal"
          rounded="lg"
          class="text-none"
          @click="logout()"
        >
          <v-icon start>mdi-logout</v-icon>
          ออกจากระบบ
        </v-btn>

        <div class="backoffice-sidebar__meta">
          ฐานข้อมูล Firestore: <strong>{{ firestoreDatabaseId || "(default)" }}</strong><br>
          การอัปโหลดไฟล์ต้องใช้ Firebase Auth custom claim <code>backoffice_owner=true</code>
        </div>
      </div>
    </aside>

    <main class="backoffice-main">
      <div class="backoffice-page">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.backoffice-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  background: #f4f5f7;
}

.backoffice-sidebar {
  display: flex;
  flex-direction: column;
  padding: 24px 20px;
  background: #ffffff;
  border-right: 1px solid rgba(15, 23, 42, 0.08);
}

.backoffice-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px 20px;
}

.backoffice-brand__logo {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.backoffice-brand__title {
  font-size: 1rem;
  line-height: 1.2;
  font-weight: 800;
  color: #18181b;
}

.backoffice-brand__subtitle {
  margin-top: 4px;
  font-size: 0.85rem;
  line-height: 1.4;
  color: #71717a;
}

.backoffice-nav {
  flex: 1;
}

.backoffice-sidebar__footer {
  padding: 16px 8px 0;
}

.backoffice-sidebar__meta {
  margin-top: 12px;
  font-size: 0.75rem;
  line-height: 1.6;
  color: #64748b;
}

.backoffice-main {
  min-width: 0;
  padding: 24px;
}

.backoffice-page {
  min-height: calc(100vh - 48px);
  border-radius: 24px;
  background: #ffffff;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}
</style>
