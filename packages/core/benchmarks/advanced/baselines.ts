/**
 * Raw JSON compression baselines (Node zlib only).
 */
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

export type BaselineResult = {
  rawBytes: number;
  gzipBytes: number;
  brotliBytes: number;
  gzipReductionPercent: number;
  brotliReductionPercent: number;
};

export function gzipRawJsonUtf8(jsonUtf8: string): Buffer {
  return gzipSync(Buffer.from(jsonUtf8, "utf8"), { level: constants.Z_BEST_SPEED });
}

export function brotliRawJsonUtf8(jsonUtf8: string): Buffer {
  return brotliCompressSync(Buffer.from(jsonUtf8, "utf8"));
}

export function computeBaselines(jsonUtf8: string): BaselineResult {
  const rawBytes = Buffer.byteLength(jsonUtf8, "utf8");
  const gzipBytes = gzipRawJsonUtf8(jsonUtf8).length;
  const brotliBytes = brotliRawJsonUtf8(jsonUtf8).length;
  const gzipReductionPercent =
    rawBytes > 0 ? Math.round((1 - gzipBytes / rawBytes) * 1e6) / 1e4 : 0;
  const brotliReductionPercent =
    rawBytes > 0 ? Math.round((1 - brotliBytes / rawBytes) * 1e6) / 1e4 : 0;
  return {
    rawBytes,
    gzipBytes,
    brotliBytes,
    gzipReductionPercent,
    brotliReductionPercent,
  };
}
