import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

export const PRODUCT_SKU_PREFIX = "RBC";

export function formatProductSku(sequence: number) {
  const safeSequence = Math.max(1, Math.trunc(Number(sequence) || 0));
  return `${PRODUCT_SKU_PREFIX}-${String(safeSequence).padStart(3, "0")}`;
}

export async function allocateNextProductSku(db: any) {
  const counterRef = doc(db, "counters", "products");

  return runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const currentSequence = Number(counterSnap.data()?.last_sku_seq ?? 0);
    const nextSequence = currentSequence + 1;
    const sku = formatProductSku(nextSequence);

    tx.set(
      counterRef,
      {
        prefix: PRODUCT_SKU_PREFIX,
        last_sku_seq: nextSequence,
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );

    return {
      sku,
      sku_seq: nextSequence,
    };
  });
}
