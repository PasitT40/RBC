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
  <template #topbar-subtitle>
    <span v-if="fromMonth || toMonth">
      {{ fromMonth || '?' }} — {{ toMonth || '?' }}
    </span>
    <span v-else>ทุกช่วงเวลา</span>
  </template>
  <template #topbar-actions>
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
  </template>

  <v-container fluid class="pa-6">
    <v-row class="mb-6" align="center">
      <v-col cols="auto">
        <div class="rbc-section-label mb-1">ช่วงเวลา</div>
      </v-col>
      <v-col cols="3">
        <v-text-field
          v-model="fromMonth"
          type="month"
          label="เดือนเริ่มต้น"
          variant="outlined"
          hide-details
          density="comfortable"
          clearable
        />
      </v-col>
      <v-col cols="3">
        <v-text-field
          v-model="toMonth"
          type="month"
          label="เดือนสิ้นสุด"
          variant="outlined"
          hide-details
          density="comfortable"
          clearable
        />
      </v-col>
      <v-col cols="auto">
        <span class="text-caption text-slate-400">{{ rows.length }} รายการ</span>
      </v-col>
    </v-row>

    <v-row class="mb-6">
      <v-col cols="9">
        <div class="rbc-card mb-6">
          <div class="rbc-card__header">
            <div>
              <div class="text-subtitle-2 font-weight-bold">ยอดขายแยกตามแบรนด์</div>
              <div class="text-caption text-slate-400">ดูว่าแต่ละแบรนด์ทำยอดขายได้มากน้อยแค่ไหนในช่วงเวลาที่เลือก</div>
            </div>
          </div>
          <div class="rbc-card__body">
            <BrandBarChart :data="chartData" metric="amount" :height="320" />
          </div>
        </div>
      </v-col>

      <v-col cols="3">
        <v-row>
          <v-col
            v-for="card in summaryCards"
            :key="card.title"
            cols="12"
          >
            <div class="rbc-stat-card" style="--color: var(--rbc-orange-500)">
              <div class="rbc-section-label">{{ card.title }}</div>
              <div :class="card.valueClass" class="text-h5 font-weight-bold mt-1">{{ card.value }}</div>
            </div>
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between mb-3">
          <div>
            <div class="text-subtitle-2 font-weight-bold">รายการขาย</div>
            <div class="text-caption text-slate-400">เช็กรายการขายทีละรายการ พร้อมต้นทุน ราคาขาย และกำไรที่ได้</div>
          </div>
        </div>
        <div class="rbc-table-wrap">
          <v-data-table
            :headers="headers"
            :items="rows"
            :loading="loading"
            v-model:sort-by="sortBy"
            item-value="id"
            items-per-page="5"
            hover
          >
            <template #item.id="{ item }">
              <span class="font-weight-medium">{{ item.id || "-" }}</span>
            </template>

            <template #item.sku="{ item }">
              <span class="font-weight-medium">{{ item.sku || "-" }}</span>
            </template>

            <template #item.category_name="{ item }">
              <span class="font-weight-medium">{{ item.category_name }}</span>
            </template>

            <template #item.name="{ item }">
              <span>{{ item.name }}</span>
            </template>

            <template #item.brand_name="{ item }">
              <span class="font-weight-medium">{{ item.brand_name }}</span>
            </template>

            <template #item.sold_at="{ item }">
              <span class="text-medium-emphasis">{{ formatDate(item.sold_at) }}</span>
            </template>

            <template #item.cost_price_at_sale="{ item }">
              <span class="font-weight-medium report-text-cost">{{ formatNumber(item.cost_price_at_sale) }}</span>
            </template>

            <template #item.sold_price="{ item }">
              <span class="font-weight-bold report-text-sales">{{ formatNumber(item.sold_price) }}</span>
            </template>

            <template #item.profit="{ item }">
              <span :class="getProfitToneClass(item.profit)" class="font-weight-bold">
                {{ Number(item.profit) > 0 ? "+" : "" }}{{ formatNumber(item.profit) }}
              </span>
            </template>

            <template #item.sold_channel="{ item }">
              <span class="font-weight-medium">{{ item.sold_channel }}</span>
            </template>

            <template #no-data>
              <div class="py-10 text-center text-medium-emphasis">
                ยังไม่มีข้อมูลรายงาน
              </div>
            </template>
          </v-data-table>
        </div>
      </v-col>
    </v-row>
  </v-container>
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
