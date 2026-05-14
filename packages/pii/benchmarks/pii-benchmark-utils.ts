/**
 * Helpers for PII realistic benchmarks (leak checks, stability).
 */
import { performance } from "node:perf_hooks";
import { deepEqual } from "../src/index.js";

export function meanMs(run: () => void, iterations: number, warmup = 2): number {
  for (let i = 0; i < warmup; i++) run();
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) run();
  return (performance.now() - t0) / iterations;
}

export function utf8Bytes(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

export function assertNoSecretLeak(sink: string, secrets: readonly string[], context: string): void {
  for (const s of secrets) {
    if (s.length > 0 && sink.includes(s)) {
      throw new Error(`${context}: benchmark secret leaked into output`);
    }
  }
}

export function collectEmailLikeLiterals(jsonText: string): string[] {
  const out = new Set<string>();
  const re = /[^\s"']+@[^\s"']+\.[^\s"']+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(jsonText)) !== null) {
    out.add(m[0]);
  }
  return [...out];
}

export function assertRawLiteralsAbsent(sink: string, literals: readonly string[], context: string): void {
  for (const lit of literals) {
    if (lit.length > 3 && sink.includes(lit)) {
      throw new Error(`${context}: raw literal still present: ${lit.slice(0, 40)}`);
    }
  }
}

export function assertStableTransform(
  a: unknown,
  b: unknown,
  context: string,
): void {
  if (!deepEqual(a, b)) {
    throw new Error(`${context}: protectPII output not identical across runs (determinism)`);
  }
}

export function getPiiEnvironment(): {
  node: string;
  platform: string;
  arch: string;
  packageName: string;
  packageVersion: string;
} {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    packageName: "@intelpacket/pii",
    packageVersion: "0.1.0",
  };
}

export function markdownTable(headers: readonly string[], rows: (string | number | boolean)[][]): string {
  const esc = (c: string | number | boolean) => String(c).replace(/\|/g, "\\|");
  const head = `| ${headers.map(esc).join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map(esc).join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
}
