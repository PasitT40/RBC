<script lang="ts" setup>
type ChartRow = {
  Product: string;
  qty: number;
  amount: number;
};

const dashboard = useDashboard();

const fallbackChartRows = ref<ChartRow[]>([
  { Product: "Product 1", qty: 10, amount: 100 },
  { Product: "Product 2", qty: 20, amount: 200 },
  { Product: "Product 3", qty: 30, amount: 300 },
  { Product: "Product 4", qty: 10, amount: 100 },
  { Product: "Product 5", qty: 20, amount: 200 },
  { Product: "Product 6", qty: 30, amount: 300 },
  { Product: "Product 7", qty: 10, amount: 100 },
  { Product: "Product 8", qty: 20, amount: 200 },
  { Product: "Product 9", qty: 30, amount: 300 },
  { Product: "Product 10", qty: 10, amount: 100 },
  { Product: "Product 11", qty: 20, amount: 200 },
  { Product: "Product 12", qty: 30, amount: 300 },
]);

const dashboardStats = computed(() => dashboard.dashboardStats.value);
const totalProducts = computed(() => dashboardStats.value?.total_products ?? 0);
const totalSold = computed(() => dashboardStats.value?.total_sales_count ?? 0);
const totalReserved = computed(() => dashboardStats.value?.reserved_products ?? 0);
const totalCostAmount = computed(() => Number(dashboardStats.value?.total_cost_amount ?? 0));
const totalSalesAmount = computed(() => Number(dashboardStats.value?.total_sales_amount ?? 0));
const totalProfitAmount = computed(() => Number(dashboardStats.value?.total_profit_amount ?? 0));

const formatInteger = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("th-TH");

const formatCurrency = (value: number | null | undefined) =>
  `฿ ${Number(value ?? 0).toLocaleString("th-TH")}`;

const profitToneClass = computed(() =>
  totalProfitAmount.value < 0 ? "text-error" : "text-success"
);

const chartRows = computed<ChartRow[]>(() => {
  if (dashboard.brandSeries.value.length > 0) {
    return dashboard.brandSeries.value.map((item) => ({
      Product: item.label,
      qty: item.qty,
      amount: item.amount,
    }));
  }

  return fallbackChartRows.value;
});

const chartOption = computed(() => ({
  tooltip: {
    trigger: "axis",
    axisPointer: { type: "shadow" },
  },
  dataset: {
    dimensions: ["Product", "qty", "amount"],
    source: chartRows.value,
  },
  xAxis: { type: "category" },
  yAxis: {},
  series: [
    {
      type: "bar",
      encode: { x: "Product", y: "amount" },
      name: "มูลค่ายอดขาย",
      itemStyle: { color: "#f97316" },
    },
  ],
}));

// Period selector
const selectedPeriod = ref<"month" | "3m" | "year" | null>(null);

const setPeriod = (period: "month" | "3m" | "year") => {
  selectedPeriod.value = period;
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (period === "month") {
    dashboard.month.value = currentMonth;
    dashboard.fromMonth.value = "";
    dashboard.toMonth.value = "";
  } else if (period === "3m") {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    dashboard.fromMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    dashboard.toMonth.value = currentMonth;
    dashboard.month.value = "";
  } else {
    dashboard.fromMonth.value = `${now.getFullYear()}-01`;
    dashboard.toMonth.value = currentMonth;
    dashboard.month.value = "";
  }
  dashboard.loadDashboard();
};

onMounted(() => {
  dashboard.loadDashboard();
});
</script>

<template>
  <template #topbar-subtitle>
    <span>ข้อมูล ณ วันนี้</span>
  </template>

  <template #topbar-actions>
    <span
      class="rbc-filter-chip"
      :class="{ 'rbc-filter-chip--active': selectedPeriod === 'month' }"
      @click="setPeriod('month')"
    >เดือนนี้</span>
    <span
      class="rbc-filter-chip"
      :class="{ 'rbc-filter-chip--active': selectedPeriod === '3m' }"
      @click="setPeriod('3m')"
    >3 เดือน</span>
    <span
      class="rbc-filter-chip"
      :class="{ 'rbc-filter-chip--active': selectedPeriod === 'year' }"
      @click="setPeriod('year')"
    >ปีนี้</span>
  </template>

  <div v-if="!dashboard.loading.value">
    <!-- KPI stat cards -->
    <v-row>
      <v-col cols="12" sm="6" md="3">
        <div class="rbc-stat-card rbc-stat-card--orange">
          <div class="rbc-stat-card__icon">
            <v-icon color="#f97316">mdi-package-variant</v-icon>
          </div>
          <div class="rbc-stat-card__label">สินค้าทั้งหมด</div>
          <div class="rbc-stat-card__value">{{ formatInteger(totalProducts) }}</div>
          <div class="mt-1" style="font-size: 11px; color: var(--rbc-slate-400);">รวมสินค้าทุกสถานะ</div>
        </div>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <div class="rbc-stat-card rbc-stat-card--green">
          <div class="rbc-stat-card__icon">
            <v-icon color="#22c55e">mdi-check-circle-outline</v-icon>
          </div>
          <div class="rbc-stat-card__label">ขายแล้ว</div>
          <div class="rbc-stat-card__value">{{ formatInteger(totalSold) }}</div>
          <div class="mt-1" style="font-size: 11px; color: var(--rbc-slate-400);">จำนวนรายการที่ขายแล้ว</div>
        </div>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <div class="rbc-stat-card rbc-stat-card--blue">
          <div class="rbc-stat-card__icon">
            <v-icon color="#3b82f6">mdi-clock-outline</v-icon>
          </div>
          <div class="rbc-stat-card__label">จองแล้ว</div>
          <div class="rbc-stat-card__value">{{ formatInteger(totalReserved) }}</div>
          <div class="mt-1" style="font-size: 11px; color: var(--rbc-slate-400);">รายการที่จองและรอปิดขาย</div>
        </div>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <div class="rbc-stat-card rbc-stat-card--purple">
          <div class="rbc-stat-card__icon">
            <v-icon color="#a855f7">mdi-trending-up</v-icon>
          </div>
          <div class="rbc-stat-card__label">กำไรสุทธิ</div>
          <div class="rbc-stat-card__value" :class="profitToneClass">{{ formatCurrency(totalProfitAmount) }}</div>
          <div class="mt-1" style="font-size: 11px; color: var(--rbc-slate-400);">กำไรหลังหักต้นทุน</div>
        </div>
      </v-col>
    </v-row>

    <!-- Financial summary cards -->
    <v-row class="mt-2">
      <v-col cols="12" sm="4">
        <div class="rbc-card">
          <div class="rbc-card__body">
            <div class="rbc-section-label mb-1">ต้นทุนทั้งหมด</div>
            <div class="text-h5 font-weight-bold">{{ formatCurrency(totalCostAmount) }}</div>
          </div>
        </div>
      </v-col>

      <v-col cols="12" sm="4">
        <div class="rbc-card">
          <div class="rbc-card__body">
            <div class="rbc-section-label mb-1">ยอดขายทั้งหมด</div>
            <div class="text-h5 font-weight-bold">{{ formatCurrency(totalSalesAmount) }}</div>
          </div>
        </div>
      </v-col>

      <v-col cols="12" sm="4">
        <div class="rbc-card">
          <div class="rbc-card__body">
            <div class="rbc-section-label mb-1">กำไรสุทธิ</div>
            <div class="text-h5 font-weight-bold" :class="profitToneClass">{{ formatCurrency(totalProfitAmount) }}</div>
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- Chart card -->
    <div class="rbc-card mt-4">
      <div class="rbc-card__header">
        <div>
          <div class="rbc-card__title">ยอดขายแยกตามแบรนด์</div>
          <div style="font-size: 11px; color: var(--rbc-slate-400); margin-top: 2px;">เปรียบเทียบมูลค่ายอดขายของแต่ละแบรนด์</div>
        </div>
        <NuxtLink to="/report" style="font-size: 12px; color: var(--rbc-orange-600); text-decoration: none; font-weight: 500;">
          ดูรายงานทั้งหมด &rarr;
        </NuxtLink>
      </div>
      <div class="rbc-card__body">
        <div style="height: 300px; width: 100%">
          <VChart class="chart" :option="chartOption" autoresize />
        </div>
      </div>
    </div>
  </div>

  <div v-else class="d-flex align-center justify-center" style="min-height: 300px;">
    <v-progress-circular indeterminate color="primary" size="48" />
  </div>
</template>
