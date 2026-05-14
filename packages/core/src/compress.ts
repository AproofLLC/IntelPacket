import {
  brotliCompressSync,
  brotliDecompressSync,
  constants,
  deflateSync,
  inflateSync,
} from "node:zlib";
import {
  MAX_BASE64_PAYLOAD_CHARS,
  MAX_COMPRESSED_BUFFER_BYTES,
  MAX_DECOMPRESSED_BYTES,
  MAX_PACKET_BYTES,
} from "./constants.js";
import type { CompressionMetadata } from "./types.js";
import { intelPacketError, reductionRatio, utf8ByteLength } from "./utils.js";

export type CompressResult = {
  readonly utf8: string;
  readonly base64: string;
  readonly metadata: CompressionMetadata;
};

const BASE64_RE = /^[A-Za-z0-9+/]*=*$/;

function compressRaw(input: Buffer, preferZlib: boolean | undefined): {
  buf: Buffer;
  method: "brotli" | "zlib";
} {
  if (preferZlib) {
    const buf = deflateSync(input, { level: 9 });
    return { buf, method: "zlib" };
  }
  try {
    const buf = brotliCompressSync(input, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 6,
      },
    });
    return { buf, method: "brotli" };
  } catch {
    const buf = deflateSync(input, { level: 9 });
    return { buf, method: "zlib" };
  }
}

function assertValidBase64Payload(payload: string): Buffer {
  if (payload.length > MAX_BASE64_PAYLOAD_CHARS) {
    throw intelPacketError("payload base64 string exceeds maximum length");
  }
  if (!BASE64_RE.test(payload)) {
    throw intelPacketError("payload is not valid base64");
  }
  const buf = Buffer.from(payload, "base64");
  if (buf.length > MAX_COMPRESSED_BUFFER_BYTES) {
    throw intelPacketError("decoded compressed buffer exceeds maximum size");
  }
  return buf;
}

/**
 * Compress canonical UTF-8 payload bytes. Brotli by default; zlib on failure or when preferred.
 */
export function compressPacket(
  utf8Payload: string,
  options?: {
    readonly preferZlib?: boolean;
    readonly disable?: boolean;
  },
): CompressResult {
  const raw_bytes = utf8ByteLength(utf8Payload);
  if (raw_bytes > MAX_PACKET_BYTES) {
    throw intelPacketError("payload UTF-8 exceeds maximum size before compression");
  }
  const input = Buffer.from(utf8Payload, "utf8");
  if (options?.disable) {
    const metadata: CompressionMetadata = {
      method: "none",
      raw_bytes,
      compressed_bytes: raw_bytes,
      reduction_ratio: 0,
    };
    return {
      utf8: utf8Payload,
      base64: input.toString("base64"),
      metadata,
    };
  }
  const { buf, method } = compressRaw(input, options?.preferZlib);
  const metadata: CompressionMetadata = {
    method,
    raw_bytes,
    compressed_bytes: buf.length,
    reduction_ratio: Math.max(0, reductionRatio(raw_bytes, buf.length)),
  };
  return { utf8: utf8Payload, base64: buf.toString("base64"), metadata };
}

/**
 * Losslessly decompress a packet payload produced by `compressPacket`.
 */
export function decompressPacket(
  base64Payload: string,
  metadata: CompressionMetadata,
): string {
  if (metadata.method !== "brotli" && metadata.method !== "zlib" && metadata.method !== "none") {
    throw intelPacketError("unsupported compression method");
  }
  if (
    metadata.raw_bytes < 0 ||
    metadata.compressed_bytes < 0 ||
    metadata.reduction_ratio < -1e-9 ||
    metadata.reduction_ratio > 1.000_001
  ) {
    throw intelPacketError("invalid compression metadata");
  }
  if (metadata.raw_bytes > 0) {
    const expected = Math.max(0, reductionRatio(metadata.raw_bytes, metadata.compressed_bytes));
    if (Math.abs(metadata.reduction_ratio - expected) > 1e-6) {
      throw intelPacketError("compression reduction_ratio inconsistent with byte counts");
    }
  } else if (metadata.reduction_ratio !== 0) {
    throw intelPacketError("invalid compression metadata");
  }
  if (metadata.method === "none") {
    const buf = assertValidBase64Payload(base64Payload);
    if (buf.length !== metadata.raw_bytes) {
      throw intelPacketError("compression metadata inconsistent with none-method payload");
    }
    if (buf.length > MAX_DECOMPRESSED_BYTES) {
      throw intelPacketError("decompressed output exceeds maximum size");
    }
    return buf.toString("utf8");
  }

  const buf = assertValidBase64Payload(base64Payload);
  if (buf.length !== metadata.compressed_bytes) {
    throw intelPacketError("compressed byte length does not match metadata");
  }

  const opts = { maxOutputLength: MAX_DECOMPRESSED_BYTES };
  let out: Buffer;
  try {
    if (metadata.method === "brotli") {
      out = brotliDecompressSync(buf, opts);
    } else {
      out = inflateSync(buf, opts);
    }
  } catch {
    throw intelPacketError("decompression failed or exceeded max output size");
  }
  if (out.length > MAX_DECOMPRESSED_BYTES) {
    throw intelPacketError("decompressed output exceeds maximum size");
  }
  if (out.length !== metadata.raw_bytes) {
    throw intelPacketError("decompressed size does not match metadata raw_bytes");
  }
  return out.toString("utf8");
}
