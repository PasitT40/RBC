<script setup lang="ts">
const { logout } = useAuthFirebase();
const menu = ref([
  {
    title: "Dashboard",
    icon: "mdi-view-dashboard",
    to: "/",
  },
  {
    title: "Categories",
    icon: "mdi-shape",
    to: "/categories",
  },
  {
    title:"Products",
    icon: "mdi-sitemap",
    to: "/products",
  },
  {
    title:"Reports",
    icon: "mdi-poll",
    to: "/report",
  }
]);
</script>

<template>
  <v-layout class="rounded rounded-md border" style="min-height: 100vh;">
    <v-navigation-drawer class="tw:p-5!">
      <v-row no-gutters > 
       <v-col cols="3">
        <v-img src="/img/logo.png" height="50" width="50" alt="Logo" />
       </v-col>
       <v-col cols="6" class="tw:flex tw:items-center tw:px-3!">
        <span>Admin</span>
       </v-col>
      </v-row>
      <v-list nav>
        <v-list-item v-for="(item, index) in menu" :key="index" link :to="item.to">
          <template #prepend>
           <v-icon :icon="item.icon" size="20" />
          </template>
           <template #title>
            <span>{{ item.title }}</span> 
          </template>
          <template #append>
            <v-icon icon="mdi-chevron-right" size="20" />
          </template>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main class="d-flex align-start justify-center tw:min-h-screen tw:bg-gray-100">
      <v-container>
        <v-sheet
          color="white"
          height="100%"
          rounded="lg"
          width="100%"
        >
      <slot></slot>
    </v-sheet>
      </v-container>
    </v-main>
  </v-layout>
</template>
