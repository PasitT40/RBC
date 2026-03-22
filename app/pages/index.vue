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
      name: "Amount",
      colorBy: "data",
    },
  ],
}));

onMounted(() => {
  dashboard.loadDashboard();
});
</script>

<template>
  <div class="pa-6">
    <div class="tw:text-2xl tw:font-bold tw:text-start">Dashboard</div>
    <v-row class="tw:mt-5!">
      <v-col cols="4">
        <v-card>
          <v-card-title>สินค้าทั้งหมด (ชิ้น)</v-card-title>
          <v-card-text>{{ totalProducts }}</v-card-text>
        </v-card>
      </v-col>
      <v-col cols="4">
        <v-card>
          <v-card-title>ขายไปแล้ว (ชิ้น)</v-card-title>
          <v-card-text>{{ totalSold }}</v-card-text>
        </v-card>
      </v-col>
      <v-col cols="4">
        <v-card>
          <v-card-title>จองทั้งหมด (ชิ้น)</v-card-title>
          <v-card-text>{{ totalReserved }}</v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12">
        <v-row>
          <v-col cols="8">
            <div style="height: 400px; width: 100%;">
              <VChart class="chart" :option="chartOption" autoresize />
            </div>
          </v-col>
          <v-col class="tw:flex tw:flex-col tw:items-center" cols="4">
            <v-row>
              <v-col cols="12">
                <v-card>
                  <v-card-title class="tw:text-center">ต้นทุนทั้งหมด (บาท)</v-card-title>
                  <v-card-text class="tw:text-center tw:font-bold! tw:text-2xl!">
                    ฿ {{ dashboardStats?.total_cost_amount }}
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12">
                <v-card>
                  <v-card-title class="tw:text-center">ยอดขายทั้งหมด (บาท)</v-card-title>
                  <v-card-text class="tw:text-center tw:font-bold! tw:text-2xl!">฿ {{ dashboardStats?.total_sales_amount }}</v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12">
                <v-card>
                  <v-card-title class="tw:text-center">กำไรสุทธิ (ชิ้น)</v-card-title>
                  <v-card-text class="tw:text-center tw:font-bold! tw:text-2xl!">฿ {{ dashboardStats?.total_profit_amount }}</v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </div>

</template>
