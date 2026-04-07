const PRODUCT_SKU_PREFIX = "RBC";

function formatProductSku(sequence) {
  const safeSequence = Math.max(1, Math.trunc(Number(sequence) || 0));
  return `${PRODUCT_SKU_PREFIX}-${String(safeSequence).padStart(3, "0")}`;
}

async function reserveNextProductSku(db, serverTimestampFactory) {
  const counterRef = db.collection("counters").doc("products");

  return db.runTransaction(async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const currentSequence = Number(counterSnap.data()?.last_sku_seq ?? 0);
    const nextSequence = currentSequence + 1;
    const sku = formatProductSku(nextSequence);

    tx.set(
      counterRef,
      {
        prefix: PRODUCT_SKU_PREFIX,
        last_sku_seq: nextSequence,
        updated_at: serverTimestampFactory(),
      },
      { merge: true }
    );

    return {
      sku,
      sku_seq: nextSequence,
    };
  });
}

module.exports = {
  PRODUCT_SKU_PREFIX,
  formatProductSku,
  reserveNextProductSku,
};
