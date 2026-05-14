import {
  assertSafeKey,
  intelPacketError,
  utf8ByteLength,
  validatePacketInput,
} from "./utils.js";
import { MAX_STRING_BYTES } from "./constants.js";

function normalizeString(raw: string): string {
  try {
    return raw.normalize("NFC");
  } catch {
    return raw;
  }
}

function isValidCalendarDate(y: number, mo: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return false;
  if (mo < 1 || mo > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function parseSpaceSeparatedUtc(trimmed: string): string | null {
  const m = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i,
  );
  if (!m) return null;
  const Y = Number(m[1]);
  const Mo = Number(m[2]);
  const D = Number(m[3]);
  if (!isValidCalendarDate(Y, Mo, D)) return null;
  let h = Number(m[4]);
  const mi = Number(m[5]);
  const sec = m[6] ? Number(m[6]) : 0;
  const ap = m[7]?.toUpperCase();
  if (mi > 59 || sec > 59 || mi < 0 || sec < 0) return null;
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  if (h < 0 || h > 23) return null;
  return new Date(Date.UTC(Y, Mo - 1, D, h, mi, sec)).toISOString();
}

function tryNormalizeTimestamp(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const spaceUtc = parseSpaceSeparatedUtc(trimmed);
  if (spaceUtc !== null) return spaceUtc;
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return null;
  }
  const datePart = trimmed.slice(0, 10);
  const dm = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) return null;
  const y = Number(dm[1]);
  const mo = Number(dm[2]);
  const d = Number(dm[3]);
  if (!isValidCalendarDate(y, mo, d)) return null;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;
  const chk = new Date(ms);
  if (
    chk.getUTCFullYear() !== y ||
    chk.getUTCMonth() + 1 !== mo ||
    chk.getUTCDate() !== d
  ) {
    return null;
  }
  return chk.toISOString();
}

/**
 * Word-only boolean normalization (does not treat "0"/"1" as booleans).
 */
function normalizeBooleanish(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
    if (s === "yes") return true;
    if (s === "no") return false;
  }
  return null;
}

/**
 * Decimal strings only (e.g. amount "49.990"); integer strings stay strings (IDs, codes, leading zeros).
 */
function normalizeDecimalString(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  if (/^[-+]?\d+$/.test(t)) return null;
  if (!/^[-+]?(?:\d+\.\d*|\d*\.\d+)$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Deterministic normalization of common scalar encodings and nesting.
 * Does not mutate the input. `undefined` is elided from objects and arrays.
 */
export function normalizeTypes(input: unknown): unknown {
  validatePacketInput(input);
  if (input === null) return null;
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : null;
  }
  if (typeof input === "string") {
    if (utf8ByteLength(input) > MAX_STRING_BYTES) {
      throw intelPacketError("string exceeds max UTF-8 byte length");
    }
    const s = normalizeString(input);
    const b = normalizeBooleanish(s);
    if (b !== null) return b;
    const iso = tryNormalizeTimestamp(s);
    if (iso !== null) return iso;
    const n = normalizeDecimalString(s);
    if (n !== null) return n;
    return s;
  }
  if (typeof input === "bigint") {
    const asNum = Number(input);
    if (BigInt(asNum) === input && Number.isSafeInteger(asNum)) return asNum;
    return input.toString();
  }
  if (typeof input === "boolean") return input;
  if (typeof input === "undefined") return undefined;
  if (Array.isArray(input)) {
    const out: unknown[] = [];
    for (const item of input) {
      if (typeof item === "undefined") continue;
      out.push(normalizeTypes(item));
    }
    return out;
  }
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      assertSafeKey(key);
      const v = obj[key];
      if (typeof v === "undefined") continue;
      out[key] = normalizeTypes(v);
    }
    return out;
  }
  return null;
}
