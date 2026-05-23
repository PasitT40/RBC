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
        },
        VCard: { rounded: "xl" },
        VTextField: { variant: "outlined", density: "comfortable", rounded: "lg" },
        VSelect: { variant: "outlined", density: "comfortable", rounded: "lg" },
        VTextarea: { variant: "outlined", density: "comfortable", rounded: "lg" },
        VDataTable: {
          density: 'comfortable',
        },
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
