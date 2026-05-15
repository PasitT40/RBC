import type { Query } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { badRequest } from "./http.js";

type CursorPayload = {
  v: 1;
  fieldValue: number | null;
  fieldKind: "number" | "timestamp" | "null";
  id: string;
  sort?: string;
};

export function encodeCursor(payload: Omit<CursorPayload, "v">) {
  return Buffer.from(JSON.stringify({ v: 1, ...payload }), "utf8").toString("base64url");
}

const VALID_FIELD_KINDS = new Set<string>(["number", "timestamp", "null"]);

export function decodeCursor(value: string | null): CursorPayload | null {
  if (!value) return null;
  if (value.length > 512) throw badRequest("Invalid cursor");
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as CursorPayload;
    if (parsed?.v !== 1 || typeof parsed.id !== "string") throw new Error("Invalid cursor");
    if (!VALID_FIELD_KINDS.has(parsed.fieldKind)) throw new Error("Invalid cursor");
    return parsed;
  } catch {
    throw badRequest("Invalid cursor");
  }
}

export function applyCursor(query: Query, cursor: CursorPayload | null) {
  if (!cursor) return query;

  if (cursor.fieldKind === "timestamp") {
    if (typeof cursor.fieldValue !== "number") throw badRequest("Invalid cursor");
    return query.startAfter(Timestamp.fromMillis(cursor.fieldValue), cursor.id);
  }

  return query.startAfter(cursor.fieldValue, cursor.id);
}
