import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";

export class HttpError extends Error {
  status: number;
  code: string;
  headers?: Record<string, string>;

  constructor(status: number, code: string, message: string, headers?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export function badRequest(message: string) {
  return new HttpError(400, "BAD_REQUEST", message);
}

export function notFound(message: string) {
  return new HttpError(404, "NOT_FOUND", message, {
    "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
  });
}

export function methodNotAllowed() {
  return new HttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
}

export function createHttpError(error: unknown) {
  if (error instanceof HttpError) return error;
  return new HttpError(500, "INTERNAL", "Internal server error");
}

export function sendJson(
  res: Response,
  status: number,
  payload: unknown,
  headers: Record<string, string> = {}
) {
  res.status(status);
  res.set("Content-Type", "application/json; charset=utf-8");
  for (const [key, value] of Object.entries(headers)) {
    res.set(key, value);
  }
  res.send(JSON.stringify(payload));
}

export function getRequiredString(value: unknown, message: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) throw badRequest(message);
  return trimmed;
}

export function getQueryParam(req: Request, key: string) {
  const raw = req.query[key];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return typeof first === "string" ? first : null;
  }
  return null;
}
