/**
 * Deterministic statistics for PII advanced benchmarks (copy of core pattern; no cross-package import).
 */

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function minMax(values: readonly number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 0 };
  let lo = values[0]!;
  let hi = values[0]!;
  for (let i = 1; i < values.length; i++) {
    const v = values[i]!;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return { min: lo, max: hi };
}

export function percentileLinear(sortedAsc: readonly number[], p: number): number {
  const n = sortedAsc.length;
  if (n === 0) return NaN;
  if (n === 1) return sortedAsc[0]!;
  const rank = (p / 100) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo]!;
  const t = rank - lo;
  return sortedAsc[lo]! + (sortedAsc[hi]! - sortedAsc[lo]!) * t;
}

export type TimingSummary = {
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  opsPerSec: number;
};

export function summarizeTimingMs(samplesMs: readonly number[]): TimingSummary {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const { min, max } = minMax(sorted);
  const avg = mean(sorted);
  return {
    avgMs: round4(avg),
    p50Ms: round4(percentileLinear(sorted, 50)),
    p95Ms: round4(percentileLinear(sorted, 95)),
    p99Ms: round4(percentileLinear(sorted, 99)),
    minMs: round4(min),
    maxMs: round4(max),
    opsPerSec: round4(avg > 0 ? 1000 / avg : 0),
  };
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

export function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    out[k] = sortKeysDeep(o[k]);
  }
  return out;
}

export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value), null, 2);
}
