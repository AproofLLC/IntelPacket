/**
 * Synthetic-only leak scans and stability checks for PII benchmarks.
 */

export function collectKnownSyntheticSecrets(
  tokenSecret: string,
  hmacSecret: string,
): readonly string[] {
  return [tokenSecret, hmacSecret];
}

export function collectKnownSyntheticPIIValues(users: readonly Record<string, unknown>[]): string[] {
  const out = new Set<string>();
  for (const u of users) {
    for (const k of ["email", "phone", "national_id", "legal_name"] as const) {
      const v = u[k];
      if (typeof v === "string" && v.length >= 4) out.add(v);
    }
  }
  return [...out];
}

export function scanForLeaks(sink: string, forbidden: readonly string[]): string[] {
  const hits: string[] = [];
  for (const f of forbidden) {
    if (f.length >= 4 && sink.includes(f)) hits.push(f.slice(0, 48));
  }
  return hits;
}

export function verifyTokenStability(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function verifyHmacStability(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
