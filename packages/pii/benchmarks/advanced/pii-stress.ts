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

/**
 * Keeps PII advanced runs bounded. `--strict-scale` uses the full requested row count (can take a very long time).
 */
export function effectiveRecordCount(
  scaleRequested: number,
  strict: boolean,
): { recordCount: number; capped: boolean; capReason?: string } {
  if (strict) {
    return { recordCount: scaleRequested, capped: false };
  }
  if (scaleRequested <= 2500) {
    return { recordCount: scaleRequested, capped: false };
  }
  if (scaleRequested <= 10_000) {
    return {
      recordCount: 2500,
      capped: true,
      capReason: "Soft-cap: 2,500 rows for 10k-class scale unless --strict-scale (full 10,000).",
    };
  }
  if (scaleRequested <= 100_000) {
    return {
      recordCount: 5000,
      capped: true,
      capReason: "Soft-cap: 5,000 rows for 100k-class scale unless --strict-scale.",
    };
  }
  return {
    recordCount: 10_000,
    capped: true,
    capReason: "Soft-cap: 10,000 rows for 1m-class unless --strict-scale.",
  };
}
