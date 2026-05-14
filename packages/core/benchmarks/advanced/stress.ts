/**
 * CLI scale / iteration defaults for stress benchmarks.
 */

export type ScaleName = "10k" | "100k" | "1m";

export function parseScaleArg(argv: readonly string[]): ScaleName {
  for (const a of argv) {
    if (a.startsWith("--scale=")) {
      const v = a.slice("--scale=".length).toLowerCase();
      if (v === "10k" || v === "100k" || v === "1m") return v as ScaleName;
      throw new Error(`Invalid --scale (use 10k, 100k, or 1m): ${a}`);
    }
  }
  return "10k";
}

export function parseIterationsArg(argv: readonly string[]): number | undefined {
  for (const a of argv) {
    if (a.startsWith("--iterations=")) {
      const n = Number(a.slice("--iterations=".length));
      if (!Number.isFinite(n) || n < 1 || n > 500) {
        throw new Error(`Invalid --iterations (1..500): ${a}`);
      }
      return Math.floor(n);
    }
  }
  return undefined;
}

export function scaleToCount(name: ScaleName): number {
  switch (name) {
    case "10k":
      return 10_000;
    case "100k":
      return 100_000;
    case "1m":
      return 1_000_000;
    default:
      throw new Error(`unknown scale ${name}`);
  }
}

export function defaultIterationsForScale(name: ScaleName): number {
  switch (name) {
    case "10k":
      return 25;
    case "100k":
      return 10;
    case "1m":
      return 3;
    default:
      return 25;
  }
}

export function parseStrictScale(argv: readonly string[]): boolean {
  return argv.includes("--strict-scale");
}

/** Soft-cap very large core payloads so 100k/1m modes stay runnable without `--strict-scale`. */
export function effectiveRecordCountCore(
  scaleRequested: number,
  strict: boolean,
): { recordCount: number; capped: boolean; capReason?: string } {
  if (strict) {
    return { recordCount: scaleRequested, capped: false };
  }
  if (scaleRequested <= 15_000) {
    return { recordCount: scaleRequested, capped: false };
  }
  if (scaleRequested <= 100_000) {
    return {
      recordCount: 15_000,
      capped: true,
      capReason: "Soft-cap: 15,000 records for 100k-class unless --strict-scale.",
    };
  }
  return {
    recordCount: 50_000,
    capped: true,
    capReason: "Soft-cap: 50,000 records for 1m-class unless --strict-scale.",
  };
}
