<script setup lang="ts">
const { logout } = useAuthFirebase();
const runtimeConfig = useRuntimeConfig();
const firestoreDatabaseId = computed(() => String(runtimeConfig.public.firestoreDatabaseId || ""));

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
          <v-icon icon="mdi-camera" color="white" size="20" />
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
        <v-btn
          block
          variant="text"
          rounded="lg"
          class="text-none"
          style="color: var(--rbc-red-600);"
          @click="logout()"
        >
          <v-icon start>mdi-logout</v-icon>
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
        <div id="rbc-topbar-actions" class="rbc-topbar__actions" />
      </header>

      <!-- Page content -->
      <main class="rbc-page">
        <slot />
      </main>
    </div>
  </div>
</template>
