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
  <v-container fluid class="pa-6">
    <v-row>
      <v-col cols="12">
        <div class="text-h4 font-weight-black">ภาพรวมร้านวันนี้</div>
        <div class="text-subtitle-1 text-medium-emphasis">
          ดูจำนวนสินค้า ยอดขาย และภาพรวมแบรนด์ที่ทำผลงานได้ดีในหน้าเดียว
        </div>
      </v-col>

      <v-col cols="4">
        <v-card rounded="lg" elevation="2">
          <v-card-text class="pa-6">
            <div class="text-body-2 font-weight-medium text-medium-emphasis">สินค้าทั้งหมด</div>
            <div class="text-h4 font-weight-black mt-3">{{ totalProducts }}</div>
            <div class="text-body-2 text-medium-emphasis mt-2">รวมสินค้าที่กำลังขาย จอง และขายแล้ว</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="4">
        <v-card rounded="lg" elevation="2">
          <v-card-text class="pa-6">
            <div class="text-body-2 font-weight-medium text-medium-emphasis">ขายไปแล้ว</div>
            <div class="text-h4 font-weight-black mt-3">{{ totalSold }}</div>
            <div class="text-body-2 text-medium-emphasis mt-2">จำนวนสินค้าที่ปิดการขายเรียบร้อยแล้ว</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="4">
        <v-card rounded="lg" elevation="2">
          <v-card-text class="pa-6">
            <div class="text-body-2 font-weight-medium text-medium-emphasis">สินค้าที่ถูกจอง</div>
            <div class="text-h4 font-weight-black mt-3">{{ totalReserved }}</div>
            <div class="text-body-2 text-medium-emphasis mt-2">รายการที่กันสินค้าไว้และยังไม่ปิดการขาย</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="8">
        <v-card rounded="lg" elevation="2">
          <v-card-item>
            <v-card-title>ยอดขายแยกตามแบรนด์</v-card-title>
            <v-card-subtitle>เปรียบเทียบมูลค่ายอดขายของแต่ละแบรนด์จากข้อมูล dashboard ล่าสุด</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <v-sheet rounded="lg" color="grey-lighten-5" class="pa-4">
              <div style="height: 400px; width: 100%">
                <VChart class="chart" :option="chartOption" autoresize />
              </div>
            </v-sheet>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="4">
        <v-row>
          <v-col cols="12">
            <v-card rounded="lg" elevation="2">
              <v-card-text class="pa-6 text-center">
                <div class="text-body-2 font-weight-medium text-medium-emphasis">ต้นทุนทั้งหมด</div>
                <div class="text-h4 font-weight-black mt-3">฿ {{ dashboardStats?.total_cost_amount }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12">
            <v-card rounded="lg" elevation="2">
              <v-card-text class="pa-6 text-center">
                <div class="text-body-2 font-weight-medium text-medium-emphasis">ยอดขายทั้งหมด</div>
                <div class="text-h4 font-weight-black mt-3">฿ {{ dashboardStats?.total_sales_amount }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12">
            <v-card rounded="lg" elevation="2">
              <v-card-text class="pa-6 text-center">
                <div class="text-body-2 font-weight-medium text-medium-emphasis">กำไรสุทธิ</div>
                <div class="text-h4 font-weight-black mt-3">฿ {{ dashboardStats?.total_profit_amount }}</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>
