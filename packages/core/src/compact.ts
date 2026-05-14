import {
  DEFAULT_COMPACTION_DICTIONARY,
  IP_NUM_ADD_KEY,
  IP_REF_KEY,
} from "./constants.js";
import { canonicalize } from "./canonicalize.js";
import { assertSafeKey, intelPacketError } from "./utils.js";

function mergeDictionaries(
  primary: Readonly<Record<string, string>>,
  secondary: Readonly<Record<string, string>>,
): Record<string, string> {
  const out: Record<string, string> = { ...primary };
  for (const [k, v] of Object.entries(secondary)) {
    assertSafeKey(k);
    assertSafeKey(v);
    out[k] = v;
  }
  return out;
}

function isReservedCompactionToken(s: string): boolean {
  if (s === IP_REF_KEY || s === IP_NUM_ADD_KEY) return true;
  if (s.startsWith("__intelpacket__")) return true;
  return false;
}

/**
 * Validates merged verbose→compact map: unique compacts, no alias/verbose ambiguity, reserved tokens.
 */
export function validateCompactionMerge(merged: Readonly<Record<string, string>>): void {
  const verboses = new Set(Object.keys(merged));
  const byCompact = new Map<string, string>();
  for (const [verbose, compact] of Object.entries(merged)) {
    assertSafeKey(verbose);
    assertSafeKey(compact);
    if (isReservedCompactionToken(verbose) || isReservedCompactionToken(compact)) {
      throw intelPacketError("compaction dictionary uses reserved IntelPacket token");
    }
    if (verboses.has(compact)) {
      throw intelPacketError(
        "compaction alias equals another verbose key (ambiguous expansion)",
      );
    }
    const prevV = byCompact.get(compact);
    if (prevV !== undefined && prevV !== verbose) {
      throw intelPacketError(`duplicate compact alias "${compact}"`);
    }
    byCompact.set(compact, verbose);
  }
}

function buildReverse(forward: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(forward).map(([k, v]) => [v, k]));
}

function compactInner(value: unknown, dict: Readonly<Record<string, string>>): unknown {
  if (value === null) return null;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => compactInner(item, dict));
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    assertSafeKey(k);
    const nk = dict[k] ?? k;
    assertSafeKey(nk);
    out[nk] = compactInner(obj[k], dict);
  }
  return out;
}

export type CompactOptions = {
  readonly dictionary?: Readonly<Record<string, string>>;
};

function effectiveDictionary(options?: CompactOptions): Record<string, string> {
  const out = options?.dictionary
    ? mergeDictionaries(DEFAULT_COMPACTION_DICTIONARY, options.dictionary)
    : { ...DEFAULT_COMPACTION_DICTIONARY };
  validateCompactionMerge(out);
  return out;
}

/**
 * Deterministic key compaction using a merged dictionary (defaults + optional custom map).
 */
export function compactSchema(input: unknown, options?: CompactOptions): unknown {
  const dict = effectiveDictionary(options);
  const normalized = canonicalize(input);
  return compactInner(normalized, dict);
}

/**
 * Reverse compaction using the same effective dictionary as `compactSchema`.
 */
export function expandSchema(input: unknown, options?: CompactOptions): unknown {
  const dict = effectiveDictionary(options);
  const reverse = buildReverse(dict);
  return expandInner(input, reverse);
}

function expandInner(value: unknown, reverse: Readonly<Record<string, string>>): unknown {
  if (value === null) return null;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => expandInner(item, reverse));
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    assertSafeKey(k);
    const nk = reverse[k] ?? k;
    assertSafeKey(nk);
    out[nk] = expandInner(obj[k], reverse);
  }
  return canonicalize(out);
}
