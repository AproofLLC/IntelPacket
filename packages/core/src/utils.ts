import {
  INTELPACKET_ERROR_PREFIX,
  MAX_ARRAY_LENGTH,
  MAX_DEPTH,
  MAX_KEYS_PER_OBJECT,
  MAX_STRING_BYTES,
} from "./constants.js";

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function intelPacketError(message: string): Error {
  return new Error(`${INTELPACKET_ERROR_PREFIX}${message}`);
}

export function utf8ByteLength(input: string): number {
  return Buffer.byteLength(input, "utf8");
}

export function assertSafeKey(key: string): void {
  if (DANGEROUS_KEYS.has(key)) {
    throw intelPacketError(`unsafe object key "${key}"`);
  }
}

/** Plain object: prototype is Object.prototype or null. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const p = Object.getPrototypeOf(value);
  return p === Object.prototype || p === null;
}

export function stableSortStrings(values: readonly string[]): string[] {
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function sortRecordKeys<T extends Record<string, unknown>>(record: T): T {
  const keys = stableSortStrings(Object.keys(record));
  const out = {} as T;
  for (const k of keys) {
    assertSafeKey(k);
    const v = record[k];
    if (v !== undefined) {
      out[k as keyof T] = v as T[keyof T];
    }
  }
  return out;
}

/** JSON-safe deep clone for canonicalized packet data. */
export function safeDeepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function stableDeepClone<T>(value: T): T {
  return safeDeepClone(value);
}
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== (b as unknown[]).length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], (b as unknown[])[i])) return false;
    }
    return true;
  }

  const ak = stableSortStrings(Object.keys(a as Record<string, unknown>));
  const bk = stableSortStrings(Object.keys(b as Record<string, unknown>));
  if (ak.length !== bk.length) return false;
  for (let i = 0; i < ak.length; i++) {
    if (ak[i] !== bk[i]) return false;
    const key = ak[i]!;
    if (
      !deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      )
    ) {
      return false;
    }
  }
  return true;
}

export function reductionRatio(rawBytes: number, compressedBytes: number): number {
  if (rawBytes <= 0) return 0;
  return 1 - compressedBytes / rawBytes;
}

function assertJsonValueType(value: unknown): void {
  const t = typeof value;
  if (t === "function" || t === "symbol" || t === "undefined") {
    throw intelPacketError("unsupported value type (function, symbol, or undefined)");
  }
}

function walkPacketTree(
  value: unknown,
  depth: number,
  pathStack: Set<object>,
  allowBigint: boolean,
): void {
  if (depth > MAX_DEPTH) {
    throw intelPacketError("max nesting depth exceeded");
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return;
  }
  if (typeof value === "string") {
    if (utf8ByteLength(value) > MAX_STRING_BYTES) {
      throw intelPacketError("string exceeds max UTF-8 byte length");
    }
    return;
  }
  if (typeof value === "bigint") {
    if (!allowBigint) {
      throw intelPacketError("bigint is not JSON-serializable");
    }
    return;
  }
  assertJsonValueType(value);
  if (
    value instanceof Date ||
    value instanceof RegExp ||
    value instanceof Map ||
    value instanceof Set ||
    value instanceof WeakMap ||
    value instanceof WeakSet
  ) {
    throw intelPacketError("only plain objects and arrays are allowed (not Date, Map, Set, RegExp, or similar)");
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) {
      throw intelPacketError("array exceeds max length");
    }
    if (pathStack.has(value)) {
      throw intelPacketError("circular structure");
    }
    pathStack.add(value);
    try {
      for (let i = 0; i < value.length; i++) {
        const el = value[i];
        if (typeof el === "undefined") continue;
        walkPacketTree(el, depth + 1, pathStack, allowBigint);
      }
    } finally {
      pathStack.delete(value);
    }
    return;
  }
  if (typeof value === "object") {
    if (!isPlainObject(value)) {
      throw intelPacketError("only plain objects are allowed (not class instances or exotic objects)");
    }
    const obj = value as Record<string, unknown>;
    if (pathStack.has(obj)) {
      throw intelPacketError("circular structure");
    }
    pathStack.add(obj);
    try {
      const keys = Object.keys(obj);
      if (keys.length > MAX_KEYS_PER_OBJECT) {
        throw intelPacketError("object exceeds max key count");
      }
      for (const k of keys) {
        assertSafeKey(k);
        const v = obj[k];
        if (typeof v === "undefined") continue;
        walkPacketTree(v, depth + 1, pathStack, allowBigint);
      }
    } finally {
      pathStack.delete(obj);
    }
  }
}

/**
 * Validates packet-bound input: depth/array/key limits, safe keys, no cycles on DFS path.
 * Allows `bigint` at leaves (handled by `normalizeTypes` before JSON stages).
 */
export function validatePacketInput(
  value: unknown,
  depth = 0,
  pathStack = new Set<object>(),
): void {
  walkPacketTree(value, depth, pathStack, true);
}

/** Same traversal limits as {@link validatePacketInput}, but rejects `bigint` (strict JSON subset). */
export function assertJsonCompatible(
  value: unknown,
  depth = 0,
  pathStack = new Set<object>(),
): void {
  walkPacketTree(value, depth, pathStack, false);
}

/** Alias for {@link validatePacketInput} (resource / traversal bounds). */
export const assertTraversalLimits = validatePacketInput;

/** UTF-8 byte length of a string (alias of {@link utf8ByteLength}). */
export const byteSize = utf8ByteLength;

/** Sorted own enumerable entries with dangerous keys rejected. */
export function safeEntries(obj: Record<string, unknown>): [string, unknown][] {
  const keys = stableSortStrings(Object.keys(obj));
  const out: [string, unknown][] = [];
  for (const k of keys) {
    assertSafeKey(k);
    out.push([k, obj[k]]);
  }
  return out;
}

/** Lexicographically sorted shallow copy of a plain object with safe keys only. */
export const stableSortKeys = sortRecordKeys;