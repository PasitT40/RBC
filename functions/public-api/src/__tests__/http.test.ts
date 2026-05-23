import { describe, it, expect, vi } from "vitest";
import { HttpError, badRequest, notFound, methodNotAllowed, createHttpError, getQueryParam, getRequiredString, sendJson, sendNoContent } from "../lib/http.js";
import type { Request } from "firebase-functions/v2/https";

function makeReq(query: Record<string, unknown> = {}): Request {
  return { query } as unknown as Request;
}

describe("HttpError", () => {
  it("is an instance of Error", () => {
    const err = new HttpError(400, "BAD_REQUEST", "msg");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HttpError);
  });

  it("carries status, code, message", () => {
    const err = new HttpError(404, "NOT_FOUND", "not here");
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("not here");
  });

  it("carries optional headers", () => {
    const err = new HttpError(405, "METHOD_NOT_ALLOWED", "msg", { Allow: "GET" });
    expect(err.headers).toEqual({ Allow: "GET" });
  });
});

describe("badRequest", () => {
  it("returns HttpError with status 400", () => {
    const err = badRequest("bad input");
    expect(err.status).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe("bad input");
  });
});

describe("notFound", () => {
  it("returns HttpError with status 404", () => {
    const err = notFound("missing");
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("includes a cache-control header", () => {
    const err = notFound("x");
    expect(err.headers?.["Cache-Control"]).toBeTruthy();
  });
});

describe("methodNotAllowed", () => {
  it("returns HttpError with status 405", () => {
    const err = methodNotAllowed();
    expect(err.status).toBe(405);
    expect(err.code).toBe("METHOD_NOT_ALLOWED");
  });

  it("includes an Allow header", () => {
    const err = methodNotAllowed();
    expect(err.headers?.["Allow"]).toContain("GET");
  });
});

describe("createHttpError", () => {
  it("returns the same HttpError when given an HttpError", () => {
    const original = badRequest("test");
    expect(createHttpError(original)).toBe(original);
  });

  it("wraps unknown errors as 500 INTERNAL", () => {
    const err = createHttpError(new Error("boom"));
    expect(err.status).toBe(500);
    expect(err.code).toBe("INTERNAL");
  });

  it("wraps non-Error values as 500", () => {
    const err = createHttpError("string error");
    expect(err.status).toBe(500);
  });
});

describe("getQueryParam", () => {
  it("returns string value for a string query param", () => {
    const req = makeReq({ foo: "bar" });
    expect(getQueryParam(req, "foo")).toBe("bar");
  });

  it("returns null when param is missing", () => {
    const req = makeReq({});
    expect(getQueryParam(req, "missing")).toBeNull();
  });

  it("returns first element when param is an array", () => {
    const req = makeReq({ foo: ["first", "second"] });
    expect(getQueryParam(req, "foo")).toBe("first");
  });

  it("returns null when array contains non-string first element", () => {
    const req = makeReq({ foo: [{ nested: true }] });
    expect(getQueryParam(req, "foo")).toBeNull();
  });

  it("throws badRequest when string exceeds default maxLen of 200", () => {
    const req = makeReq({ foo: "a".repeat(201) });
    expect(() => getQueryParam(req, "foo")).toThrowError(HttpError);
    try {
      getQueryParam(req, "foo");
    } catch (err) {
      expect((err as HttpError).status).toBe(400);
    }
  });

  it("throws badRequest when array first element exceeds maxLen", () => {
    const req = makeReq({ foo: ["a".repeat(201)] });
    expect(() => getQueryParam(req, "foo")).toThrowError(HttpError);
  });

  it("allows custom maxLen", () => {
    const req = makeReq({ cursor: "a".repeat(400) });
    expect(getQueryParam(req, "cursor", 512)).toBe("a".repeat(400));
  });

  it("throws when value equals exactly maxLen + 1", () => {
    const req = makeReq({ foo: "a".repeat(201) });
    expect(() => getQueryParam(req, "foo", 200)).toThrowError(HttpError);
  });

  it("allows value exactly at maxLen", () => {
    const req = makeReq({ foo: "a".repeat(200) });
    expect(getQueryParam(req, "foo", 200)).toBe("a".repeat(200));
  });
});

describe("getRequiredString", () => {
  it("returns trimmed non-empty string", () => {
    expect(getRequiredString("  hello  ", "field")).toBe("hello");
  });

  it("throws badRequest for empty string", () => {
    expect(() => getRequiredString("", "field")).toThrowError(HttpError);
  });

  it("throws badRequest for whitespace-only string", () => {
    expect(() => getRequiredString("   ", "field")).toThrowError(HttpError);
  });

  it("throws badRequest for null", () => {
    expect(() => getRequiredString(null, "field")).toThrowError(HttpError);
  });

  it("throws badRequest for undefined", () => {
    expect(() => getRequiredString(undefined, "field")).toThrowError(HttpError);
  });
});

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  };
}

describe("sendJson", () => {
  it("calls res.status with the given status code", () => {
    const res = makeRes();
    sendJson(res as any, 200, { ok: true });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("sets Content-Type to application/json; charset=utf-8", () => {
    const res = makeRes();
    sendJson(res as any, 200, {});
    expect(res.set).toHaveBeenCalledWith("Content-Type", "application/json; charset=utf-8");
  });

  it("sets Access-Control-Allow-Origin header", () => {
    const res = makeRes();
    sendJson(res as any, 200, {});
    expect(res.set).toHaveBeenCalledWith("Access-Control-Allow-Origin", "*");
  });

  it("sets X-Content-Type-Options header", () => {
    const res = makeRes();
    sendJson(res as any, 200, {});
    expect(res.set).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
  });

  it("calls res.send with JSON-serialized payload", () => {
    const res = makeRes();
    const payload = { id: 1, name: "test" };
    sendJson(res as any, 200, payload);
    expect(res.send).toHaveBeenCalledWith(JSON.stringify(payload));
  });

  it("merges custom headers", () => {
    const res = makeRes();
    sendJson(res as any, 200, {}, { "Cache-Control": "public, s-maxage=60" });
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "public, s-maxage=60");
  });

  it("does not call res.end", () => {
    const res = makeRes();
    sendJson(res as any, 200, {});
    expect(res.end).not.toHaveBeenCalled();
  });
});

describe("sendNoContent", () => {
  it("calls res.status with the given status code", () => {
    const res = makeRes();
    sendNoContent(res as any, 204);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("sets Access-Control-Allow-Origin header", () => {
    const res = makeRes();
    sendNoContent(res as any, 204);
    expect(res.set).toHaveBeenCalledWith("Access-Control-Allow-Origin", "*");
  });

  it("sets X-Content-Type-Options header", () => {
    const res = makeRes();
    sendNoContent(res as any, 204);
    expect(res.set).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
  });

  it("calls res.end without a body", () => {
    const res = makeRes();
    sendNoContent(res as any, 204);
    expect(res.end).toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  it("does not set Content-Type", () => {
    const res = makeRes();
    sendNoContent(res as any, 204);
    const calls = res.set.mock.calls.map((args: any[]) => args[0] as string);
    expect(calls).not.toContain("Content-Type");
  });

  it("merges custom headers", () => {
    const res = makeRes();
    sendNoContent(res as any, 204, { Allow: "GET, HEAD, OPTIONS" });
    expect(res.set).toHaveBeenCalledWith("Allow", "GET, HEAD, OPTIONS");
  });
});
