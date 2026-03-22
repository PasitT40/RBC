import { collection, doc, getDocs, increment, limit, orderBy, query, runTransaction, serverTimestamp, startAfter, where, type QueryConstraint } from "firebase/firestore";
import type { ConfirmSaleInput, OrderRecord, OrderStatus, PageCursor, PageResult, ProductRecord, ProductStatus, ReportPageInput } from "./firestore/types";
import { assertSellableProduct, getProductStatus } from "./firestore/products";
import { globalRef, monthKey } from "./firestore/utils";

export function useOrdersFirestore() {
  const { $db } = useNuxtApp() as { $db: any };
  const { track } = useGlobalLoading();

  const getReportPage = async (input: ReportPageInput = {}): Promise<PageResult<OrderRecord>> => {
    const pageSize = input.pageSize ?? 20;
    const constraints: QueryConstraint[] = [];

    const status = input.status ?? "CONFIRMED";
    constraints.push(where("status", "==", status));

    const month = input.month ?? monthKey();
    constraints.push(where("sold_yyyymm", "==", month));

    if (input.brandId) constraints.push(where("brand_id", "==", input.brandId));
    if (input.soldChannel) constraints.push(where("sold_channel", "==", input.soldChannel));

    constraints.push(orderBy("sold_at", "desc"));
    constraints.push(limit(pageSize));
    if (input.cursor) constraints.push(startAfter(input.cursor));

    const q = query(collection($db, "orders"), ...constraints);
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderRecord));
    const nextCursor: PageCursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    return {
      items,
      nextCursor,
      hasMore: snap.docs.length === pageSize,
    };
  };

  const confirmSale = async (payload: ConfirmSaleInput) => {
    const orderId = payload.idempotencyKey || undefined;
    const orderRef = orderId ? doc($db, "orders", orderId) : doc(collection($db, "orders"));

    return runTransaction($db, async (tx) => {
      const ledgerRef = doc($db, "stats_ledger", `SALE_APPLIED_${orderRef.id}`);
      const ledgerSnap = await tx.get(ledgerRef);
      if (ledgerSnap.exists()) {
        return { orderId: orderRef.id, applied: false };
      }

      const existingOrderSnap = await tx.get(orderRef);
      if (existingOrderSnap.exists()) {
        const existingStatus = (existingOrderSnap.data() as Record<string, any>).status as OrderStatus;
        if (existingStatus === "CONFIRMED") return { orderId: orderRef.id, applied: false };
        throw new Error("Order id already exists with non-confirmed state");
      }

      const pRef = doc($db, "products", payload.productId);
      const pSnap = await tx.get(pRef);
      if (!pSnap.exists()) throw new Error("Product not found");

      const product = { id: pSnap.id, ...pSnap.data() } as ProductRecord;
      assertSellableProduct(product);

      const prevStatus = getProductStatus(product);
      const soldPrice = Number(payload.sold_price);
      const costAtSale = Number(product.cost_price ?? 0);
      const fee = Number(payload.fee ?? 0);
      const profit = soldPrice - costAtSale - fee;

      tx.set(orderRef, {
        status: "CONFIRMED",
        product_id: payload.productId,
        previous_product_status: prevStatus,
        category_id: product.category_id,
        brand_id: product.brand_id,
        brand_name: product.brand_name,
        sold_channel: payload.sold_channel,
        sold_price: soldPrice,
        sold_yyyymm: monthKey(),
        cost_price_at_sale: costAtSale,
        fee,
        profit,
        sold_at: serverTimestamp(),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        product_snapshot: {
          name: product.name,
          slug: product.slug,
          cover_image: product.cover_image ?? "",
          category_name: product.category_name,
          brand_name: product.brand_name,
        },
      });

      tx.update(pRef, {
        status: "SOLD",
        is_sellable: false,
        last_status_before_sold: prevStatus,
        sold_at: serverTimestamp(),
        sold_price: soldPrice,
        sold_channel: payload.sold_channel,
        sold_ref: orderRef.id,
        updated_at: serverTimestamp(),
      });

      tx.set(
        globalRef($db),
        {
          sold_products: increment(1),
          active_products: increment(prevStatus === "ACTIVE" ? -1 : 0),
          reserved_products: increment(prevStatus === "RESERVED" ? -1 : 0),
          total_sales_count: increment(1),
          total_sales_amount: increment(soldPrice),
          total_cost_amount: increment(costAtSale),
          total_profit_amount: increment(profit),
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        doc($db, "dashboard_brand_stats", String(product.brand_id)),
        {
          brand_id: product.brand_id,
          brand_name: product.brand_name,
          sales_count: increment(1),
          sales_amount: increment(soldPrice),
          cost_amount: increment(costAtSale),
          profit_amount: increment(profit),
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(ledgerRef, { type: "SALE_APPLIED", ref_id: orderRef.id, created_at: serverTimestamp() }, { merge: true });

      return { orderId: orderRef.id, applied: true };
    });
  };

  const undoSale = async (orderId: string) => {
    return runTransaction($db, async (tx) => {
      const oRef = doc($db, "orders", orderId);
      const oSnap = await tx.get(oRef);
      if (!oSnap.exists()) throw new Error("Order not found");

      const order = { id: oSnap.id, ...oSnap.data() } as OrderRecord;
      if (order.status === "CANCELLED") {
        return { orderId, reverted: false };
      }

      const ledgerRef = doc($db, "stats_ledger", `SALE_REVERTED_${orderId}`);
      const ledgerSnap = await tx.get(ledgerRef);
      if (ledgerSnap.exists()) {
        return { orderId, reverted: false };
      }

      const pRef = doc($db, "products", String(order.product_id));
      const pSnap = await tx.get(pRef);
      if (!pSnap.exists()) throw new Error("Product not found");

      const product = { id: pSnap.id, ...pSnap.data() } as ProductRecord;
      const restoreStatus = order.previous_product_status
        ?? (product.last_status_before_sold as ProductStatus | null)
        ?? "ACTIVE";

      tx.update(oRef, { status: "CANCELLED", updated_at: serverTimestamp() });

      tx.update(pRef, {
        status: restoreStatus,
        is_sellable: restoreStatus === "ACTIVE",
        last_status_before_sold: null,
        sold_at: null,
        sold_price: null,
        sold_channel: null,
        sold_ref: null,
        updated_at: serverTimestamp(),
      });

      tx.set(
        globalRef($db),
        {
          sold_products: increment(-1),
          active_products: increment(restoreStatus === "ACTIVE" ? 1 : 0),
          reserved_products: increment(restoreStatus === "RESERVED" ? 1 : 0),
          total_sales_count: increment(-1),
          total_sales_amount: increment(-Number(order.sold_price ?? 0)),
          total_cost_amount: increment(-Number(order.cost_price_at_sale ?? 0)),
          total_profit_amount: increment(-Number(order.profit ?? 0)),
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        doc($db, "dashboard_brand_stats", String(order.brand_id)),
        {
          brand_id: order.brand_id,
          brand_name: order.brand_name,
          sales_count: increment(-1),
          sales_amount: increment(-Number(order.sold_price ?? 0)),
          cost_amount: increment(-Number(order.cost_price_at_sale ?? 0)),
          profit_amount: increment(-Number(order.profit ?? 0)),
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(ledgerRef, { type: "SALE_REVERTED", ref_id: orderId, created_at: serverTimestamp() }, { merge: true });

      return { orderId, reverted: true };
    });
  };

  return {
    getReportPage: (input?: ReportPageInput) => track(() => getReportPage(input), "Loading reports..."),
    confirmSale: (payload: ConfirmSaleInput) => track(() => confirmSale(payload), "Confirming sale..."),
    undoSale: (orderId: string) => track(() => undoSale(orderId), "Undoing sale..."),
  };
}
