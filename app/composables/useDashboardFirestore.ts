import { collection, doc, getDoc, getDocs, limit, orderBy, query, where, type QueryConstraint } from "firebase/firestore";
import type { DashboardBrandStatsInput, DashboardBrandStatsRecord, DashboardPeriodInput, DashboardStatsRecord, OrderRecord } from "./firestore/types";
import { globalRef, normalizeDashboardPeriod } from "./firestore/utils";

export function useDashboardFirestore() {
  const { $db } = useNuxtApp() as { $db: any };
  const { track } = useGlobalLoading();

  const getTime = (value: unknown) => {
    if (!value) return 0;
    if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
      return (value as { toDate: () => Date }).toDate().getTime();
    }

    const date = new Date(value as string | number | Date);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  };

  const getConfirmedOrdersForDashboard = async (input: DashboardPeriodInput = {}) => {
    const period = normalizeDashboardPeriod(input);
    const constraints: QueryConstraint[] = [where("status", "==", "CONFIRMED")];

    if (period.kind === "month") {
      constraints.push(where("sold_yyyymm", "==", period.month));
    } else if (period.kind === "range") {
      constraints.push(where("sold_yyyymm", ">=", period.fromMonth));
      constraints.push(where("sold_yyyymm", "<=", period.toMonth));
    }

    constraints.push(limit(input.maxOrders ?? 5000));
    const snap = await getDocs(query(collection($db, "orders"), ...constraints));
    return {
      period,
      items: snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as OrderRecord))
        .sort((a, b) => getTime(b.sold_at) - getTime(a.sold_at)),
    };
  };

  const getDashboardStats = async (input: DashboardPeriodInput = {}) => {
    const period = normalizeDashboardPeriod(input);
    if (period.kind === "none") {
      const snap = await getDoc(globalRef($db));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data(), period } as DashboardStatsRecord;
    }

    const { items } = await getConfirmedOrdersForDashboard(input);
    const totals = items.reduce(
      (acc, item) => {
        acc.total_sales_count += 1;
        acc.total_sales_amount += Number(item.sold_price ?? 0);
        acc.total_cost_amount += Number(item.cost_price_at_sale ?? 0);
        acc.total_profit_amount += Number(item.profit ?? 0);
        return acc;
      },
      {
        total_sales_count: 0,
        total_sales_amount: 0,
        total_cost_amount: 0,
        total_profit_amount: 0,
      }
    );

    return {
      id: "global",
      total_products: null,
      active_products: null,
      reserved_products: null,
      sold_products: totals.total_sales_count,
      visible_products: null,
      ...totals,
      period,
      updated_at: null,
    } as DashboardStatsRecord;
  };

  const getDashboardBrandStats = async (input: DashboardBrandStatsInput = {}) => {
    const period = normalizeDashboardPeriod(input);
    const count = input.count ?? 6;

    if (period.kind === "none") {
      const q = query(collection($db, "dashboard_brand_stats"), orderBy("sales_amount", "desc"), limit(count));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DashboardBrandStatsRecord));
    }

    const { items } = await getConfirmedOrdersForDashboard(input);
    const grouped: Record<
      string,
      { brand_id: string; brand_name: string; sales_count: number; sales_amount: number; cost_amount: number; profit_amount: number }
    > = {};

    for (const item of items) {
      const brandId = String(item.brand_id ?? "unknown");
      const brandName = String(item.brand_name ?? brandId);
      if (!grouped[brandId]) {
        grouped[brandId] = {
          brand_id: brandId,
          brand_name: brandName,
          sales_count: 0,
          sales_amount: 0,
          cost_amount: 0,
          profit_amount: 0,
        };
      }
      grouped[brandId].sales_count += 1;
      grouped[brandId].sales_amount += Number(item.sold_price ?? 0);
      grouped[brandId].cost_amount += Number(item.cost_price_at_sale ?? 0);
      grouped[brandId].profit_amount += Number(item.profit ?? 0);
    }

    return Object.values(grouped)
      .sort((a, b) => b.sales_amount - a.sales_amount)
      .slice(0, count)
      .map((row) => ({ id: row.brand_id, ...row, period })) as DashboardBrandStatsRecord[];
  };

  return {
    getConfirmedOrdersForDashboard: (input?: DashboardPeriodInput) => track(() => getConfirmedOrdersForDashboard(input), "Loading dashboard..."),
    getDashboardStats: (input?: DashboardPeriodInput) => track(() => getDashboardStats(input), "Loading dashboard..."),
    getDashboardBrandStats: (input?: DashboardBrandStatsInput) => track(() => getDashboardBrandStats(input), "Loading dashboard..."),
  };
}
