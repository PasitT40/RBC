import type { DashboardBrandStatsRecord, DashboardPeriodInput, DashboardStatsRecord } from "~/composables/firestore/types";

export type BrandPoint = {
  label: string;
  qty: number;
  amount: number;
};

export function useDashboard() {
  const { getDashboardBrandStats, getDashboardStats } = useDashboardFirestore();

  const loading = ref(false);
  const error = ref("");
  const dashboardStats = ref<DashboardStatsRecord | null>(null);
  const brandSeries = ref<BrandPoint[]>([]);
  const month = ref("");
  const fromMonth = ref("");
  const toMonth = ref("");

  const loadDashboard = async () => {
    loading.value = true;
    error.value = "";
    try {
      // Prepare filter payload based on reactive UI inputs
      const filter: DashboardPeriodInput = month.value
        ? { month: month.value }
        : fromMonth.value || toMonth.value
          ? { fromMonth: fromMonth.value, toMonth: toMonth.value }
          : {};

      const [stats, brands] = await Promise.all([
        getDashboardStats(filter),
        getDashboardBrandStats({ ...filter, count: 100 }),
      ]);

      dashboardStats.value = stats;
      brandSeries.value = (brands as DashboardBrandStatsRecord[]).map((item) => ({
        label: String(item.brand_name || item.brand_id || "ไม่ระบุแบรนด์"),
        qty: Number(item.sales_count ?? 0),
        amount: Number(item.sales_amount ?? 0),
      }));
    } catch (err: any) {
      error.value = err?.message || "โหลดข้อมูลแดชบอร์ดไม่สำเร็จ";
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    error,
    dashboardStats,
    brandSeries,
    month,
    fromMonth,
    toMonth,
    loadDashboard,
  };
}
