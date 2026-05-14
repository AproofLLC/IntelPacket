import { assertSafeKey } from "./utils.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalizeInner(input: unknown): unknown {
  if (input === null) return null;
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : null;
  }
  if (typeof input === "boolean") return input;
  if (typeof input === "string") return input;
  if (typeof input === "bigint") return input.toString();
  if (typeof input === "undefined") return null;
  if (Array.isArray(input)) {
    return input.map((item) => canonicalizeInner(item));
  }
  if (isPlainObject(input)) {
    const keys = Object.keys(input).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      assertSafeKey(k);
      out[k] = canonicalizeInner(input[k]);
    }
    return out;
  }
  return null;
}

/**
 * Deterministic structural canonicalization: sorted keys, stable nesting.
 * Idempotent: canonicalize(canonicalize(x)) equals canonicalize(x) for JSON-compatible values.
 */
export function canonicalize<T = unknown>(input: T): T {
  return canonicalizeInner(input) as T;
}

/**
 * Stable canonical JSON string (sorted object keys at every object level).
 */
export function canonicalStringify(input: unknown): string {
  const normalized = canonicalizeInner(input);
  return JSON.stringify(normalized);
}
