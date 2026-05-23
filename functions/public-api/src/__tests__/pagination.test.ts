import { describe, it, expect, vi } from "vitest";
import { encodeCursor, decodeCursor, applyCursor } from "../lib/pagination.js";
import { HttpError } from "../lib/http.js";

describe("decodeCursor", () => {
  it("returns null for null input", () => {
    expect(decodeCursor(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(decodeCursor("")).toBeNull();
  });

  it("throws badRequest when cursor exceeds 512 characters", () => {
    const longCursor = "a".repeat(513);
    expect(() => decodeCursor(longCursor)).toThrowError(HttpError);
    try {
      decodeCursor(longCursor);
    } catch (err) {
      expect((err as HttpError).status).toBe(400);
    }
  });

  it("throws badRequest for invalid base64 data", () => {
    expect(() => decodeCursor("not-valid-base64!!!")).toThrowError(HttpError);
  });

  it("throws badRequest when version is not 1", () => {
    const payload = Buffer.from(JSON.stringify({ v: 2, id: "abc", fieldValue: 0, fieldKind: "number" })).toString("base64url");
    expect(() => decodeCursor(payload)).toThrowError(HttpError);
  });

  it("throws badRequest when id is missing", () => {
    const payload = Buffer.from(JSON.stringify({ v: 1, fieldValue: 0, fieldKind: "number" })).toString("base64url");
    expect(() => decodeCursor(payload)).toThrowError(HttpError);
  });

  it("throws badRequest when fieldKind is invalid", () => {
    const payload = Buffer.from(JSON.stringify({ v: 1, id: "abc", fieldValue: 0, fieldKind: "string" })).toString("base64url");
    expect(() => decodeCursor(payload)).toThrowError(HttpError);
  });

  it("decodes a valid number cursor", () => {
    const result = decodeCursor(encodeCursor({ fieldValue: 12345, fieldKind: "number", id: "docId" }));
    expect(result).toMatchObject({ v: 1, fieldValue: 12345, fieldKind: "number", id: "docId" });
  });

  it("decodes a valid timestamp cursor", () => {
    const ts = Date.now();
    const result = decodeCursor(encodeCursor({ fieldValue: ts, fieldKind: "timestamp", id: "docId" }));
    expect(result).toMatchObject({ v: 1, fieldValue: ts, fieldKind: "timestamp", id: "docId" });
  });

  it("decodes a null cursor", () => {
    const result = decodeCursor(encodeCursor({ fieldValue: null, fieldKind: "null", id: "docId" }));
    expect(result).toMatchObject({ v: 1, fieldValue: null, fieldKind: "null", id: "docId" });
  });

  it("preserves optional sort field in round-trip", () => {
    const result = decodeCursor(encodeCursor({ fieldValue: 100, fieldKind: "number", id: "docId", sort: "sell_price_asc" }));
    expect(result?.sort).toBe("sell_price_asc");
  });
});

describe("encodeCursor / decodeCursor round-trip", () => {
  it("round-trips a number cursor exactly", () => {
    const original = { fieldValue: 9999, fieldKind: "number" as const, id: "xyz", sort: "condition_asc" };
    const encoded = encodeCursor(original);
    const decoded = decodeCursor(encoded);
    expect(decoded).toMatchObject({ v: 1, ...original });
  });

  it("produces a URL-safe base64url string (no +, /, = chars)", () => {
    const encoded = encodeCursor({ fieldValue: 12345, fieldKind: "number", id: "abc" });
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("cursor length stays under 512 for typical values", () => {
    const encoded = encodeCursor({ fieldValue: Date.now(), fieldKind: "timestamp", id: "a".repeat(20), sort: "updated_at_desc" });
    expect(encoded.length).toBeLessThanOrEqual(512);
  });
});

describe("applyCursor", () => {
  function makeMockQuery() {
    const query = {
      startAfter: vi.fn().mockReturnThis(),
    };
    return query as unknown as import("firebase-admin/firestore").Query;
  }

  it("returns the original query unchanged when cursor is null", () => {
    const q = makeMockQuery();
    const result = applyCursor(q, null);
    expect(result).toBe(q);
    const mock = q as unknown as { startAfter: ReturnType<typeof vi.fn> };
    expect(mock.startAfter).not.toHaveBeenCalled();
  });

  it("calls startAfter with Timestamp for timestamp cursor", async () => {
    const { Timestamp } = await import("firebase-admin/firestore").catch(() => ({ Timestamp: null }));
    if (!Timestamp) return; // skip if firebase-admin not available

    const q = makeMockQuery();
    const ts = Date.now();
    applyCursor(q, { v: 1, fieldValue: ts, fieldKind: "timestamp", id: "docId" });
    const mock = q as unknown as { startAfter: ReturnType<typeof vi.fn> };
    expect(mock.startAfter).toHaveBeenCalledWith(Timestamp.fromMillis(ts), "docId");
  });

  it("throws badRequest when timestamp cursor has non-number fieldValue", () => {
    const q = makeMockQuery();
    expect(() => applyCursor(q, { v: 1, fieldValue: null, fieldKind: "timestamp", id: "docId" })).toThrowError(HttpError);
    try {
      applyCursor(q, { v: 1, fieldValue: null, fieldKind: "timestamp", id: "docId" });
    } catch (err) {
      expect((err as HttpError).status).toBe(400);
    }
  });

  it("calls startAfter with raw number for number cursor", () => {
    const q = makeMockQuery();
    applyCursor(q, { v: 1, fieldValue: 500, fieldKind: "number", id: "docId" });
    const mock = q as unknown as { startAfter: ReturnType<typeof vi.fn> };
    expect(mock.startAfter).toHaveBeenCalledWith(500, "docId");
  });

  it("calls startAfter with null for null cursor", () => {
    const q = makeMockQuery();
    applyCursor(q, { v: 1, fieldValue: null, fieldKind: "null", id: "docId" });
    const mock = q as unknown as { startAfter: ReturnType<typeof vi.fn> };
    expect(mock.startAfter).toHaveBeenCalledWith(null, "docId");
  });
});
