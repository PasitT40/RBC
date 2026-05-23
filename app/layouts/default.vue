<script setup lang="ts">
const { logout } = useAuthFirebase();
const runtimeConfig = useRuntimeConfig();
const firestoreDatabaseId = computed(() => String(runtimeConfig.public.firestoreDatabaseId || ""));

const userEmail = computed(() => {
  try {
    const { user } = useAuthSession()
    return user?.value?.email || ''
  } catch { return '' }
})
const userInitial = computed(() => userEmail.value.charAt(0).toUpperCase() || '?')

const route = useRoute();

const menu = [
  { title: "Dashboard", icon: "mdi-view-dashboard-outline", to: "/" },
  { title: "สินค้า", icon: "mdi-package-variant-closed", to: "/products" },
  { title: "หมวดหมู่", icon: "mdi-tag-multiple-outline", to: "/categories" },
  { title: "รายงาน", icon: "mdi-chart-bar", to: "/report" },
  { title: "ตั้งค่า", icon: "mdi-cog-outline", to: "/settings" },
];

const routeTitles: Record<string, string> = {
  "/": "Dashboard",
  "/products": "สินค้า",
  "/products/create": "เพิ่มสินค้า",
  "/categories": "หมวดหมู่",
  "/report": "รายงาน",
  "/settings": "ตั้งค่า",
};

const pageTitle = computed(() => {
  const path = route.path;
  if (routeTitles[path]) return routeTitles[path];
  if (/^\/products\/edit/.test(path)) return "แก้ไขสินค้า";
  return "";
});
</script>

<template>
  <div class="rbc-shell">
    <!-- Sidebar -->
    <aside class="rbc-sidebar">
      <!-- Logo section -->
      <div class="rbc-sidebar__logo">
        <div class="rbc-sidebar__logo-icon">
          <v-icon icon="mdi-camera" color="white" size="22" />
        </div>
        <div>
          <div class="rbc-sidebar__logo-name">RBC Camera</div>
          <div class="rbc-sidebar__logo-sub">Backoffice System</div>
        </div>
      </div>

      <!-- Nav -->
      <v-list nav density="compact" class="rbc-sidebar__nav">
        <div class="rbc-sidebar__nav-label">เมนูหลัก</div>
        <v-list-item
          v-for="item in menu"
          :key="item.to"
          :to="item.to"
          :exact="item.to === '/'"
          rounded="lg"
          min-height="44"
        >
          <template #prepend>
            <v-icon :icon="item.icon" size="18" />
          </template>
          <template #title>
            <span class="rbc-sidebar__nav-title">{{ item.title }}</span>
          </template>
        </v-list-item>
      </v-list>

      <!-- Footer -->
      <div class="rbc-sidebar__footer">
        <!-- User info -->
        <div v-if="userEmail" class="rbc-sidebar__user">
          <div class="rbc-sidebar__user-avatar">{{ userInitial }}</div>
          <div class="rbc-sidebar__user-email">{{ userEmail }}</div>
        </div>
        <v-btn
          block
          variant="text"
          rounded="lg"
          class="text-none mt-1"
          style="color: var(--rbc-red-600);"
          @click="logout()"
        >
          <v-icon start size="16">mdi-logout</v-icon>
          ออกจากระบบ
        </v-btn>
        <div v-if="firestoreDatabaseId" class="rbc-sidebar__meta">
          DB: {{ firestoreDatabaseId }}
        </div>
      </div>
    </aside>

    <!-- Main area -->
    <div class="rbc-main">
      <!-- Topbar -->
      <header class="rbc-topbar">
        <div>
          <div class="rbc-topbar__title">{{ pageTitle }}</div>
          <div id="rbc-topbar-subtitle" class="rbc-topbar__sub" />
        </div>
        <div class="rbc-topbar__right">
          <div id="rbc-topbar-actions" class="rbc-topbar__actions" />
          <div v-if="userInitial !== '?'" class="rbc-topbar__avatar">{{ userInitial }}</div>
        </div>
      </header>

      <!-- Page content -->
      <main class="rbc-page">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
/* Sidebar user info */
.rbc-sidebar__user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 4px;
  border-radius: 10px;
  background: var(--rbc-slate-50);
}

.rbc-sidebar__user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--rbc-orange-500), var(--rbc-orange-600));
  color: white;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rbc-sidebar__user-email {
  font-size: 11px;
  color: var(--rbc-slate-500);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

/* Topbar title/sub size overrides */
.rbc-topbar__title {
  font-size: 17px;
}

.rbc-topbar__sub {
  font-size: 12px;
}

/* Topbar right side */
.rbc-topbar__right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rbc-topbar__avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--rbc-orange-500), var(--rbc-orange-600));
  color: white;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(249, 115, 22, 0.30);
}

@media (max-width: 959px) {
  .rbc-topbar__right {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
