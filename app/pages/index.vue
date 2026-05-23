<script lang="ts" setup>
type ChartRow = {
  Product: string;
  qty: number;
  amount: number;
};

const dashboard = useDashboard();

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

const chartRows = computed<ChartRow[]>(() =>
  dashboard.brandSeries.value.map((item) => ({
    Product: item.label,
    qty: item.qty,
    amount: item.amount,
  }))
);

const hasChartRows = computed(() => chartRows.value.length > 0);

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

const periodLabel = computed(() => {
  if (selectedPeriod.value === "month") return "เดือนนี้";
  if (selectedPeriod.value === "3m") return "3 เดือนล่าสุด";
  if (selectedPeriod.value === "year") return "ปีนี้";
  return "ทั้งหมด";
});

const financialCards = computed(() => [
  {
    key: "cost",
    label: "ต้นทุนทั้งหมด",
    icon: "mdi-wallet-outline",
    color: "#64748b",
    value: formatCurrency(totalCostAmount.value),
  },
  {
    key: "sales",
    label: "ยอดขายทั้งหมด",
    icon: "mdi-cash-multiple",
    color: "#22c55e",
    value: formatCurrency(totalSalesAmount.value),
  },
  {
    key: "profit",
    label: "กำไรสุทธิ",
    icon: "mdi-trending-up",
    color: totalProfitAmount.value < 0 ? "#ef4444" : "#f97316",
    value: formatCurrency(totalProfitAmount.value),
  },
]);

onMounted(() => {
  dashboard.loadDashboard();
});
</script>

<template>
  <div>
    <Teleport to="#rbc-topbar-subtitle">
      <span>ข้อมูล ณ วันนี้</span>
    </Teleport>

    <Teleport to="#rbc-topbar-actions">
      <div class="tw:flex tw:items-center tw:gap-2">
        <button
          v-for="p in [{ label: 'เดือนนี้', value: 'month' }, { label: '3 เดือน', value: '3m' }, { label: 'ปีนี้', value: 'year' }]"
          :key="p.value"
          :class="['rbc-filter-chip', selectedPeriod === p.value ? 'rbc-filter-chip--active' : '']"
          @click="setPeriod(p.value as 'month' | '3m' | 'year')"
        >
          {{ p.label }}
        </button>
      </div>
    </Teleport>

    <div class="rbc-page-container">
      <div v-if="!dashboard.loading.value">
        <!-- KPI stat cards -->
        <v-row>
          <v-col cols="12" sm="6" md="3">
            <div class="rbc-stat-card" style="--color: #f97316">
              <div class="rbc-stat-card__icon">
                <v-icon size="22" color="#f97316">mdi-package-variant-closed</v-icon>
              </div>
              <div class="rbc-stat-card__label">สินค้าทั้งหมด</div>
              <div class="rbc-stat-card__value">{{ formatInteger(totalProducts) }}</div>
              <div class="rbc-stat-card__delta">รวมทุกสถานะ</div>
            </div>
          </v-col>

          <v-col cols="12" sm="6" md="3">
            <div class="rbc-stat-card" style="--color: #22c55e">
              <div class="rbc-stat-card__icon">
                <v-icon size="22" color="#22c55e">mdi-check-circle-outline</v-icon>
              </div>
              <div class="rbc-stat-card__label">ขายแล้ว</div>
              <div class="rbc-stat-card__value">{{ formatInteger(totalSold) }}</div>
              <div class="rbc-stat-card__delta">จำนวนรายการ</div>
            </div>
          </v-col>

          <v-col cols="12" sm="6" md="3">
            <div class="rbc-stat-card" style="--color: #3b82f6">
              <div class="rbc-stat-card__icon">
                <v-icon size="22" color="#3b82f6">mdi-cart-check</v-icon>
              </div>
              <div class="rbc-stat-card__label">จองแล้ว</div>
              <div class="rbc-stat-card__value">{{ formatInteger(totalReserved) }}</div>
              <div class="rbc-stat-card__delta">รอปิดขาย</div>
            </div>
          </v-col>

          <v-col cols="12" sm="6" md="3">
            <div class="rbc-stat-card" style="--color: #a855f7">
              <div class="rbc-stat-card__icon">
                <v-icon size="22" color="#a855f7">mdi-cash</v-icon>
              </div>
              <div class="rbc-stat-card__label">กำไรสุทธิ</div>
              <div class="rbc-stat-card__value" :class="profitToneClass">{{ formatCurrency(totalProfitAmount) }}</div>
              <div class="rbc-stat-card__delta">หลังหักต้นทุน</div>
            </div>
          </v-col>
        </v-row>

        <!-- Financial summary cards -->
        <v-row class="mt-2">
          <v-col v-for="card in financialCards" :key="card.key" cols="12" sm="4">
            <div class="rbc-card">
              <div class="rbc-card__header">
                <div class="rbc-card__title">
                  <v-icon size="16" :color="card.color">{{ card.icon }}</v-icon>
                  {{ card.label }}
                </div>
                <span class="tw:text-xs tw:text-slate-400">{{ periodLabel }}</span>
              </div>
              <div class="rbc-card__body">
                <div :style="{ color: card.color }" class="tw:text-[22px] tw:font-bold">{{ card.value }}</div>
              </div>
            </div>
          </v-col>
        </v-row>

        <!-- Chart card -->
        <div class="rbc-card tw:mt-4">
          <div class="rbc-card__header">
            <div class="rbc-card__title">
              <v-icon size="16" color="primary">mdi-chart-bar</v-icon>
              ยอดขายตามแบรนด์
            </div>
            <NuxtLink to="/report" style="font-size: 12px; color: var(--rbc-orange-600); text-decoration: none; font-weight: 500;">
              ดูรายงานทั้งหมด &rarr;
            </NuxtLink>
          </div>
          <div class="rbc-card__body tw:p-0">
            <div v-if="hasChartRows" style="height: 300px; width: 100%">
              <VChart class="chart" :option="chartOption" autoresize />
            </div>
            <div v-else class="tw:flex tw:min-h-[300px] tw:items-center tw:justify-center tw:px-6 tw:text-sm tw:text-slate-400">
              ยังไม่มียอดขายสำหรับช่วงเวลานี้
            </div>
          </div>
        </div>
      </div>

      <div v-else class="d-flex align-center justify-center" style="min-height: 300px;">
        <v-progress-circular indeterminate color="primary" size="48" />
      </div>
    </div>
  </div>
</template>
