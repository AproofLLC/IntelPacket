/**
 * Shared helpers for realistic benchmark runners (no I/O).
 */
import { performance } from "node:perf_hooks";
import { createPacket } from "../src/index.js";

export function utf8Bytes(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

export function meanMs(run: () => void, iterations: number, warmup = 2): number {
  for (let i = 0; i < warmup; i++) run();
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) run();
  return (performance.now() - t0) / iterations;
}

export function getEnvironment(): {
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
    packageName: "@intelpacket/core",
    packageVersion: "0.1.0",
  };
}

export function assertSameHash(hashes: readonly string[], dataset: string): void {
  const first = hashes[0];
  for (let i = 1; i < hashes.length; i++) {
    if (hashes[i] !== first) {
      throw new Error(`[${dataset}] determinism failed: packet_hash mismatch at run ${i}`);
    }
  }
}

export function assertRoundTripPacketHash(
  original: { packet_hash: string },
  normalizedReplay: unknown,
  dataset: string,
  options: { createdAt: string; disableCompression?: boolean },
): void {
  const repacked = createPacket(normalizedReplay, {
    createdAt: options.createdAt,
    disableCompression: options.disableCompression,
  });
  if (repacked.packet_hash !== original.packet_hash) {
    throw new Error(
      `[${dataset}] replay round-trip hash mismatch (repacked ${repacked.packet_hash.slice(0, 16)}… vs original ${original.packet_hash.slice(0, 16)}…)`,
    );
  }
}

export function markdownTable(headers: readonly string[], rows: (string | number)[][]): string {
  const esc = (c: string | number) => String(c).replace(/\|/g, "\\|");
  const head = `| ${headers.map(esc).join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map(esc).join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
}
