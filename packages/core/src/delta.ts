import { IP_DELETE_SENTINEL, IP_NUM_ADD_KEY } from "./constants.js";
import { canonicalize } from "./canonicalize.js";
import { stableDeepClone, deepEqual, assertSafeKey, validatePacketInput } from "./utils.js";
import type { DeltaPatch } from "./types.js";

function isPlainPatchObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function diffRecursive(b: unknown, n: unknown): unknown {
  if (deepEqual(b, n)) return {};
  if (
    b === null ||
    n === null ||
    typeof b !== "object" ||
    typeof n !== "object" ||
    Array.isArray(b) !== Array.isArray(n)
  ) {
    return n;
  }
  if (Array.isArray(n)) {
    return n;
  }
  const bo = b as Record<string, unknown>;
  const no = n as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(bo), ...Object.keys(no)])].sort(
    (a, c) => (a < c ? -1 : a > c ? 1 : 0),
  );
  const patch: Record<string, unknown> = {};
  for (const k of keys) {
    assertSafeKey(k);
    const hasB = Object.hasOwn(bo, k);
    const hasN = Object.hasOwn(no, k);
    if (!hasN) {
      patch[k] = IP_DELETE_SENTINEL;
      continue;
    }
    if (!hasB) {
      patch[k] = no[k];
      continue;
    }
    if (
      typeof bo[k] === "number" &&
      typeof no[k] === "number" &&
      Number.isFinite(bo[k]) &&
      Number.isFinite(no[k])
    ) {
      const deltaNum = no[k] - bo[k];
      if (deltaNum !== 0) {
        patch[k] = { [IP_NUM_ADD_KEY]: deltaNum };
      }
      continue;
    }
    if (deepEqual(bo[k], no[k])) continue;
    const child = diffRecursive(bo[k], no[k]);
    if (isPlainPatchObject(child) && Object.keys(child).length === 0) continue;
    patch[k] = child;
  }
  return patch;
}

/**
 * Deterministic patch from canonical `base` to canonical `next` (minimal nested object).
 */
export function diffPackets(base: unknown, next: unknown): DeltaPatch {
  validatePacketInput(base);
  validatePacketInput(next);
  const b = canonicalize(base);
  const n = canonicalize(next);
  if (deepEqual(b, n)) return {};
  const d = diffRecursive(b, n);
  return canonicalize(d ?? {}) as DeltaPatch;
}

function applyRecursive(target: unknown, patch: unknown): unknown {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) {
    return patch;
  }
  const p = patch as Record<string, unknown>;
  if (Object.keys(p).length === 0) return target;

  if (typeof target !== "object" || target === null || Array.isArray(target)) {
    return canonicalize(patch);
  }

  const t = stableDeepClone(target) as Record<string, unknown>;
  const keys = Object.keys(p).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const k of keys) {
    assertSafeKey(k);
    const pv = p[k];
    if (pv === IP_DELETE_SENTINEL) {
      delete t[k];
      continue;
    }
    if (
      isPlainPatchObject(pv) &&
      Object.hasOwn(pv, IP_NUM_ADD_KEY) &&
      typeof pv[IP_NUM_ADD_KEY] === "number"
    ) {
      const cur = t[k];
      const add = pv[IP_NUM_ADD_KEY]!;
      if (typeof cur === "number" && Number.isFinite(cur)) {
        t[k] = cur + add;
      } else {
        t[k] = add;
      }
      continue;
    }
    if (!Object.hasOwn(t, k)) {
      t[k] = pv;
      continue;
    }
    if (isPlainPatchObject(pv) && Object.keys(pv).length > 0) {
      t[k] = applyRecursive(t[k], pv);
    } else {
      t[k] = pv;
    }
  }
  return canonicalize(t);
}

/**
 * Apply a deterministic patch produced by `diffPackets`.
 */
export function applyDelta(base: unknown, delta: DeltaPatch): unknown {
  validatePacketInput(base);
  validatePacketInput(delta);
  const b = canonicalize(base);
  const d = canonicalize(delta);
  if (isPlainPatchObject(d) && Object.keys(d).length === 0) return b;
  return applyRecursive(b, d);
}
