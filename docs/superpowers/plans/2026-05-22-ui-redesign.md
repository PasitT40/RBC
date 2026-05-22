# RBC Backoffice UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the entire backoffice UI to a consistent Warm Modern design system while preserving all features and improving key UX flows.

**Architecture:** Design tokens first (CSS variables + Vuetify theme), then shared components, then pages in dependency order. Each task is independently deployable. No new libraries — uses existing Vuetify 3 + Tailwind CSS v4 stack.

**Tech Stack:** Nuxt 4, Vue 3, Vuetify 3.11 (`vuetify-nuxt-module`), Tailwind CSS v4 (`tw:` prefix), Vee-Validate 4, Firebase Storage, Pinia, nuxt-toast

> **Note:** This project has no test framework. All verification is done via `npm run dev` + manual browser check. The `useImageUpload` composable is pure logic — add Vitest later if desired.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/assets/css/main.css` | Modify | CSS custom properties (design tokens) |
| `nuxt.config.ts` | Modify | Vuetify theme (primary color, border-radius defaults) |
| `app/layouts/default.vue` | Rebuild | Sidebar + topbar shell |
| `app/composables/useImageUpload.ts` | Create | WebP conversion, center-crop, validation pipeline |
| `app/components/form/VeeFileInput.vue` | Modify | ImageConstraint prop, use useImageUpload, constraint UI |
| `app/components/form/VeeTextField.vue` | Modify | Consistent field styling |
| `app/components/form/VeeSelect.vue` | Modify | Consistent field styling |
| `app/components/form/VeeTextArea.vue` | Modify | Consistent field styling |
| `app/components/form/VeeNumberStepper.vue` | Modify | Consistent field styling |
| `app/components/form/VeeDatePicker.vue` | Modify | Consistent field styling |
| `app/components/form/VeeSwitch.vue` | Modify | Consistent field styling |
| `app/components/ProductEditorForm.vue` | Modify | 3-step indicator, profit calculator, restyle |
| `app/pages/index.vue` | Rebuild | KPI cards, delta indicators, action warning |
| `app/pages/products/index.vue` | Modify | Filter chips, context-aware actions, search toolbar |
| `app/pages/categories/index.vue` | Modify | Section headers, drag cursor, layout polish |
| `app/pages/report/index.vue` | Modify | Date filter prominent, export in topbar area |
| `app/pages/settings/index.vue` | Modify | Banner/credit sections, image constraint UI |
| `app/pages/login.vue` | Modify | Minor polish to match new tokens |

---

## Task 1: Design Tokens + Vuetify Theme

**Files:**
- Modify: `app/assets/css/main.css`
- Modify: `nuxt.config.ts`

- [ ] **Step 1: Add CSS custom properties to main.css**

Replace the entire content of `app/assets/css/main.css` with:

```css
@import "tailwindcss" prefix(tw);

/* ===== RBC Design Tokens ===== */
:root {
  --rbc-orange-50: #fff7ed;
  --rbc-orange-100: #ffedd5;
  --rbc-orange-200: #fed7aa;
  --rbc-orange-300: #fdba74;
  --rbc-orange-400: #fb923c;
  --rbc-orange-500: #f97316;
  --rbc-orange-600: #ea580c;
  --rbc-orange-700: #c2410c;
  --rbc-orange-800: #9a3412;

  --rbc-slate-50: #f8fafc;
  --rbc-slate-100: #f1f5f9;
  --rbc-slate-200: #e2e8f0;
  --rbc-slate-400: #94a3b8;
  --rbc-slate-500: #64748b;
  --rbc-slate-700: #334155;
  --rbc-slate-900: #0f172a;

  --rbc-shadow-card: 0 4px 20px rgba(249, 115, 22, 0.10);
  --rbc-shadow-modal: 0 20px 60px rgba(15, 23, 42, 0.18);
  --rbc-shadow-soft: 0 2px 12px rgba(15, 23, 42, 0.06);

  --rbc-radius-card: 14px;
  --rbc-radius-btn: 8px;
  --rbc-radius-badge: 20px;
  --rbc-radius-input: 8px;
}

/* ===== Page shell ===== */
.rbc-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  background: var(--rbc-slate-50);
}

/* ===== Sidebar ===== */
.rbc-sidebar {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-right: 1px solid var(--rbc-slate-200);
  height: 100vh;
  position: sticky;
  top: 0;
  overflow-y: auto;
}

.rbc-sidebar__logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 16px 14px;
  border-bottom: 1px solid var(--rbc-slate-100);
}

.rbc-sidebar__logo-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--rbc-orange-500), var(--rbc-orange-600));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.rbc-sidebar__logo-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.rbc-sidebar__logo-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--rbc-slate-900);
  line-height: 1.2;
}

.rbc-sidebar__logo-sub {
  font-size: 10px;
  color: var(--rbc-slate-400);
  margin-top: 1px;
}

.rbc-sidebar__nav {
  flex: 1;
  padding: 10px 8px;
}

.rbc-sidebar__nav-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--rbc-slate-400);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 6px 10px 4px;
}

.rbc-sidebar__footer {
  padding: 10px 8px 12px;
  border-top: 1px solid var(--rbc-slate-100);
}

.rbc-sidebar__meta {
  margin-top: 8px;
  font-size: 9px;
  line-height: 1.6;
  color: var(--rbc-slate-400);
  padding: 0 10px;
}

/* ===== Main area ===== */
.rbc-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.rbc-topbar {
  background: #ffffff;
  border-bottom: 1px solid var(--rbc-slate-200);
  padding: 14px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 10;
}

.rbc-topbar__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--rbc-slate-900);
  line-height: 1.2;
}

.rbc-topbar__sub {
  font-size: 11px;
  color: var(--rbc-slate-400);
  margin-top: 2px;
}

.rbc-topbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rbc-page {
  padding: 20px 24px;
  flex: 1;
}

/* ===== Buttons ===== */
.rbc-btn-primary {
  background: linear-gradient(135deg, var(--rbc-orange-500), var(--rbc-orange-600)) !important;
  color: #ffffff !important;
  box-shadow: 0 2px 8px rgba(249, 115, 22, 0.30) !important;
  border-radius: var(--rbc-radius-btn) !important;
  text-transform: none !important;
  font-weight: 600 !important;
  letter-spacing: 0 !important;
}

.rbc-btn-ghost {
  background: #ffffff !important;
  color: var(--rbc-slate-700) !important;
  border: 1px solid var(--rbc-slate-200) !important;
  border-radius: var(--rbc-radius-btn) !important;
  text-transform: none !important;
  font-weight: 500 !important;
  letter-spacing: 0 !important;
}

/* ===== Cards ===== */
.rbc-card {
  background: #ffffff;
  border-radius: var(--rbc-radius-card);
  box-shadow: var(--rbc-shadow-card);
  overflow: hidden;
}

.rbc-card__header {
  padding: 14px 18px;
  border-bottom: 1px solid var(--rbc-slate-100);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rbc-card__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--rbc-slate-900);
}

.rbc-card__body {
  padding: 16px 18px;
}

/* ===== Stat cards ===== */
.rbc-stat-card {
  background: #ffffff;
  border-radius: var(--rbc-radius-card);
  box-shadow: var(--rbc-shadow-card);
  padding: 16px 18px;
  position: relative;
  overflow: hidden;
}

.rbc-stat-card::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
}

.rbc-stat-card--orange::after { background: linear-gradient(90deg, var(--rbc-orange-500), var(--rbc-orange-300)); }
.rbc-stat-card--green::after  { background: linear-gradient(90deg, #22c55e, #86efac); }
.rbc-stat-card--blue::after   { background: linear-gradient(90deg, #3b82f6, #93c5fd); }
.rbc-stat-card--purple::after { background: linear-gradient(90deg, #a855f7, #d8b4fe); }

.rbc-stat-card__label {
  font-size: 11px;
  color: var(--rbc-slate-400);
  margin-bottom: 6px;
}

.rbc-stat-card__value {
  font-size: 26px;
  font-weight: 800;
  color: var(--rbc-slate-900);
  line-height: 1;
}

.rbc-stat-card__delta {
  font-size: 10px;
  color: #16a34a;
  margin-top: 5px;
}

.rbc-stat-card__icon {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ===== Data table wrapper ===== */
.rbc-table-wrap {
  background: #ffffff;
  border-radius: var(--rbc-radius-card);
  box-shadow: var(--rbc-shadow-card);
  overflow: hidden;
}

.rbc-table-toolbar {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--rbc-slate-100);
  flex-wrap: wrap;
}

/* Override Vuetify data-table header */
.rbc-table-wrap .v-data-table-header th {
  background: var(--rbc-orange-50) !important;
  color: var(--rbc-orange-800) !important;
  font-size: 11px !important;
  font-weight: 600 !important;
}

.rbc-table-wrap .v-data-table__tr:hover td {
  background: var(--rbc-orange-50) !important;
}

/* ===== Badges ===== */
.rbc-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: var(--rbc-radius-badge);
  font-size: 10px;
  font-weight: 600;
}
.rbc-badge--green  { background: #dcfce7; color: #166534; }
.rbc-badge--blue   { background: #dbeafe; color: #1e40af; }
.rbc-badge--orange { background: var(--rbc-orange-100); color: var(--rbc-orange-700); }
.rbc-badge--red    { background: #fee2e2; color: #991b1b; }
.rbc-badge--gray   { background: var(--rbc-slate-100); color: var(--rbc-slate-500); }

/* ===== Filter chips ===== */
.rbc-filter-chip {
  padding: 5px 14px;
  border-radius: var(--rbc-radius-badge);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--rbc-slate-200);
  background: #ffffff;
  color: var(--rbc-slate-500);
  transition: all 0.15s;
  user-select: none;
}

.rbc-filter-chip:hover {
  border-color: var(--rbc-orange-200);
  color: var(--rbc-orange-700);
}

.rbc-filter-chip--active {
  background: var(--rbc-orange-50);
  border-color: var(--rbc-orange-200);
  color: var(--rbc-orange-700);
  font-weight: 600;
}

/* ===== Form fields ===== */
.rbc-field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--rbc-slate-500);
  margin-bottom: 4px;
}

.rbc-field-label .req {
  color: var(--rbc-orange-600);
  margin-left: 2px;
}

/* Override Vuetify outlined inputs */
.rbc-input-wrap .v-field {
  border-radius: var(--rbc-radius-input) !important;
}

.rbc-input-wrap .v-field--focused .v-field__outline {
  --v-field-border-width: 2px;
}

/* ===== Upload zone ===== */
.rbc-upload-zone {
  border: 2px dashed var(--rbc-orange-200);
  background: var(--rbc-orange-50);
  border-radius: 10px;
  padding: 20px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
}

.rbc-upload-zone:hover {
  border-color: var(--rbc-orange-500);
  background: var(--rbc-orange-100);
}

.rbc-upload-zone--error {
  border-color: #f87171;
  background: #fff5f5;
}

.rbc-upload-zone__text {
  font-size: 12px;
  font-weight: 600;
  color: var(--rbc-orange-700);
  margin-top: 4px;
}

.rbc-upload-zone__constraint {
  font-size: 10px;
  color: var(--rbc-slate-500);
  background: #ffffff;
  border: 1px solid var(--rbc-slate-200);
  border-radius: 6px;
  padding: 2px 10px;
  display: inline-block;
  margin-top: 5px;
}

/* ===== Step indicator ===== */
.rbc-steps {
  display: flex;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--rbc-slate-100);
}

.rbc-step {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rbc-step__dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.rbc-step__dot--done   { background: var(--rbc-orange-500); color: #ffffff; }
.rbc-step__dot--active { background: var(--rbc-orange-100); color: var(--rbc-orange-700); border: 2px solid var(--rbc-orange-500); }
.rbc-step__dot--pending{ background: var(--rbc-slate-100); color: var(--rbc-slate-400); }

.rbc-step__label {
  font-size: 11px;
  color: var(--rbc-slate-500);
}

.rbc-step__label--active {
  color: var(--rbc-orange-700);
  font-weight: 600;
}

.rbc-step__line {
  flex: 1;
  height: 1px;
  background: var(--rbc-slate-200);
  margin: 0 6px;
}

.rbc-step__line--done { background: var(--rbc-orange-300); }

/* ===== Alert / warning boxes ===== */
.rbc-alert {
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 11px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.rbc-alert--warning {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
}

.rbc-alert--error {
  background: #fee2e2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.rbc-alert--info {
  background: var(--rbc-orange-50);
  border: 1px solid var(--rbc-orange-200);
  color: var(--rbc-orange-800);
}

/* ===== Section header ===== */
.rbc-section-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--rbc-orange-700);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-bottom: 1px solid var(--rbc-orange-100);
  padding-bottom: 6px;
  margin-bottom: 14px;
}

/* ===== Vuetify nav-list active item override ===== */
.rbc-sidebar .v-list-item--active {
  background: var(--rbc-orange-50) !important;
  color: var(--rbc-orange-700) !important;
  border-left: 3px solid var(--rbc-orange-500) !important;
  border-radius: 0 8px 8px 0 !important;
  font-weight: 600;
}

.rbc-sidebar .v-list-item--active .v-icon {
  color: var(--rbc-orange-600) !important;
}

.rbc-sidebar .v-list-item:not(.v-list-item--active):hover {
  background: var(--rbc-slate-50) !important;
  border-radius: 8px !important;
}

/* ===== iziToast overrides (keep existing + restyle) ===== */
.iziToast .iziToast-body {
  display: flex;
  align-items: center;
}

.iziToast .iziToast-message {
  white-space: pre-line;
}
```

- [ ] **Step 2: Add Vuetify theme to nuxt.config.ts**

```ts
// nuxt.config.ts
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["vuetify-nuxt-module", "nuxt-toast", "nuxt-echarts"],
  vuetify: {
    moduleOptions: {
      disableVuetifyStyles: true,
    },
    vuetifyOptions: {
      theme: {
        themes: {
          light: {
            colors: {
              primary: "#f97316",
              "primary-darken-1": "#ea580c",
              secondary: "#64748b",
              error: "#ef4444",
              warning: "#f59e0b",
              success: "#22c55e",
              info: "#3b82f6",
              surface: "#ffffff",
              background: "#f8fafc",
            },
          },
        },
      },
      defaults: {
        VBtn: {
          rounded: "lg",
          style: "text-transform: none; letter-spacing: 0; font-weight: 600;",
        },
        VCard: { rounded: "xl" },
        VTextField: { variant: "outlined", density: "comfortable", rounded: "lg" },
        VSelect: { variant: "outlined", density: "comfortable", rounded: "lg" },
        VTextarea: { variant: "outlined", density: "comfortable", rounded: "lg" },
      },
    },
  },
  toast: {
    settings: {
      position: "topRight",
      timeout: 3000,
    },
  },
  echarts: {
    renderer: ["svg"],
    charts: ["BarChart"],
    components: ["DatasetComponent", "GridComponent", "TooltipComponent"],
  },
  vite: {
    plugins: [tailwindcss() as never],
  },
  css: ["vuetify/styles", "~/assets/css/main.css"],
  runtimeConfig: {
    public: {
      firebaseApiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseStorageBucketProd:
        process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET_PROD || process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseStorageBucketDev:
        process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEV || process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID,
      firebaseMeasurementId: process.env.NUXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
      firestoreDatabaseId: process.env.NUXT_PUBLIC_FIRESTORE_DATABASE_ID || "",
    },
  },
});
```

- [ ] **Step 3: Run dev server and verify tokens load without errors**

```bash
npm run dev
```

Expected: App starts, no CSS errors in browser console, Vuetify primary color is orange.

- [ ] **Step 4: Commit**

```bash
git add app/assets/css/main.css nuxt.config.ts
git commit -m "feat: add RBC design token system and Vuetify theme"
```

---

## Task 2: Default Layout Rebuild (Sidebar + Topbar)

**Files:**
- Modify: `app/layouts/default.vue`

The current layout has a white 280px sidebar with Vuetify `v-list`. We rebuild it to 240px using our design tokens, add a sticky topbar inside the main area, and expose a `pageTitle` / `pageSubtitle` slot mechanism via `useRoute` meta.

- [ ] **Step 1: Replace default.vue template and script**

```vue
<!-- app/layouts/default.vue -->
<script setup lang="ts">
const { logout } = useAuthFirebase()
const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const firestoreDatabaseId = computed(() => String(runtimeConfig.public.firestoreDatabaseId || ''))

const menu = [
  { title: 'ภาพรวม',           icon: 'mdi-view-dashboard',  to: '/' },
  { title: 'สินค้า',            icon: 'mdi-package-variant',  to: '/products' },
  { title: 'หมวดหมู่และแบรนด์', icon: 'mdi-shape',           to: '/categories' },
  { title: 'รายงาน',            icon: 'mdi-chart-bar',        to: '/report' },
  { title: 'ตั้งค่าเว็บ',       icon: 'mdi-cog-outline',      to: '/settings' },
]

const pageTitle = computed(() => (route.meta.pageTitle as string) || '')
const pageSubtitle = computed(() => (route.meta.pageSubtitle as string) || '')
</script>

<template>
  <div class="rbc-shell">
    <!-- SIDEBAR -->
    <aside class="rbc-sidebar">
      <div class="rbc-sidebar__logo">
        <div class="rbc-sidebar__logo-icon">
          <img src="/img/logo.png" alt="Logo" />
        </div>
        <div>
          <div class="rbc-sidebar__logo-name">Ratchaburi Camera</div>
          <div class="rbc-sidebar__logo-sub">Backoffice</div>
        </div>
      </div>

      <nav class="rbc-sidebar__nav">
        <div class="rbc-sidebar__nav-label">เมนูหลัก</div>
        <v-list nav density="compact" class="pa-0">
          <v-list-item
            v-for="item in menu"
            :key="item.to"
            :to="item.to"
            :prepend-icon="item.icon"
            :title="item.title"
            rounded="lg"
            class="mb-1"
          />
        </v-list>
      </nav>

      <div class="rbc-sidebar__footer">
        <v-btn
          block
          variant="tonal"
          color="error"
          class="text-none rbc-btn-ghost mb-2"
          rounded="lg"
          @click="logout()"
        >
          <v-icon start>mdi-logout</v-icon>
          ออกจากระบบ
        </v-btn>
        <div class="rbc-sidebar__meta">
          Firestore: <strong>{{ firestoreDatabaseId || 'missing' }}</strong><br>
          ต้องใช้ claim <code>backoffice_owner=true</code>
        </div>
      </div>
    </aside>

    <!-- MAIN -->
    <main class="rbc-main">
      <!-- TOPBAR -->
      <header v-if="pageTitle" class="rbc-topbar">
        <div>
          <div class="rbc-topbar__title">{{ pageTitle }}</div>
          <div v-if="pageSubtitle" class="rbc-topbar__sub">{{ pageSubtitle }}</div>
        </div>
        <div class="rbc-topbar__actions">
          <slot name="topbar-actions" />
        </div>
      </header>

      <!-- PAGE CONTENT -->
      <div class="rbc-page">
        <slot />
      </div>
    </main>
  </div>
</template>
```

> **Note on topbar:** Each page sets `definePageMeta({ pageTitle: 'ภาพรวม', pageSubtitle: '...' })`. The topbar slot `topbar-actions` is filled by each page via `<template #topbar-actions>`. If a page doesn't set `pageTitle`, the topbar is hidden (simpler pages can manage their own header inside the page content).

- [ ] **Step 2: Run dev and verify sidebar renders correctly**

```bash
npm run dev
```

Open http://localhost:3000 — check: sidebar is 240px, white, logo visible, nav items highlight orange when active.

- [ ] **Step 3: Commit**

```bash
git add app/layouts/default.vue
git commit -m "feat: rebuild sidebar layout with RBC design tokens"
```

---

## Task 3: useImageUpload Composable (WebP + Validation)

**Files:**
- Create: `app/composables/useImageUpload.ts`

This composable handles the full image pipeline before any file reaches Firebase Storage: validate format → validate size → center-crop to exact dimensions → convert to WebP (unless `keepPng`).

- [ ] **Step 1: Create the composable**

```ts
// app/composables/useImageUpload.ts

export interface ImageConstraint {
  width: number       // target width in px
  height: number      // target height in px
  maxSizeKB: number   // max file size in KB (checked after conversion)
  keepPng?: boolean   // skip WebP conversion (for brand logos with alpha)
  label: string       // displayed in upload zone: "1920 × 600 px · JPG/PNG · ≤500 KB"
}

export type ImageValidationResult =
  | { ok: true; blob: Blob; warning?: string }
  | { ok: false; error: string }

export function useImageUpload() {
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

  function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('invalid-image')) }
      img.src = url
    })
  }

  function centerCrop(img: HTMLImageElement, targetW: number, targetH: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')!

    const srcRatio = img.naturalWidth / img.naturalHeight
    const dstRatio = targetW / targetH

    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight

    if (srcRatio > dstRatio) {
      // source is wider — crop sides
      sw = Math.round(img.naturalHeight * dstRatio)
      sx = Math.round((img.naturalWidth - sw) / 2)
    } else {
      // source is taller — crop top/bottom
      sh = Math.round(img.naturalWidth / dstRatio)
      sy = Math.round((img.naturalHeight - sh) / 2)
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH)
    return canvas
  }

  function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => { blob ? resolve(blob) : reject(new Error('canvas-to-blob-failed')) },
        mimeType,
        quality
      )
    })
  }

  async function processImage(file: File, constraint: ImageConstraint): Promise<ImageValidationResult> {
    // 1. Format check
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { ok: false, error: `รองรับเฉพาะ JPG, PNG, WebP (ได้รับ: ${file.type})` }
    }
    if (constraint.keepPng && file.type !== 'image/png') {
      return { ok: false, error: 'ไฟล์นี้ต้องเป็น PNG เท่านั้น (รองรับพื้นหลังโปร่งใส)' }
    }

    // 2. Load image
    let img: HTMLImageElement
    try {
      img = await loadImage(file)
    } catch {
      return { ok: false, error: 'ไม่สามารถอ่านไฟล์รูปได้ กรุณาเลือกใหม่' }
    }

    // 3. Check if dimensions match exactly (allow ±2%)
    const srcRatio = img.naturalWidth / img.naturalHeight
    const dstRatio = constraint.width / constraint.height
    const ratioDiff = Math.abs(srcRatio - dstRatio) / dstRatio
    const needsCrop = ratioDiff > 0.02 || img.naturalWidth !== constraint.width

    // 4. Draw canvas (center-crop if needed, resize to target)
    const canvas = centerCrop(img, constraint.width, constraint.height)

    // 5. Convert to WebP or PNG
    const mimeType = constraint.keepPng ? 'image/png' : 'image/webp'
    let quality = 0.85
    let blob: Blob
    const maxBytes = constraint.maxSizeKB * 1024

    // Reduce quality in steps until size fits
    do {
      blob = await canvasToBlob(canvas, mimeType, quality)
      quality -= 0.05
    } while (blob.size > maxBytes && quality > 0.40)

    // 6. Final size check
    if (blob.size > maxBytes) {
      return {
        ok: false,
        error: `ไฟล์ยังใหญ่เกิน ${constraint.maxSizeKB} KB หลังบีบอัดแล้ว กรุณาใช้รูปที่มีความละเอียดน้อยกว่า`
      }
    }

    return {
      ok: true,
      blob,
      warning: needsCrop ? `ภาพถูก crop กลางให้เป็น ${constraint.width}×${constraint.height}px อัตโนมัติ` : undefined
    }
  }

  return { processImage }
}
```

- [ ] **Step 2: Verify composable loads without TypeScript errors**

```bash
npm run typecheck
```

Expected: No errors in `useImageUpload.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useImageUpload.ts
git commit -m "feat: add useImageUpload composable with WebP conversion and center-crop"
```

---

## Task 4: VeeFileInput — Add ImageConstraint + Restyle

**Files:**
- Modify: `app/components/form/VeeFileInput.vue`

The existing component already handles drag-to-reorder and aspect ratio checks. We replace the old `aspectRatio` / `maxSize` props with a single `constraint: ImageConstraint` prop, wire in `useImageUpload`, and restyle the drop zone with our design tokens.

- [ ] **Step 1: Update Props interface and add constraint support**

In `<script setup>`, replace the existing Props interface and add the composable:

```ts
// Replace Props interface (remove aspectRatio, aspectRatioLabel, maxSize — kept for backward compat via constraint)
import type { ImageConstraint } from '~/composables/useImageUpload'

interface Props {
  name: string
  label?: string
  hint?: string
  accept?: string
  multiple?: boolean
  maxFiles?: number
  constraint?: ImageConstraint        // NEW: replaces aspectRatio + maxSize
  // legacy props (still supported for existing uses without constraint)
  aspectRatio?: number
  aspectRatioLabel?: string
  maxSize?: number
  previewUrl?: string
  previewUrls?: string[]
  sortable?: boolean
  removable?: boolean
  variant?: "outlined" | "filled" | "plain" | "solo" | "solo-filled" | "solo-inverted" | "underlined"
}

const props = withDefaults(defineProps<Props>(), {
  accept: 'image/*',
  multiple: false,
  maxFiles: 1,
  constraint: undefined,
  aspectRatio: undefined,
  aspectRatioLabel: '',
  maxSize: 2000000,
  previewUrl: undefined,
  previewUrls: () => [],
  sortable: false,
  removable: false,
  variant: 'outlined',
})

const { processImage } = useImageUpload()
```

- [ ] **Step 2: Replace handleFiles to use useImageUpload when constraint is provided**

Replace the existing `handleFiles` function:

```ts
async function handleFiles(files: File | File[] | FileList | null) {
  const fileArray = Array.isArray(files)
    ? files
    : files instanceof FileList
      ? Array.from(files)
      : files instanceof File
        ? [files]
        : []

  if (fileArray.length > props.maxFiles) {
    appToast.error(`เลือกได้สูงสุด ${props.maxFiles} ไฟล์`)
    return
  }

  revokePreviews()
  previews.value = []
  progress.value = []
  selectedFiles.value = []

  for (const file of fileArray) {
    if (props.constraint) {
      // New constraint-based pipeline
      const result = await processImage(file, props.constraint)
      if (!result.ok) {
        appToast.error(result.error)
        continue
      }
      if (result.warning) {
        appToast.warning(result.warning)
      }
      // Convert Blob back to File for downstream consumers
      const ext = props.constraint.keepPng ? 'png' : 'webp'
      const mime = props.constraint.keepPng ? 'image/png' : 'image/webp'
      const convertedFile = new File([result.blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type: mime })
      selectedFiles.value.push(convertedFile)
      previews.value.push(URL.createObjectURL(result.blob))
      progress.value.push(0)
    } else {
      // Legacy path: use old aspectRatio + maxSize checks
      if (file.size > props.maxSize) {
        appToast.error(`${file.name} มีขนาดใหญ่เกินไป ระบบรองรับไม่เกิน ${formatBytes(props.maxSize)}`)
        continue
      }
      if (props.aspectRatio) {
        try {
          const { width, height } = await getImageDimensions(file)
          if (!isAspectRatioAllowed(width, height)) {
            const ratioLabel = props.aspectRatioLabel || props.aspectRatio.toFixed(2)
            appToast.error(`${file.name} สัดส่วนภาพไม่ถูกต้อง กรุณาใช้สัดส่วน ${ratioLabel}`)
            continue
          }
        } catch {
          appToast.error(`${file.name} ไม่สามารถอ่านขนาดรูปได้`)
          continue
        }
      }
      selectedFiles.value.push(file)
      previews.value.push(URL.createObjectURL(file))
      progress.value.push(0)
    }
    simulateUpload(selectedFiles.value.length - 1)
  }

  emitSelectedFiles()
}
```

- [ ] **Step 3: Restyle the template drop zone**

Replace the `<template>` section:

```vue
<template>
<div class="rbc-file-input" @drop="onDrop" @dragover="onDragOver">

  <!-- Constraint-aware upload zone (shown when no files selected) -->
  <template v-if="!displayItems.length">
    <label class="rbc-upload-zone" :class="{ 'rbc-upload-zone--error': errorMessage }">
      <input
        type="file"
        :accept="accept"
        :multiple="multiple"
        style="display:none"
        @change="(e) => handleFiles((e.target as HTMLInputElement).files)"
      />
      <v-icon size="28" color="#c2410c">mdi-cloud-upload-outline</v-icon>
      <div class="rbc-upload-zone__text">
        {{ label || 'คลิกเพื่ออัปโหลด หรือลากวางไฟล์' }}
      </div>
      <div v-if="constraint" class="rbc-upload-zone__constraint">
        {{ constraint.label }}
      </div>
      <div v-else-if="hint" class="rbc-upload-zone__constraint">{{ hint }}</div>
    </label>
    <div v-if="errorMessage" class="rbc-field-error">{{ errorMessage }}</div>
  </template>

  <!-- Preview grid (shown after files selected) -->
  <template v-else>
    <div class="rbc-preview-grid">
      <div
        v-for="(item, i) in displayItems"
        :key="`${item.source}-${i}`"
        class="rbc-preview-item"
        @dragover.prevent.stop
        @drop.stop="onPreviewDrop(i, $event)"
      >
        <img
          :src="item.src"
          class="rbc-preview-image"
          draggable="true"
          @dragstart="onPreviewDragStart(i)"
          @click="openPreview(i)"
        />
        <button
          v-if="removable"
          type="button"
          class="rbc-preview-remove"
          @click="removePreview(i)"
        >
          <v-icon size="14">mdi-close</v-icon>
        </button>
      </div>

      <!-- Add more slot -->
      <label v-if="multiple && displayItems.length < maxFiles" class="rbc-preview-add">
        <input type="file" :accept="accept" multiple style="display:none"
          @change="(e) => handleFiles((e.target as HTMLInputElement).files)" />
        <v-icon size="22" color="#94a3b8">mdi-plus</v-icon>
      </label>
    </div>
    <div v-if="errorMessage" class="rbc-field-error">{{ errorMessage }}</div>
  </template>

  <!-- Preview dialog -->
  <v-dialog v-model="previewDialog" max-width="960">
    <v-card rounded="xl">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #f1f5f9">
        <span style="font-size:14px;font-weight:600">ดูตัวอย่างรูป</span>
        <v-btn icon variant="text" @click="closePreview"><v-icon>mdi-close</v-icon></v-btn>
      </div>
      <div style="display:flex;justify-content:center;align-items:center;padding:16px;background:#0f172a;min-height:360px">
        <img v-if="activePreviewItem" :src="activePreviewItem.src" style="max-width:100%;max-height:70vh;object-fit:contain" />
      </div>
    </v-card>
  </v-dialog>
</div>
</template>
```

- [ ] **Step 4: Replace scoped styles**

```vue
<style scoped>
.rbc-file-input { width: 100%; }

.rbc-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 100px);
  gap: 10px;
}

.rbc-preview-item { position: relative; }

.rbc-preview-image {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  display: block;
}

.rbc-preview-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: rgba(15,23,42,0.6);
  color: #fff;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rbc-preview-add {
  width: 100px;
  height: 100px;
  border: 2px dashed #e2e8f0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.rbc-field-error {
  font-size: 11px;
  color: #dc2626;
  margin-top: 4px;
}
</style>
```

- [ ] **Step 5: Run dev and test upload on a page that uses VeeFileInput**

```bash
npm run dev
```

Go to `/products/create` → upload a product image → verify: WebP conversion runs (check devtools Network tab — uploaded file has `.webp` extension), constraint label shows in drop zone.

- [ ] **Step 6: Commit**

```bash
git add app/components/form/VeeFileInput.vue
git commit -m "feat: add ImageConstraint and WebP conversion to VeeFileInput"
```

---

## Task 5: Form Field Components Restyle

**Files:**
- Modify: `app/components/form/VeeTextField.vue`
- Modify: `app/components/form/VeeSelect.vue`
- Modify: `app/components/form/VeeTextArea.vue`
- Modify: `app/components/form/VeeNumberStepper.vue`
- Modify: `app/components/form/VeeDatePicker.vue`
- Modify: `app/components/form/VeeSwitch.vue`

All form components wrap Vuetify inputs. The global Vuetify defaults in `nuxt.config.ts` (Task 1) already set `variant: "outlined"`, `density: "comfortable"`, `rounded: "lg"` on all inputs. So the only change needed here is adding the `.rbc-input-wrap` wrapper div (for the focus ring override) and ensuring variant/density are passed through consistently.

- [ ] **Step 1: Add wrapper div to VeeTextField.vue**

```vue
<!-- app/components/form/VeeTextField.vue -->
<template>
<div class="rbc-input-wrap">
  <v-text-field
    v-bind="$attrs"
    v-model="inputValue"
    :error-messages="errorMessage"
  />
</div>
</template>
```

Script section is unchanged from current file.

- [ ] **Step 2: Add wrapper div to VeeSelect.vue, VeeTextArea.vue, VeeDatePicker.vue, VeeSwitch.vue, VeeNumberStepper.vue**

Read each file first, then wrap the template root element with `<div class="rbc-input-wrap">` — do not touch script logic.

```bash
cat app/components/form/VeeSelect.vue
cat app/components/form/VeeTextArea.vue
cat app/components/form/VeeDatePicker.vue
cat app/components/form/VeeSwitch.vue
cat app/components/form/VeeNumberStepper.vue
```

For each file, the change is the same pattern: wrap `<template>` body in `<div class="rbc-input-wrap">...</div>`.

- [ ] **Step 3: Run dev and verify all form fields on /products/create look consistent**

```bash
npm run dev
```

Navigate to `/products/create` — all inputs should have rounded orange focus ring, consistent height.

- [ ] **Step 4: Commit**

```bash
git add app/components/form/
git commit -m "feat: add rbc-input-wrap to form field components for consistent styling"
```

---

## Task 6: Dashboard Page Rebuild

**Files:**
- Modify: `app/pages/index.vue`

Current dashboard uses `v-card` + Vuetify Material Design layout. Rebuild with RBC stat cards, delta indicators, chart period selector, and action warning card.

- [ ] **Step 1: Read current index.vue in full**

```bash
cat app/pages/index.vue
```

- [ ] **Step 2: Add pageTitle meta and update template structure**

At top of `<script setup>` in `app/pages/index.vue`:
```ts
// definePageMeta is compile-time in Nuxt 4 — cannot pass computed() here
definePageMeta({ pageTitle: 'ภาพรวม' })

// Dynamic subtitle as a computed ref inside script setup
const todayLabel = computed(() =>
  new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
)
```

Also update `app/layouts/default.vue` topbar to add a subtitle slot:

```vue
<!-- Replace the pageSubtitle div in the topbar with a slot -->
<header v-if="pageTitle" class="rbc-topbar">
  <div>
    <div class="rbc-topbar__title">{{ pageTitle }}</div>
    <div class="rbc-topbar__sub"><slot name="topbar-subtitle" /></div>
  </div>
  <div class="rbc-topbar__actions"><slot name="topbar-actions" /></div>
</header>
```

Then in `app/pages/index.vue` template (after `<template>`):
```vue
<template #topbar-subtitle>{{ todayLabel }}</template>
```

- [ ] **Step 3: Replace stat cards section with rbc-stat-card classes**

Replace each `<v-card>` KPI block with:

```vue
<div class="tw:grid tw:grid-cols-4 tw:gap-4 tw:mb-5">
  <div class="rbc-stat-card rbc-stat-card--orange">
    <div class="rbc-stat-card__icon tw:bg-orange-50">
      <v-icon color="var(--rbc-orange-500)">mdi-package-variant</v-icon>
    </div>
    <div class="rbc-stat-card__label">สินค้าทั้งหมด</div>
    <div class="rbc-stat-card__value">{{ stats.totalProducts }}</div>
    <div class="rbc-stat-card__delta">↑ {{ stats.newThisMonth }} รายการเดือนนี้</div>
  </div>

  <div class="rbc-stat-card rbc-stat-card--green">
    <div class="rbc-stat-card__icon tw:bg-green-50">
      <v-icon color="#22c55e">mdi-check-circle-outline</v-icon>
    </div>
    <div class="rbc-stat-card__label">ขายแล้ว</div>
    <div class="rbc-stat-card__value">{{ stats.soldProducts }}</div>
    <div class="rbc-stat-card__delta" style="color:#16a34a">↑ {{ stats.soldThisWeek }} รายการสัปดาห์นี้</div>
  </div>

  <div class="rbc-stat-card rbc-stat-card--blue">
    <div class="rbc-stat-card__icon tw:bg-blue-50">
      <v-icon color="#3b82f6">mdi-lock-outline</v-icon>
    </div>
    <div class="rbc-stat-card__label">จองแล้ว</div>
    <div class="rbc-stat-card__value">{{ stats.reservedProducts }}</div>
    <div class="rbc-stat-card__delta" style="color:#3b82f6">{{ stats.reservedProducts }} รายการรอยืนยัน</div>
  </div>

  <div class="rbc-stat-card rbc-stat-card--purple">
    <div class="rbc-stat-card__icon tw:bg-purple-50">
      <v-icon color="#a855f7">mdi-currency-usd</v-icon>
    </div>
    <div class="rbc-stat-card__label">กำไรเดือนนี้</div>
    <div class="rbc-stat-card__value tw:text-[18px]">฿{{ stats.profitThisMonth?.toLocaleString() }}</div>
  </div>
</div>
```

> Map `stats.*` to the actual data properties from `useDashboard` / `useDashboardFirestore` that the page already uses. Read the existing composable calls to find the correct property names.

- [ ] **Step 4: Add action-required warning card above stat grid (if reserved items exist)**

```vue
<div v-if="stats.overdueReserved > 0" class="rbc-alert rbc-alert--warning tw:mb-4">
  <v-icon size="18" color="#92400e">mdi-alert-outline</v-icon>
  <span><strong>ต้องดำเนินการ:</strong> มี {{ stats.overdueReserved }} รายการจองที่ค้างนานกว่า 7 วัน</span>
</div>
```

Add `overdueReserved` calculation to the dashboard composable usage — count `RESERVED` products where `updated_at` is > 7 days ago.

- [ ] **Step 5: Restyle chart card**

Wrap the existing ECharts component in `rbc-card`:

```vue
<div class="rbc-card tw:mb-5">
  <div class="rbc-card__header">
    <span class="rbc-card__title">ยอดขายตามแบรนด์</span>
    <v-btn-toggle v-model="chartPeriod" density="compact" variant="outlined" rounded="lg">
      <v-btn value="month" size="small" class="text-none">เดือนนี้</v-btn>
      <v-btn value="3months" size="small" class="text-none">3 เดือน</v-btn>
      <v-btn value="year" size="small" class="text-none">ปีนี้</v-btn>
    </v-btn-toggle>
  </div>
  <div class="rbc-card__body">
    <!-- existing ECharts component stays here -->
  </div>
</div>
```

Add `const chartPeriod = ref('month')` and pass it to the chart composable if it supports filtering; otherwise leave as cosmetic for now.

- [ ] **Step 6: Run dev and verify dashboard**

```bash
npm run dev
```

Check: 4 stat cards visible with gradient bottom strip, orange warning shows if reserved products exist, chart has period toggle.

- [ ] **Step 7: Commit**

```bash
git add app/pages/index.vue
git commit -m "feat: rebuild dashboard with RBC stat cards and delta indicators"
```

---

## Task 7: Products List Page

**Files:**
- Modify: `app/pages/products/index.vue`

Add filter chips, context-aware action buttons, warm table header, search in toolbar.

- [ ] **Step 1: Add filter chips state**

In `<script setup>` add:
```ts
const statusFilter = ref<string>('ALL')

const statusFilters = [
  { label: 'ทั้งหมด', value: 'ALL' },
  { label: 'พร้อมขาย', value: 'ACTIVE' },
  { label: 'จอง', value: 'RESERVED' },
  { label: 'ขายแล้ว', value: 'SOLD' },
]

const filteredProducts = computed(() => {
  if (statusFilter.value === 'ALL') return products.value
  return products.value.filter(p => p.status === statusFilter.value)
})
```

- [ ] **Step 2: Wrap table in rbc-table-wrap and add toolbar**

Replace the current table wrapper with:

```vue
<div class="rbc-table-wrap">
  <!-- Toolbar -->
  <div class="rbc-table-toolbar">
    <v-text-field
      v-model="search"
      density="compact"
      variant="outlined"
      placeholder="ค้นหาสินค้า..."
      prepend-inner-icon="mdi-magnify"
      hide-details
      rounded="lg"
      style="max-width:280px"
    />
    <div
      v-for="f in statusFilters"
      :key="f.value"
      class="rbc-filter-chip"
      :class="{ 'rbc-filter-chip--active': statusFilter === f.value }"
      @click="statusFilter = f.value"
    >
      {{ f.label }}
    </div>
    <v-spacer />
    <v-btn class="rbc-btn-primary" :to="'/products/create'" prepend-icon="mdi-plus">
      เพิ่มสินค้า
    </v-btn>
  </div>

  <!-- Data table — pass filteredProducts instead of products -->
  <v-data-table
    :items="filteredProducts"
    :search="search"
    ...existing props...
  >
    <!-- Status badge cell -->
    <template #item.status="{ item }">
      <span
        class="rbc-badge"
        :class="{
          'rbc-badge--green': item.status === 'ACTIVE',
          'rbc-badge--blue': item.status === 'RESERVED',
          'rbc-badge--orange': item.status === 'SOLD',
          'rbc-badge--gray': item.status === 'DELETED',
        }"
      >
        {{ statusMetaMap[item.status]?.label }}
      </span>
    </template>

    <!-- Context-aware action buttons -->
    <template #item.actions="{ item }">
      <v-btn icon size="small" variant="text" :to="`/products/edit-${item.id}`">
        <v-icon size="18">mdi-pencil-outline</v-icon>
      </v-btn>
      <v-btn
        icon size="small" variant="text"
        color="var(--rbc-orange-600)"
        :disabled="item.status !== 'ACTIVE' && item.status !== 'RESERVED'"
        @click="openSaleDialog(item)"
      >
        <v-icon size="18">mdi-cash-register</v-icon>
      </v-btn>
      <v-btn
        v-if="item.status === 'SOLD'"
        icon size="small" variant="text"
        color="var(--rbc-slate-500)"
        :loading="undoingSaleId === item.id"
        @click="handleUndoSale(item)"
      >
        <v-icon size="18">mdi-undo</v-icon>
      </v-btn>
    </template>
  </v-data-table>
</div>
```

- [ ] **Step 3: Update sale dialog to use product mini-card and channel chips**

Find the existing `<v-dialog>` for sale confirmation and update its body:

```vue
<v-dialog v-model="saleDialog" max-width="480">
  <v-card rounded="xl" :style="{ boxShadow: 'var(--rbc-shadow-modal)' }">
    <div class="rbc-card__header">
      <span class="rbc-card__title">ยืนยันการขาย</span>
      <v-btn icon variant="text" size="small" @click="saleDialog = false">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </div>

    <div class="rbc-card__body">
      <!-- Product mini-card -->
      <div v-if="saleTarget" class="rbc-alert rbc-alert--info tw:mb-4 tw:items-center">
        <v-avatar size="40" rounded="lg" style="background:var(--rbc-orange-200)">
          <v-img v-if="saleTarget.cover_image" :src="saleTarget.cover_image" />
          <v-icon v-else color="var(--rbc-orange-700)">mdi-camera</v-icon>
        </v-avatar>
        <div>
          <div style="font-size:12px;font-weight:700;color:#0f172a">{{ saleTarget.name }}</div>
          <div style="font-size:10px;color:#94a3b8">{{ saleTarget.sku }}</div>
        </div>
        <div style="margin-left:auto;font-size:14px;font-weight:800;color:var(--rbc-orange-700)">
          ฿{{ saleTarget.sell_price?.toLocaleString() }}
        </div>
      </div>

      <!-- Channel chips -->
      <div style="font-size:11px;font-weight:600;color:var(--rbc-slate-500);margin-bottom:6px">
        ช่องทางการขาย <span class="req" style="color:var(--rbc-orange-600)">*</span>
      </div>
      <div class="tw:flex tw:flex-wrap tw:gap-2 tw:mb-4">
        <div
          v-for="ch in saleChannelOptions"
          :key="ch.value"
          class="rbc-filter-chip"
          :class="{ 'rbc-filter-chip--active': saleForm.sold_channel === ch.value }"
          @click="saleForm.sold_channel = ch.value; saleErrors.sold_channel = ''"
        >
          {{ ch.title }}
        </div>
        <div v-if="saleErrors.sold_channel" style="font-size:10px;color:#dc2626;width:100%">
          {{ saleErrors.sold_channel }}
        </div>
      </div>

      <!-- Date + price row -->
      <div class="tw:grid tw:grid-cols-2 tw:gap-3">
        <div>
          <label class="rbc-field-label">วันที่ขาย <span class="req" style="color:var(--rbc-orange-600)">*</span></label>
          <v-text-field v-model="saleForm.sold_at" type="date" density="compact" variant="outlined" rounded="lg"
            :error-messages="saleErrors.sold_at" hide-details="auto" />
        </div>
        <div>
          <label class="rbc-field-label">ราคาที่ขายจริง <span class="req" style="color:var(--rbc-orange-600)">*</span></label>
          <v-text-field v-model="saleForm.sold_price" type="number" density="compact" variant="outlined" rounded="lg"
            :error-messages="saleErrors.sold_price" hide-details="auto" />
        </div>
      </div>
    </div>

    <div style="padding:12px 16px;background:var(--rbc-slate-50);border-top:1px solid var(--rbc-slate-100);display:flex;gap:8px;justify-content:flex-end">
      <v-btn variant="outlined" rounded="lg" class="text-none" @click="saleDialog = false">ยกเลิก</v-btn>
      <v-btn class="rbc-btn-primary" rounded="lg" :loading="saleSubmitting" @click="handleConfirmSale">
        ยืนยันการขาย
      </v-btn>
    </div>
  </v-card>
</v-dialog>
```

- [ ] **Step 4: Run dev and verify products page**

```bash
npm run dev
```

Navigate to `/products` — check: orange table header, filter chips work, action buttons disabled when status doesn't allow it, sale dialog shows product info.

- [ ] **Step 5: Commit**

```bash
git add app/pages/products/index.vue
git commit -m "feat: add filter chips, context-aware actions, and sale modal mini-card to products page"
```

---

## Task 8: ProductEditorForm — Step Indicator + Profit Calculator

**Files:**
- Modify: `app/components/ProductEditorForm.vue`

Add a 3-step header (ข้อมูลทั่วไป → รูปภาพ & ราคา → ตรวจสอบ) and a real-time profit calculation field.

- [ ] **Step 1: Read current ProductEditorForm.vue**

```bash
cat app/components/ProductEditorForm.vue
```

- [ ] **Step 2: Add step state and profit computed**

In `<script setup>`:
```ts
const currentStep = ref(1)
const STEPS = [
  { n: 1, label: 'ข้อมูลทั่วไป' },
  { n: 2, label: 'รูปภาพ & ราคา' },
  { n: 3, label: 'ตรวจสอบ & บันทึก' },
]

// assumes form has fields: cost_price, sell_price (numbers)
const estimatedProfit = computed(() => {
  const cost = Number(form.cost_price ?? 0)
  const sell = Number(form.sell_price ?? 0)
  if (!cost || !sell) return null
  return sell - cost
})
```

> Replace `form.cost_price` / `form.sell_price` with the actual field names from the existing form reactive object.

- [ ] **Step 3: Add step indicator at top of template**

Above the first form field group, add:

```vue
<div class="rbc-steps">
  <template v-for="(step, i) in STEPS" :key="step.n">
    <div class="rbc-step">
      <div
        class="rbc-step__dot"
        :class="{
          'rbc-step__dot--done':   currentStep > step.n,
          'rbc-step__dot--active': currentStep === step.n,
          'rbc-step__dot--pending':currentStep < step.n,
        }"
      >
        <v-icon v-if="currentStep > step.n" size="12">mdi-check</v-icon>
        <span v-else>{{ step.n }}</span>
      </div>
      <span class="rbc-step__label" :class="{ 'rbc-step__label--active': currentStep === step.n }">
        {{ step.label }}
      </span>
    </div>
    <div v-if="i < STEPS.length - 1" class="rbc-step__line" :class="{ 'rbc-step__line--done': currentStep > step.n }" />
  </template>
</div>
```

- [ ] **Step 4: Add estimated profit display next to sell_price field**

After the `sell_price` field, add:

```vue
<div v-if="estimatedProfit !== null" class="rbc-alert rbc-alert--info tw:mt-2">
  <v-icon size="14" color="var(--rbc-orange-700)">mdi-calculator</v-icon>
  กำไรโดยประมาณ:
  <strong :style="{ color: estimatedProfit >= 0 ? '#16a34a' : '#dc2626' }">
    ฿{{ estimatedProfit.toLocaleString() }}
  </strong>
</div>
```

- [ ] **Step 5: Update image upload fields to use ImageConstraint**

Find the product image `<form-vee-file-input>` usage and add the constraint prop:

```vue
<form-vee-file-input
  name="images"
  label="รูปภาพสินค้า"
  :multiple="true"
  :max-files="5"
  :sortable="true"
  :removable="true"
  :constraint="{
    width: 800,
    height: 600,
    maxSizeKB: 300,
    label: '800 × 600 px · JPG/PNG · ≤300 KB · 4:3'
  }"
  :preview-urls="form.image_urls"
/>
```

- [ ] **Step 6: Run dev and verify product form**

```bash
npm run dev
```

Navigate to `/products/create` — check: step indicator shows step 1 active, profit calculation appears when both cost and sell price are filled, image upload shows constraint label.

- [ ] **Step 7: Commit**

```bash
git add app/components/ProductEditorForm.vue
git commit -m "feat: add step indicator and profit calculator to ProductEditorForm"
```

---

## Task 9: Categories Page

**Files:**
- Modify: `app/pages/categories/index.vue`

- [ ] **Step 1: Read current categories/index.vue**

```bash
cat app/pages/categories/index.vue
```

- [ ] **Step 2: Wrap category and subcategory sections in rbc-card with section labels**

```vue
<!-- Category section -->
<div class="rbc-card tw:mb-5">
  <div class="rbc-card__header">
    <span class="rbc-card__title">หมวดหมู่สินค้า</span>
    <v-btn class="rbc-btn-primary" size="small" prepend-icon="mdi-plus" @click="openAddCategory">
      เพิ่มหมวดหมู่
    </v-btn>
  </div>
  <div class="rbc-card__body">
    <!-- existing category table/list here — unchanged logic -->
  </div>
</div>

<!-- Subcategory / brand section -->
<div class="rbc-card">
  <div class="rbc-card__header">
    <span class="rbc-card__title">แบรนด์สินค้า</span>
    <v-btn class="rbc-btn-primary" size="small" prepend-icon="mdi-plus" @click="openAddBrand">
      เพิ่มแบรนด์
    </v-btn>
  </div>
  <div class="rbc-card__body">
    <!-- existing brand table/list here — unchanged logic -->
  </div>
</div>
```

- [ ] **Step 3: Add drag cursor style to sortable items**

In the scoped `<style>` block, add:
```css
.sortable-item { cursor: grab; }
.sortable-item:active { cursor: grabbing; }
```

- [ ] **Step 4: Update category/brand image upload to use ImageConstraint**

Find category image upload:
```vue
<form-vee-file-input
  name="category_image"
  :constraint="{
    width: 800, height: 450, maxSizeKB: 300,
    label: '800 × 450 px · JPG/PNG · ≤300 KB · 16:9'
  }"
/>
```

Find brand logo upload:
```vue
<form-vee-file-input
  name="brand_logo"
  :constraint="{
    width: 600, height: 400, maxSizeKB: 300,
    keepPng: true,
    label: '600 × 400 px · PNG · ≤300 KB · 3:2'
  }"
/>
```

- [ ] **Step 5: Run dev and verify**

```bash
npm run dev
```

Navigate to `/categories` — check: two sections clearly separated with headers, add buttons in card header, upload zones show constraint labels.

- [ ] **Step 6: Commit**

```bash
git add app/pages/categories/index.vue
git commit -m "feat: polish categories page layout with rbc-card sections and image constraints"
```

---

## Task 10: Report Page

**Files:**
- Modify: `app/pages/report/index.vue`

- [ ] **Step 1: Read current report/index.vue**

```bash
cat app/pages/report/index.vue
```

- [ ] **Step 2: Move date filter and export button to a prominent toolbar above the table**

```vue
<div class="rbc-card">
  <!-- Filter toolbar -->
  <div class="rbc-card__header tw:flex-wrap tw:gap-3">
    <span class="rbc-card__title">รายงานการขาย</span>
    <div class="tw:flex tw:items-center tw:gap-2 tw:ml-auto tw:flex-wrap">
      <v-text-field
        v-model="filterDateFrom"
        type="date"
        label="จาก"
        density="compact"
        variant="outlined"
        rounded="lg"
        hide-details
        style="width:160px"
      />
      <span style="color:#94a3b8;font-size:12px">ถึง</span>
      <v-text-field
        v-model="filterDateTo"
        type="date"
        label="ถึง"
        density="compact"
        variant="outlined"
        rounded="lg"
        hide-details
        style="width:160px"
      />
      <v-btn class="rbc-btn-ghost" prepend-icon="mdi-download" @click="exportCsv">
        Export CSV
      </v-btn>
    </div>
  </div>

  <!-- Table stays inside card body — logic unchanged -->
  <div class="rbc-table-wrap" style="box-shadow:none;border-radius:0">
    <!-- existing v-data-table here -->
  </div>
</div>
```

> Replace `filterDateFrom`, `filterDateTo`, `exportCsv` with the actual variable names from the existing component.

- [ ] **Step 3: Run dev and verify**

```bash
npm run dev
```

Navigate to `/report` — date filters and Export button visible at top without scrolling.

- [ ] **Step 4: Commit**

```bash
git add app/pages/report/index.vue
git commit -m "feat: promote date filter and export button to report page toolbar"
```

---

## Task 11: Settings Page — Banner + Credit + Image Constraints

**Files:**
- Modify: `app/pages/settings/index.vue`

- [ ] **Step 1: Read full settings/index.vue**

```bash
cat app/pages/settings/index.vue
```

- [ ] **Step 2: Add section structure with rbc-card per section**

Wrap each section:

```vue
<!-- Banner section -->
<div class="rbc-card tw:mb-5">
  <div class="rbc-card__header">
    <span class="rbc-card__title">🖼 Banner หน้าแรก</span>
    <span style="font-size:10px;color:var(--rbc-slate-400)">สูงสุด 5 รูป</span>
  </div>
  <div class="rbc-card__body">
    <div class="rbc-section-label">ความเร็ว Auto-slide</div>
    <!-- existing bannerAutoSlideSec slider here -->

    <div class="rbc-section-label tw:mt-4">รายการ Banner</div>
    <!-- Per-banner rows with inline image upload -->
    <div v-for="(banner, i) in banners" :key="banner.id" class="tw:flex tw:items-center tw:gap-3 tw:mb-3 tw:p-3 tw:bg-slate-50 tw:rounded-xl tw:border tw:border-slate-200">
      <!-- Thumbnail preview -->
      <div style="width:100px;height:32px;border-radius:6px;overflow:hidden;background:#e2e8f0;flex-shrink:0">
        <img v-if="banner.preview_url" :src="banner.preview_url" style="width:100%;height:100%;object-fit:cover" />
      </div>

      <!-- Upload button -->
      <label style="cursor:pointer">
        <input type="file" accept="image/jpeg,image/png" style="display:none"
          @change="(e) => handleBannerFileChange(e, i)" />
        <span class="rbc-filter-chip">
          <v-icon size="14">mdi-image-edit-outline</v-icon> เปลี่ยนรูป
        </span>
      </label>

      <!-- Constraint hint -->
      <span style="font-size:10px;color:var(--rbc-slate-400)">1920 × 600 px · ≤500 KB</span>

      <!-- Active toggle -->
      <v-switch v-model="banner.active" density="compact" hide-details color="success" class="tw:ml-auto" />

      <!-- Drag handle -->
      <v-icon size="18" color="var(--rbc-slate-400)" style="cursor:grab">mdi-drag-vertical</v-icon>

      <!-- Remove -->
      <v-btn icon size="small" variant="text" color="error" @click="removeBanner(i)">
        <v-icon size="16">mdi-delete-outline</v-icon>
      </v-btn>
    </div>

    <v-btn variant="outlined" rounded="lg" class="text-none" prepend-icon="mdi-plus"
      @click="addBanner" :disabled="banners.length >= 5">
      เพิ่ม Banner
    </v-btn>
  </div>
</div>

<!-- Credit section -->
<div class="rbc-card tw:mb-5">
  <div class="rbc-card__header">
    <span class="rbc-card__title">👥 รีวิวลูกค้า (Credit)</span>
  </div>
  <div class="rbc-card__body">
    <!-- same pattern as banners but for credits -->
    <!-- constraint: 800×800 px · ≤300 KB -->
  </div>
</div>

<!-- Save button -->
<div class="tw:flex tw:justify-end">
  <v-btn class="rbc-btn-primary" size="large" :loading="saving" @click="handleSave">
    <v-icon start>mdi-content-save-outline</v-icon>
    บันทึกการตั้งค่า
  </v-btn>
</div>
```

- [ ] **Step 3: Add handleBannerFileChange to process banner images with constraint**

In `<script setup>`, add:

```ts
const { processImage } = useImageUpload()

const BANNER_CONSTRAINT: ImageConstraint = {
  width: 1920, height: 600, maxSizeKB: 500,
  label: '1920 × 600 px · JPG/PNG · ≤500 KB'
}

const CREDIT_CONSTRAINT: ImageConstraint = {
  width: 800, height: 800, maxSizeKB: 300,
  label: '800 × 800 px · JPG/PNG · ≤300 KB'
}

async function handleBannerFileChange(event: Event, index: number) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const result = await processImage(file, BANNER_CONSTRAINT)
  if (!result.ok) {
    appToast.error(result.error)
    return
  }
  if (result.warning) appToast.warning(result.warning)

  revokePreviewUrl(banners.value[index]?.preview_url)
  const blob = result.blob
  banners.value[index] = {
    ...banners.value[index]!,
    file: new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }),
    preview_url: URL.createObjectURL(blob),
  }
}

async function handleCreditFileChange(event: Event, index: number) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const result = await processImage(file, CREDIT_CONSTRAINT)
  if (!result.ok) {
    appToast.error(result.error)
    return
  }
  if (result.warning) appToast.warning(result.warning)

  revokePreviewUrl(credits.value[index]?.preview_url)
  const blob = result.blob
  credits.value[index] = {
    ...credits.value[index]!,
    file: new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }),
    preview_url: URL.createObjectURL(blob),
  }
}
```

- [ ] **Step 4: Run dev and verify settings page**

```bash
npm run dev
```

Navigate to `/settings` — check: two distinct card sections, banner thumbnails show at correct 1920:600 ratio (wide slim), upload triggers WebP conversion (check devtools Network), active toggle visible per banner.

- [ ] **Step 5: Commit**

```bash
git add app/pages/settings/index.vue
git commit -m "feat: rebuild settings page with card sections and banner/credit image constraints"
```

---

## Task 12: Login Page Polish

**Files:**
- Modify: `app/pages/login.vue`

Login page is already good (glassmorphism warm design). Minor: align button color with new primary token.

- [ ] **Step 1: Read current login.vue**

```bash
cat app/pages/login.vue
```

- [ ] **Step 2: Replace any hardcoded orange hex with CSS variables or Vuetify primary**

Find any `color: #f5962f` or `background: #f5962f` in the scoped CSS and replace with `var(--rbc-orange-500)`.

Find the Google Sign-in button and add `class="rbc-btn-primary"` or set `color="primary"`.

- [ ] **Step 3: Run dev and verify**

```bash
npm run dev
```

Navigate to `/` while logged out → login page appears with warm gradient, button is correct orange.

- [ ] **Step 4: Commit**

```bash
git add app/pages/login.vue
git commit -m "feat: align login page colors with design token system"
```

---

## Task 13: End-to-End Verification

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 2: Walk through all pages and check visual consistency**

| Route | Check |
|-------|-------|
| `/` (login) | Warm gradient, orange button |
| `/` (dashboard) | 4 stat cards, chart, optional warning |
| `/products` | Orange table header, filter chips, context action buttons |
| `/products/create` | Step indicator, profit calc, constraint upload zone |
| `/products/edit-[id]` | Same as create |
| `/categories` | Two card sections, constraint upload |
| `/report` | Date filter + export at top |
| `/settings` | Banner and credit card sections, constraint hint per row |

- [ ] **Step 3: Test full UX flow**

1. Create a product (step 1 → 2 → 3, upload image, verify WebP in network tab)
2. List products → click "จอง" status filter
3. Click "ยืนยันการขาย" → select channel chip → enter price → confirm
4. Go to Dashboard → verify stat cards reflect new numbers
5. Go to Report → filter by date → export CSV
6. Go to Settings → upload banner → verify slim 1920×600 preview thumbnail

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Deploy to dev hosting**

```bash
npm run deploy:hosting:dev
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: final UI redesign verification and cleanup"
```
