import { doc, type Firestore } from "firebase/firestore";
import type { DashboardPeriodInput } from "./types";

// helper สำหรับสร้างคีย์เดือนรูปแบบ YYYY-MM (ใช้กับ orders.sold_yyyymm)
export function monthKey(d = new Date()) {
  // d.getMonth() เป็น 0-11 จึงต้อง +1 แล้ว padStart ให้ครบ 2 หลัก
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function assertMonthFormat(value: string, fieldName: string) {
  if (!MONTH_KEY_RE.test(value)) {
    throw new Error(`${fieldName} must be in YYYY-MM format`);
  }
}

export function normalizeDashboardPeriod(input: DashboardPeriodInput = {}) {
  if (input.month) {
    assertMonthFormat(input.month, "month");
    return { kind: "month" as const, month: input.month };
  }

  if (input.fromMonth || input.toMonth) {
    const from = input.fromMonth ?? input.toMonth ?? "";
    const to = input.toMonth ?? input.fromMonth ?? "";
    assertMonthFormat(from, "fromMonth");
    assertMonthFormat(to, "toMonth");
    if (from > to) throw new Error("fromMonth must be <= toMonth");
    return { kind: "range" as const, fromMonth: from, toMonth: to };
  }

  return { kind: "none" as const };
}

// อ้างอิงเอกสาร dashboard รวม (cache aggregate)
// การอัปเดตตัวนับทั้งหมดจะเขียนผ่าน doc นี้
export function globalRef(db: Firestore) {
  // dashboard_stats/global ถูกใช้เป็น cache สำหรับ dashboard ทั้งระบบ
  return doc(db, "dashboard_stats", "global");
}
