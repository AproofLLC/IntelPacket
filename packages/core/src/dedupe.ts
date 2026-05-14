import { IP_REF_KEY } from "./constants.js";
import { canonicalStringify } from "./canonicalize.js";
import type { DedupeReference, DedupeResult } from "./types.js";
import { assertSafeKey } from "./utils.js";

function isNode(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === "object" && value !== null;
}

type Frame = { readonly fp: string; readonly node: unknown };

/**
 * Structural deduplication: duplicated object/array subtrees collapse to stable references.
 * Repeated **values** (including identical pointers) after the first occurrence become refs.
 */
export function dedupeStructures(input: unknown): DedupeResult {
  const fingerprintCache = new WeakMap<object, string>();
  const structuralFingerprint = (value: unknown): string => {
    if (!isNode(value)) return canonicalStringify(value);
    const cached = fingerprintCache.get(value);
    if (cached !== undefined) return cached;
    const fp = canonicalStringify(value);
    fingerprintCache.set(value, fp);
    return fp;
  };

  const preorder = (value: unknown): Frame[] => {
    const acc: Frame[] = [];
    const walk = (v: unknown) => {
      if (!isNode(v)) return;
      acc.push({ fp: structuralFingerprint(v), node: v });
      if (Array.isArray(v)) {
        for (const item of v) walk(item);
      } else {
        const o = v as Record<string, unknown>;
        const keys = Object.keys(o).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        for (const k of keys) {
          assertSafeKey(k);
          walk(o[k]);
        }
      }
    };
    walk(value);
    return acc;
  };

  const frames = preorder(input);
  const mult = new Map<string, number>();
  for (const f of frames) {
    mult.set(f.fp, (mult.get(f.fp) ?? 0) + 1);
  }

  const sortedFps = [...mult.keys()]
    .filter((fp) => (mult.get(fp) ?? 0) > 1)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const fpToId = new Map<string, string>();
  sortedFps.forEach((fp, i) => {
    fpToId.set(fp, `r${i}`);
  });

  const firstNode = new Map<string, unknown>();
  for (const f of frames) {
    if ((mult.get(f.fp) ?? 0) > 1 && !firstNode.has(f.fp)) {
      firstNode.set(f.fp, f.node);
    }
  }

  const emit = (
    v: unknown,
    counters: Map<string, number>,
    frozenRootFp: string | null,
  ): unknown => {
    if (!isNode(v)) return v;
    const fp = structuralFingerprint(v);
    const m = mult.get(fp) ?? 0;
    if (m > 1) {
      const occ = (counters.get(fp) ?? 0) + 1;
      counters.set(fp, occ);
      const freezeHere =
        frozenRootFp !== null && fp === frozenRootFp && occ === 1;
      if (occ > 1 && !freezeHere) {
        return { [IP_REF_KEY]: fpToId.get(fp)! };
      }
    }

    if (Array.isArray(v)) {
      return v.map((item) => emit(item, counters, frozenRootFp));
    }
    const obj = v as Record<string, unknown>;
    const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      assertSafeKey(k);
      out[k] = emit(obj[k], counters, frozenRootFp);
    }
    return out;
  };

  const refs: Record<string, unknown> = {};
  const references: DedupeReference[] = [];
  for (const fp of sortedFps) {
    const id = fpToId.get(fp)!;
    const node = firstNode.get(fp)!;
    refs[id] = emit(node, new Map(), fp);
    references.push({ id, fingerprint: fp });
  }

  return {
    value: emit(input, new Map(), null),
    refs,
    references,
  };
}
