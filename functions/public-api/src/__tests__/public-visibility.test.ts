import { describe, it, expect } from "vitest";
import { isPublicVisibleProduct } from "../lib/public-visibility.js";

describe("isPublicVisibleProduct", () => {
  function makeProduct(overrides: Record<string, unknown> = {}) {
    return { show: true, is_deleted: false, status: "ACTIVE", ...overrides };
  }

  it("returns true for a fully visible ACTIVE product", () => {
    expect(isPublicVisibleProduct(makeProduct())).toBe(true);
  });

  it("returns true for RESERVED product", () => {
    expect(isPublicVisibleProduct(makeProduct({ status: "RESERVED" }))).toBe(true);
  });

  it("returns true for SOLD product", () => {
    expect(isPublicVisibleProduct(makeProduct({ status: "SOLD" }))).toBe(true);
  });

  it("returns false when show is false", () => {
    expect(isPublicVisibleProduct(makeProduct({ show: false }))).toBe(false);
  });

  it("returns false when is_deleted is true", () => {
    expect(isPublicVisibleProduct(makeProduct({ is_deleted: true }))).toBe(false);
  });

  it("returns false for unknown status", () => {
    expect(isPublicVisibleProduct(makeProduct({ status: "DELETED" }))).toBe(false);
  });

  it("returns false when show is missing", () => {
    expect(isPublicVisibleProduct({ is_deleted: false, status: "ACTIVE" })).toBe(false);
  });

  it("returns false when status is null", () => {
    expect(isPublicVisibleProduct(makeProduct({ status: null }))).toBe(false);
  });
});
