import { createHmac } from "node:crypto";
import { isPlainObject } from "@intelpacket/core";

export function stableValueRepr(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "string") return `s:${value}`;
  if (t === "number") return `n:${String(value)}`;
  if (t === "boolean") return `b:${String(value)}`;
  if (Array.isArray(value)) {
    return `a:[${value.map((v) => stableValueRepr(v)).join(",")}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const inner = keys
      .map((k) => `${JSON.stringify(k)}:${stableValueRepr((value as Record<string, unknown>)[k])}`)
      .join(",");
    return `o:{${inner}}`;
  }
  return `u:${String(value)}`;
}

export function buildFieldScopedKey(fullPath: string): string {
  return fullPath;
}

export function safeFieldLabel(fullPath: string): string {
  const last =
    fullPath
      .replace(/\[[^\]]+\]/g, ".")
      .split(".")
      .filter(Boolean)
      .pop() ?? "field";
  const slug = last.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 48);
  return slug || "field";
}

export function tokenizeField(
  fullPath: string,
  value: unknown,
  tokenSecret: string,
): string {
  const h = createHmac("sha256", tokenSecret);
  const fieldKey = buildFieldScopedKey(fullPath);
  h.update(fieldKey, "utf8");
  h.update("\u0000", "utf8");
  h.update(stableValueRepr(value), "utf8");
  const digest = h.digest("hex").slice(0, 16);
  const label = safeFieldLabel(fullPath);
  return `tok_${label}_${digest}`;
}
