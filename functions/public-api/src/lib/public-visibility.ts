export function isPublicVisibleProduct(product: Record<string, unknown>) {
  return product.show === true
    && product.is_deleted === false
    && (product.status === "ACTIVE" || product.status === "RESERVED" || product.status === "SOLD");
}
