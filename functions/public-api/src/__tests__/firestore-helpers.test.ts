import { describe, it, expect } from "vitest";
import { parsePositiveInt, parseOptionalMoney, parseOptionalCondition, resolveStatusFilter } from "../lib/firestore-helpers.js";
import { HttpError } from "../lib/http.js";

describe("parsePositiveInt", () => {
  it("returns fallback when value is null", () => {
    expect(parsePositiveInt(null, "limit", 24, 60)).toBe(24);
  });

  it("returns fallback when value is empty string", () => {
    expect(parsePositiveInt("", "limit", 24, 60)).toBe(24);
  });

  it("returns parsed integer for valid input", () => {
    expect(parsePositiveInt("10", "limit", 24, 60)).toBe(10);
  });

  it("caps value at max", () => {
    expect(parsePositiveInt("100", "limit", 24, 60)).toBe(60);
  });

  it("returns max when value equals max", () => {
    expect(parsePositiveInt("60", "limit", 24, 60)).toBe(60);
  });

  it("throws badRequest for zero", () => {
    expect(() => parsePositiveInt("0", "limit", 24, 60)).toThrowError(HttpError);
  });

  it("throws badRequest for negative integer", () => {
    expect(() => parsePositiveInt("-1", "limit", 24, 60)).toThrowError(HttpError);
  });

  it("throws badRequest for non-integer float", () => {
    expect(() => parsePositiveInt("1.5", "limit", 24, 60)).toThrowError(HttpError);
  });

  it("throws badRequest for non-numeric string", () => {
    expect(() => parsePositiveInt("abc", "limit", 24, 60)).toThrowError(HttpError);
  });

  it("throws badRequest for value 1 (valid positive int)", () => {
    expect(parsePositiveInt("1", "limit", 24, 60)).toBe(1);
  });
});

describe("parseOptionalMoney", () => {
  it("returns null for null input", () => {
    expect(parseOptionalMoney(null, "minPrice")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseOptionalMoney("", "minPrice")).toBeNull();
  });

  it("returns 0 for zero", () => {
    expect(parseOptionalMoney("0", "minPrice")).toBe(0);
  });

  it("returns positive number", () => {
    expect(parseOptionalMoney("1999.50", "minPrice")).toBe(1999.5);
  });

  it("throws badRequest for negative number", () => {
    expect(() => parseOptionalMoney("-1", "minPrice")).toThrowError(HttpError);
    try {
      parseOptionalMoney("-1", "minPrice");
    } catch (err) {
      expect((err as HttpError).status).toBe(400);
    }
  });

  it("throws badRequest for NaN string", () => {
    expect(() => parseOptionalMoney("abc", "minPrice")).toThrowError(HttpError);
  });

  it("throws badRequest for Infinity", () => {
    expect(() => parseOptionalMoney("Infinity", "minPrice")).toThrowError(HttpError);
  });
});

describe("parseOptionalCondition", () => {
  it("returns null for null input", () => {
    expect(parseOptionalCondition(null, "minCondition")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseOptionalCondition("", "minCondition")).toBeNull();
  });

  it("returns 0 for zero (minimum valid condition)", () => {
    expect(parseOptionalCondition("0", "minCondition")).toBe(0);
  });

  it("returns 5 for maximum valid condition", () => {
    expect(parseOptionalCondition("5", "minCondition")).toBe(5);
  });

  it("returns mid-range value", () => {
    expect(parseOptionalCondition("3", "minCondition")).toBe(3);
  });

  it("throws badRequest for value above 5", () => {
    expect(() => parseOptionalCondition("6", "minCondition")).toThrowError(HttpError);
    try {
      parseOptionalCondition("6", "minCondition");
    } catch (err) {
      expect((err as HttpError).status).toBe(400);
    }
  });

  it("throws badRequest for negative value", () => {
    expect(() => parseOptionalCondition("-0.1", "minCondition")).toThrowError(HttpError);
  });

  it("throws badRequest for non-numeric string", () => {
    expect(() => parseOptionalCondition("bad", "minCondition")).toThrowError(HttpError);
  });

  it("throws badRequest for Infinity", () => {
    expect(() => parseOptionalCondition("Infinity", "minCondition")).toThrowError(HttpError);
  });

  it("allows decimal condition values between 0 and 5", () => {
    expect(parseOptionalCondition("4.5", "minCondition")).toBe(4.5);
  });
});

describe("resolveStatusFilter", () => {
  it("returns ACTIVE for available", () => {
    expect(resolveStatusFilter("available")).toEqual(["ACTIVE"]);
  });

  it("returns SOLD for sold", () => {
    expect(resolveStatusFilter("sold")).toEqual(["SOLD"]);
  });

  it("returns RESERVED for reserved", () => {
    expect(resolveStatusFilter("reserved")).toEqual(["RESERVED"]);
  });

  it("returns all statuses for null", () => {
    const result = resolveStatusFilter(null);
    expect(result).toContain("ACTIVE");
    expect(result).toContain("RESERVED");
    expect(result).toContain("SOLD");
    expect(result).toHaveLength(3);
  });

  it("returns all statuses for unknown value", () => {
    const result = resolveStatusFilter("unknown");
    expect(result).toHaveLength(3);
  });
});
