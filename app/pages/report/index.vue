<script setup lang="ts">
import { format } from "date-fns";
import type { DataTableHeader, DataTableSortItem } from "vuetify";
import type { DashboardBrandStatsRecord, DashboardStatsRecord, OrderRecord } from "~/composables/firestore/types";

type ReportRow = {
  id: string;
  sku: string;
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
const fromMonth = ref("");
const toMonth = ref("");
const stats = ref<DashboardStatsRecord | null>(null);
const brandStats = ref<DashboardBrandStatsRecord[]>([]);
const rows = ref<ReportRow[]>([]);
const sortBy = ref<DataTableSortItem[]>([{ key: "sold_at", order: "desc" }]);

const headers: DataTableHeader[] = [
  { title: "เลขที่รายการ", key: "id", sortable: false },
  { title: "SKU", key: "sku", sortable: true },
  { title: "หมวดหมู่", key: "category_name", sortable: true },
  { title: "สินค้า", key: "name", sortable: true },
  { title: "แบรนด์", key: "brand_name", sortable: true },
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
  if (typeof value !== "number" || Number.isNaN(value)) return "฿ 0";
  return `฿ ${value.toLocaleString("th-TH")}`;
};

const formatNumber = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return value.toLocaleString("th-TH");
};

const getProfitToneClass = (value?: number | null) => {
  const amount = Number(value ?? 0);
  if (amount > 0) return "report-text-profit";
  if (amount < 0) return "report-text-loss";
  return "report-text-muted";
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
    valueClass: "report-text-cost",
  },
  {
    title: "ยอดขายทั้งหมด",
    value: formatMoney(stats.value?.total_sales_amount ?? 0),
    valueClass: "report-text-sales",
  },
  {
    title: "กำไรสุทธิ",
    value: formatMoney(stats.value?.total_profit_amount ?? 0),
    valueClass: getProfitToneClass(stats.value?.total_profit_amount ?? 0),
  },
]);

const reportFilter = computed(() => {
  if (fromMonth.value || toMonth.value) {
    return {
      fromMonth: fromMonth.value || toMonth.value,
      toMonth: toMonth.value || fromMonth.value,
    };
  }

  return {};
});

const loadReport = async () => {
  loading.value = true;
  try {
    const filter = reportFilter.value;
    const [dashboardStats, dashboardBrandStats, reportPage] = await Promise.all([
      getDashboardStats(filter),
      getDashboardBrandStats({ ...filter, count: 8 }),
      getReportPage({ ...filter, pageSize: 100 }),
    ]);

    stats.value = dashboardStats;
    brandStats.value = dashboardBrandStats;
    rows.value = reportPage.items.map((item: OrderRecord) => ({
      id: item.id,
      sku: String(item.product_snapshot?.sku ?? "-"),
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
    appToast.error(error, "โหลดข้อมูลรายงานไม่สำเร็จ");
  } finally {
    loading.value = false;
  }
};

const exportCsv = async () => {
  if (!rows.value.length) {
    appToast.error("ยังไม่มีข้อมูลให้ส่งออก");
    return;
  }

  exporting.value = true;
  try {
    const header = ["เลขที่รายการ", "SKU", "หมวดหมู่", "สินค้า", "แบรนด์", "วันที่ขาย", "ราคาทุน", "ราคาขาย", "กำไรสุทธิ", "ช่องทางการขาย"];
    const lines = rows.value.map((row) => [
      row.id,
      row.sku,
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
    link.download = `report-${fromMonth.value || "all"}-${toMonth.value || fromMonth.value || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    appToast.success("ส่งออกรายงานสำเร็จ");
  } catch (error) {
    console.error("ส่งออกรายงานไม่สำเร็จ", error);
    appToast.error(error, "ส่งออกรายงานไม่สำเร็จ");
  } finally {
    exporting.value = false;
  }
};

watch([fromMonth, toMonth], () => {
  loadReport();
});

onMounted(loadReport);
</script>

<template>
  <div>
    <TopbarTeleport to="#rbc-topbar-subtitle">
      <span v-if="fromMonth || toMonth">
        {{ fromMonth || '?' }} — {{ toMonth || '?' }}
      </span>
      <span v-else>ทุกช่วงเวลา</span>
    </TopbarTeleport>
    <TopbarTeleport to="#rbc-topbar-actions">
      <v-btn
        variant="outlined"
        color="grey-darken-1"
        prepend-icon="mdi-close"
        :disabled="!fromMonth && !toMonth"
        @click="fromMonth = ''; toMonth = ''"
      >
        ล้างช่วง
      </v-btn>
      <v-btn
        class="rbc-btn-primary ml-2"
        prepend-icon="mdi-download"
        :loading="exporting"
        @click="exportCsv()"
      >
        Export CSV
      </v-btn>
    </TopbarTeleport>

    <div class="rbc-page-container tw:py-6">

      <!-- Date filter card -->
      <div class="rbc-card tw:mb-5">
        <div class="rbc-card__header">
          <div class="rbc-card__title">
            <v-icon size="16" color="primary">mdi-calendar-range</v-icon>
            กรองตามช่วงเวลา
          </div>
        </div>
        <div class="rbc-card__body">
          <div class="tw:flex tw:flex-wrap tw:items-end tw:gap-3">
            <v-text-field
              v-model="fromMonth"
              type="month"
              label="จาก"
              variant="outlined"
              density="compact"
              hide-details
              style="max-width: 200px;"
            />
            <v-text-field
              v-model="toMonth"
              type="month"
              label="ถึง"
              variant="outlined"
              density="compact"
              hide-details
              style="max-width: 200px;"
            />
            <v-btn variant="outlined" color="grey-darken-1" size="small" rounded="lg" @click="fromMonth = ''; toMonth = ''">
              <v-icon start size="14">mdi-close</v-icon>
              ล้างช่วง
            </v-btn>
          </div>
        </div>
      </div>

      <!-- Stat cards -->
      <v-row class="tw:mb-5">
        <v-col cols="12" sm="4">
          <div class="rbc-stat-card" style="--color: #64748b">
            <div class="rbc-stat-card__icon">
              <v-icon size="22" color="#64748b">mdi-wallet-outline</v-icon>
            </div>
            <div class="rbc-stat-card__label">ต้นทุนทั้งหมด</div>
            <div class="rbc-stat-card__value">{{ formatNumber(stats?.total_cost_amount ?? 0) }}</div>
          </div>
        </v-col>
        <v-col cols="12" sm="4">
          <div class="rbc-stat-card" style="--color: #f97316">
            <div class="rbc-stat-card__icon">
              <v-icon size="22" color="#f97316">mdi-cash-multiple</v-icon>
            </div>
            <div class="rbc-stat-card__label">ยอดขายทั้งหมด</div>
            <div class="rbc-stat-card__value">{{ formatNumber(stats?.total_sales_amount ?? 0) }}</div>
          </div>
        </v-col>
        <v-col cols="12" sm="4">
          <div class="rbc-stat-card" :style="(stats?.total_profit_amount ?? 0) >= 0 ? '--color: #22c55e' : '--color: #ef4444'">
            <div class="rbc-stat-card__icon">
              <v-icon size="22" :color="(stats?.total_profit_amount ?? 0) >= 0 ? '#22c55e' : '#ef4444'">mdi-trending-up</v-icon>
            </div>
            <div class="rbc-stat-card__label">กำไรสุทธิ</div>
            <div class="rbc-stat-card__value">{{ formatNumber(stats?.total_profit_amount ?? 0) }}</div>
          </div>
        </v-col>
      </v-row>

      <!-- Chart card -->
      <div class="rbc-card tw:mb-5">
        <div class="rbc-card__header">
          <div class="rbc-card__title">
            <v-icon size="16" color="primary">mdi-chart-bar</v-icon>
            ยอดขายตามแบรนด์
          </div>
        </div>
        <div class="rbc-card__body">
          <BrandBarChart :data="chartData" metric="amount" :height="320" />
        </div>
      </div>

      <!-- Table section -->
      <div class="rbc-table-section">
        <div class="rbc-table-section__header">
          <div class="rbc-table-section__title">
            <span class="rbc-section-label">รายการขาย</span>
            <span class="rbc-table-section__count">{{ rows.length }} รายการ</span>
          </div>
          <v-btn
            variant="outlined"
            color="primary"
            size="small"
            rounded="lg"
            prepend-icon="mdi-download"
            :loading="exporting"
            @click="exportCsv()"
          >
            Export CSV
          </v-btn>
        </div>
        <div class="rbc-table-wrap">
          <v-data-table
            :headers="headers"
            :items="rows"
            :loading="loading"
            v-model:sort-by="sortBy"
            item-value="id"
            items-per-page="10"
            hover
          >
            <template #item.id="{ item }">
              <code class="tw:rounded tw:bg-slate-100 tw:px-2 tw:py-0.5 tw:text-xs tw:text-slate-500">{{ item.id || "-" }}</code>
            </template>

            <template #item.sku="{ item }">
              <span class="tw:text-xs tw:font-semibold tw:text-slate-700">{{ item.sku || "-" }}</span>
            </template>

            <template #item.category_name="{ item }">
              <span class="tw:text-sm tw:text-slate-700">{{ item.category_name }}</span>
            </template>

            <template #item.name="{ item }">
              <span class="tw:text-sm tw:font-semibold tw:text-slate-800">{{ item.name }}</span>
            </template>

            <template #item.brand_name="{ item }">
              <span class="tw:text-sm tw:text-slate-700">{{ item.brand_name }}</span>
            </template>

            <template #item.sold_at="{ item }">
              <span class="tw:whitespace-nowrap tw:text-xs tw:text-slate-500">{{ formatDate(item.sold_at) }}</span>
            </template>

            <template #item.cost_price_at_sale="{ item }">
              <span class="tw:text-sm tw:font-semibold report-text-cost">{{ formatNumber(item.cost_price_at_sale) }}</span>
            </template>

            <template #item.sold_price="{ item }">
              <span class="tw:text-sm tw:font-bold report-text-sales">{{ formatNumber(item.sold_price) }}</span>
            </template>

            <template #item.profit="{ item }">
              <span :class="getProfitToneClass(item.profit)" class="tw:text-sm tw:font-bold">
                {{ Number(item.profit) > 0 ? "+" : "" }}{{ formatNumber(item.profit) }}
              </span>
            </template>

            <template #item.sold_channel="{ item }">
              <span class="tw:rounded-full tw:bg-slate-100 tw:px-2 tw:py-0.5 tw:text-xs tw:font-semibold tw:text-slate-600">{{ item.sold_channel }}</span>
            </template>

            <template #no-data>
              <div class="tw:py-10 tw:text-center tw:text-sm tw:text-slate-400">
                ยังไม่มีข้อมูลรายงาน
              </div>
            </template>
          </v-data-table>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.report-text-cost {
  color: rgb(var(--v-theme-warning));
}

.report-text-sales {
  color: rgb(var(--v-theme-primary));
}

.report-text-profit {
  color: rgb(var(--v-theme-success));
}

.report-text-loss {
  color: rgb(var(--v-theme-error));
}

.report-text-muted {
  color: rgba(var(--v-theme-on-surface), 0.68);
}
</style>
