import type { ProductRecord, ProductStatus } from "./types";

export const isSoftDeletedProduct = (product: Partial<ProductRecord> | null | undefined): boolean =>
  Boolean(product?.is_deleted);

export const getProductStatus = (product: Partial<ProductRecord> | null | undefined): ProductStatus =>
  (product?.status ?? "ACTIVE") as ProductStatus;

export const assertSellableProduct = (product: Partial<ProductRecord> | null | undefined) => {
  if (!product) throw new Error("Product not found");
  if (isSoftDeletedProduct(product)) throw new Error("Cannot sell deleted product");
  if (product.is_sellable === false) throw new Error("Product is not sellable");

  const status = getProductStatus(product);
  if (status === "SOLD") throw new Error("Product already sold");
  if (status !== "ACTIVE" && status !== "RESERVED") {
    throw new Error(`Unsupported product status: ${status}`);
  }
};

export const assertReservableProduct = (product: Partial<ProductRecord> | null | undefined) => {
  if (!product) throw new Error("Product not found");
  if (isSoftDeletedProduct(product)) throw new Error("Cannot reserve deleted product");
  if (getProductStatus(product) === "SOLD") throw new Error("Cannot reserve sold product");
};

export const assertActivatableProduct = (product: Partial<ProductRecord> | null | undefined) => {
  if (!product) throw new Error("Product not found");
  if (isSoftDeletedProduct(product)) throw new Error("Cannot activate deleted product");
  if (getProductStatus(product) === "SOLD") throw new Error("Cannot set active for sold product");
};

export const assertDeletableProduct = (product: Partial<ProductRecord> | null | undefined) => {
  if (!product) throw new Error("Product not found");
  if (isSoftDeletedProduct(product)) throw new Error("Product not found");
  if (getProductStatus(product) !== "ACTIVE") throw new Error("Only active products can be deleted");
};
