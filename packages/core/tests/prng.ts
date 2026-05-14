/**
 * Seeded PRNG for deterministic tests (not for production).
 */
export function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function genRandJson(r: () => number, depth: number): unknown {
  if (depth <= 0 || r() < 0.25) {
    if (r() < 0.15) return null;
    if (r() < 0.3) return Math.floor(r() * 1_000_000);
    if (r() < 0.45) return r() < 0.5;
    return `s${Math.floor(r() * 1e9)}`;
  }
  if (r() < 0.45) {
    const len = Math.floor(r() * 6);
    const a: unknown[] = [];
    for (let i = 0; i < len; i++) {
      a.push(genRandJson(r, depth - 1));
    }
    return a;
  }
  const n = Math.floor(r() * 5) + 1;
  const o: Record<string, unknown> = {};
  for (let i = 0; i < n; i++) {
    const k = `k${i}_${Math.floor(r() * 1e6)}`;
    o[k] = genRandJson(r, depth - 1);
  }
  return o;
}

export function shuffleKeyOrderSeeded(
  obj: Record<string, unknown>,
  rnd: () => number,
): Record<string, unknown> {
  const keys = [...Object.keys(obj)];
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]!];
  }
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = obj[k];
    out[k] =
      v !== null && typeof v === "object" && !Array.isArray(v)
        ? shuffleKeyOrderSeeded(v as Record<string, unknown>, rnd)
        : v;
  }
  return out;
}
