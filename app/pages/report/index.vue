<script setup lang="ts">
import { format } from "date-fns";
import type { DataTableHeader, DataTableSortItem } from "vuetify";
import type { DashboardBrandStatsRecord, DashboardStatsRecord, OrderRecord } from "~/composables/firestore/types";

type ReportRow = {
  id: string;
  category_name: string;
  name: string;
  brand_name: string;
  sold_at: unknown;
  cost_price_at_sale: number;
  sold_price: number;
  profit: number;
  sold_channel: string;
};

const { getDashboardStats, getDashboardBrandStats, getReportPage } = useBackofficeFirestore();
const appToast = useAppToast();

const loading = ref(false);
const exporting = ref(false);
const month = ref("");
const stats = ref<DashboardStatsRecord | null>(null);
const brandStats = ref<DashboardBrandStatsRecord[]>([]);
const rows = ref<ReportRow[]>([]);
const sortBy = ref<DataTableSortItem[]>([{ key: "sold_at", order: "desc" }]);

const headers: DataTableHeader[] = [
  { title: "ID:", key: "id", sortable: false },
  { title: "Categories", key: "category_name", sortable: true },
  { title: "Name", key: "name", sortable: true },
  { title: "Brands", key: "brand_name", sortable: true },
  {
    title: "วันที่ขาย",
    key: "sold_at",
    sortable: true,
    sortRaw: (a, b) => getSortableTime((a as ReportRow).sold_at) - getSortableTime((b as ReportRow).sold_at),
  },
  { title: "ราคาทุน", key: "cost_price_at_sale", sortable: true },
  { title: "ราคาขาย", key: "sold_price", sortable: true },
  { title: "กำไรสุทธิ", key: "profit", sortable: true },
  { title: "ช่องทางการขาย", key: "sold_channel", sortable: true },
];

const toDate = (value: unknown) => {
  if (!value) return null;

  const date =
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
      ? (value as { toDate: () => Date }).toDate()
      : new Date(value as string | number | Date);

  return Number.isNaN(date.getTime()) ? null : date;
};

const getSortableTime = (value: unknown) => toDate(value)?.getTime() ?? 0;

const formatDate = (value: unknown) => {
  const date = toDate(value);
  return date ? format(date, "dd/MM/yyyy") : "-";
};

const formatMoney = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "฿ 0.00";
  return `฿ ${value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const chartData = computed(() =>
  brandStats.value.map((item) => ({
    label: String(item.brand_name || item.brand_id || "-"),
    qty: Number(item.sales_count ?? 0),
    amount: Number(item.sales_amount ?? 0),
  }))
);

const summaryCards = computed(() => [
  {
    title: "ต้นทุนทั้งหมด",
    value: formatMoney(stats.value?.total_cost_amount ?? 0),
  },
  {
    title: "ยอดขายทั้งหมด",
    value: formatMoney(stats.value?.total_sales_amount ?? 0),
  },
  {
    title: "กำไรสุทธิ",
    value: formatMoney(stats.value?.total_profit_amount ?? 0),
  },
]);

const loadReport = async () => {
  loading.value = true;
  try {
    const filter = month.value ? { month: month.value } : {};
    const [dashboardStats, dashboardBrandStats, reportPage] = await Promise.all([
      getDashboardStats(filter),
      getDashboardBrandStats({ ...filter, count: 8 }),
      getReportPage({ ...filter, pageSize: 100 }),
    ]);

    stats.value = dashboardStats;
    brandStats.value = dashboardBrandStats;
    rows.value = reportPage.items.map((item: OrderRecord) => ({
      id: item.id,
      category_name: String(item.product_snapshot?.category_name ?? "-"),
      name: String(item.product_snapshot?.name ?? "-"),
      brand_name: String(item.brand_name ?? item.product_snapshot?.brand_name ?? "-"),
      sold_at: item.sold_at,
      cost_price_at_sale: Number(item.cost_price_at_sale ?? 0),
      sold_price: Number(item.sold_price ?? 0),
      profit: Number(item.profit ?? 0),
      sold_channel: String(item.sold_channel ?? "-"),
    }));
  } catch (error) {
    console.error("โหลดรายงานไม่สำเร็จ", error);
    appToast.error("โหลดรายงานไม่สำเร็จ");
  } finally {
    loading.value = false;
  }
};

const exportCsv = async () => {
  if (!rows.value.length) {
    appToast.error("ยังไม่มีข้อมูลสำหรับ export");
    return;
  }

  exporting.value = true;
  try {
    const header = ["ID", "Categories", "Name", "Brands", "วันที่ขาย", "ราคาทุน", "ราคาขาย", "กำไรสุทธิ", "ช่องทางการขาย"];
    const lines = rows.value.map((row) => [
      row.id,
      row.category_name,
      row.name,
      row.brand_name,
      formatDate(row.sold_at),
      String(row.cost_price_at_sale),
      String(row.sold_price),
      String(row.profit),
      row.sold_channel,
    ]);

    const csv = [header, ...lines]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, "\"\"")}"`).join(","))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `report-${month.value || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    appToast.success("Export report สำเร็จ");
  } catch (error) {
    console.error("Export report ไม่สำเร็จ", error);
    appToast.error("Export report ไม่สำเร็จ");
  } finally {
    exporting.value = false;
  }
};

watch(month, () => {
  loadReport();
});

onMounted(loadReport);
</script>

<template>
  <div class="tw:min-h-screen tw:bg-black tw:px-4 tw:py-6 md:tw:px-8 md:tw:py-8">
    <div class="tw:mx-auto tw:flex tw:max-w-[1400px] tw:flex-col tw:gap-6">
      <div class="tw:flex tw:flex-col tw:gap-4 md:tw:flex-row md:tw:items-center md:tw:justify-between">
        <div>
          <h1 class="tw:text-4xl tw:font-black tw:text-white md:tw:text-5xl">Report</h1>
        </div>

        <div class="tw:flex tw:flex-col tw:gap-3 sm:tw:flex-row sm:tw:items-center">
          <v-text-field
            v-model="month"
            type="month"
            label="เดือนที่ขาย"
            variant="solo-filled"
            flat
            hide-details
            density="comfortable"
            bg-color="white"
            clearable
            class="tw:min-w-[190px]"
          />

          <v-btn
            color="#f5962f"
            rounded="pill"
            size="large"
            class="tw:px-6 tw:font-bold tw:normal-case tw:text-white"
            :loading="exporting"
            @click="exportCsv()"
          >
            Export
          </v-btn>
        </div>
      </div>

      <div class="tw:grid tw:gap-5 lg:tw:grid-cols-[minmax(0,1fr)_280px]">
        <v-card
          rounded="xl"
          elevation="0"
          class="tw:overflow-hidden tw:border-2 tw:border-black tw:bg-white"
        >
          <div class="tw:p-6">
            <div class="tw:mb-5 tw:text-2xl tw:font-black tw:text-black">
              ยอดขายแยกตาม Brands
            </div>
            <BrandBarChart :data="chartData" metric="amount" :height="320" />
          </div>
        </v-card>

        <div class="tw:flex tw:flex-col tw:gap-4">
          <v-card
            v-for="card in summaryCards"
            :key="card.title"
            rounded="xl"
            elevation="0"
            class="tw:border-2 tw:border-black tw:bg-white"
          >
            <div class="tw:px-6 tw:py-6">
              <div class="tw:border-b tw:border-neutral-200 tw:pb-4 tw:text-center tw:text-2xl tw:font-black tw:text-neutral-500">
                {{ card.title }}
              </div>
              <div class="tw:pt-5 tw:text-center tw:text-3xl tw:font-black tw:text-[#0f2b20]">
                {{ card.value }}
              </div>
            </div>
          </v-card>
        </div>
      </div>

      <v-card
        rounded="xl"
        elevation="0"
        class="tw:overflow-hidden tw:border-2 tw:border-black tw:bg-white"
      >
        <v-data-table
          class="pa-2 md:pa-4"
          :headers="headers"
          :items="rows"
          :loading="loading"
          v-model:sort-by="sortBy"
          item-value="id"
          items-per-page="5"
          hover
        >
          <template #item.id="{ item }">
            <span class="tw:text-sm tw:font-semibold tw:text-black">{{ item.id || "-" }}</span>
          </template>

          <template #item.category_name="{ item }">
            <span class="tw:text-sm tw:font-semibold tw:text-black">{{ item.category_name }}</span>
          </template>

          <template #item.name="{ item }">
            <span class="tw:text-sm tw:text-black">{{ item.name }}</span>
          </template>

          <template #item.brand_name="{ item }">
            <span class="tw:text-sm tw:font-semibold tw:text-black">{{ item.brand_name }}</span>
          </template>

          <template #item.sold_at="{ item }">
            <span class="tw:text-sm tw:text-black">{{ formatDate(item.sold_at) }}</span>
          </template>

          <template #item.cost_price_at_sale="{ item }">
            <span class="tw:text-sm tw:text-black">{{ Number(item.cost_price_at_sale).toLocaleString("th-TH") }}</span>
          </template>

          <template #item.sold_price="{ item }">
            <span class="tw:text-sm tw:text-black">{{ Number(item.sold_price).toLocaleString("th-TH") }}</span>
          </template>

          <template #item.profit="{ item }">
            <span
              class="tw:text-sm tw:font-black"
              :class="Number(item.profit) >= 0 ? 'tw:text-[#36d870]' : 'tw:text-[#ef5b3e]'"
            >
              {{ Number(item.profit) > 0 ? "+" : "" }}{{ Number(item.profit).toLocaleString("th-TH") }}
            </span>
          </template>

          <template #item.sold_channel="{ item }">
            <span class="tw:text-sm tw:font-semibold tw:text-[#36d870]">{{ item.sold_channel }}</span>
          </template>

          <template #no-data>
            <div class="tw:px-6 tw:py-14 tw:text-center tw:text-neutral-500">
              ยังไม่มีข้อมูลรายงาน
            </div>
          </template>
        </v-data-table>
      </v-card>
    </div>
  </div>
</template>
