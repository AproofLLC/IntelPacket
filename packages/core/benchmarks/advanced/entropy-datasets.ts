/**
 * Seeded deterministic synthetic datasets by entropy class.
 * No secrets, no real PII.
 */

export type EntropyClass = "low" | "medium" | "high" | "nested-low" | "nested-high";

export const ENTROPY_ORDER: readonly EntropyClass[] = [
  "low",
  "medium",
  "high",
  "nested-low",
  "nested-high",
] as const;

/** Mulberry32 PRNG — deterministic from seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hex32(rng: () => number): string {
  return Math.floor(rng() * 0xffffffff)
    .toString(16)
    .padStart(8, "0");
}

export function buildEntropyDataset(
  entropy: EntropyClass,
  scale: number,
  seed: number,
): { data: unknown; entropyClass: EntropyClass } {
  const rng = mulberry32(seed);
  switch (entropy) {
    case "low": {
      const records = [];
      for (let i = 0; i < scale; i++) {
        records.push({
          id: i % 50,
          kind: "event",
          tag: "alpha",
          score: 1,
          nested: { a: 0, b: "x" },
        });
      }
      return { data: { records }, entropyClass: entropy };
    }
    case "medium": {
      const records = [];
      for (let i = 0; i < scale; i++) {
        records.push({
          id: (i * 17 + seed) % 10000,
          kind: i % 3 === 0 ? "a" : i % 3 === 1 ? "b" : "c",
          tag: `tag-${i % 200}`,
          score: (i * 13) % 97,
          nested: { a: i % 7, b: `s${(i * 3) % 40}` },
        });
      }
      return { data: { records }, entropyClass: entropy };
    }
    case "high": {
      const records = [];
      for (let i = 0; i < scale; i++) {
        records.push({
          id: `${hex32(rng)}-${hex32(rng)}`,
          blob: hex32(rng) + hex32(rng) + hex32(rng),
          noise: Array.from({ length: 4 }, () => hex32(rng)),
        });
      }
      return { data: { records }, entropyClass: entropy };
    }
    case "nested-low": {
      const inner = { x: 1, y: { z: 2, w: { q: 3 } } };
      const records = [];
      for (let i = 0; i < scale; i++) {
        records.push({ idx: i % 20, tree: inner, flag: true });
      }
      return { data: { records }, entropyClass: entropy };
    }
    case "nested-high": {
      const records = [];
      for (let i = 0; i < scale; i++) {
        records.push({
          idx: i,
          tree: {
            a: hex32(rng),
            b: { c: hex32(rng), d: { e: hex32(rng), f: [hex32(rng), hex32(rng)] } },
          },
        });
      }
      return { data: { records }, entropyClass: entropy };
    }
    default: {
      const _ex: never = entropy;
      throw new Error(`unknown entropy: ${_ex}`);
    }
  }
}
