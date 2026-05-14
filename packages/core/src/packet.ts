import {
  IP_ENCODING,
  IP_VERSION,
  INTELPACKET_SPEC_VERSION,
  MAX_PACKET_BYTES,
} from "./constants.js";
import { canonicalize, canonicalStringify } from "./canonicalize.js";
import { compactSchema, type CompactOptions } from "./compact.js";
import { compressPacket, decompressPacket } from "./compress.js";
import { dedupeStructures } from "./dedupe.js";
import { diffPackets } from "./delta.js";
import { hashPacket } from "./hash.js";
import { normalizeTypes } from "./normalize.js";
import { innerEnvelopeSchema, intelPacketSchema } from "./schemas.js";
import type { CreatePacketOptions, DeltaPatch, IntelPacket } from "./types.js";
import { intelPacketError, utf8ByteLength, validatePacketInput } from "./utils.js";

function compactOpts(meta: CreatePacketOptions["metadata"]): CompactOptions | undefined {
  const dict = meta?.compaction_dictionary;
  return dict ? { dictionary: dict } : undefined;
}

function hashingEnvelope(parts: {
  readonly root: unknown;
  readonly refs: Readonly<Record<string, unknown>>;
  readonly delta: DeltaPatch | null;
}): unknown {
  return canonicalize({
    ip_version: IP_VERSION,
    encoding: IP_ENCODING,
    root: parts.root,
    refs: parts.refs,
    delta: parts.delta,
  });
}

/**
 * Full pipeline: normalize → canonicalize → compact → dedupe → (optional delta metadata) → compress → hash → packet shell.
 *
 * v0.1 packets are **full replay packets**: the inner envelope always carries the complete next `root` + `refs`.
 * When `options.base` is set, a deterministic `delta` is also stored for patch/audit workflows—it does not switch
 * the wire format to delta-only storage (that would be future work).
 */
export function createPacket(
  input: unknown,
  options: CreatePacketOptions = {},
): IntelPacket {
  const normalized = normalizeTypes(input);
  const canonical = canonicalize(normalized);
  const co = compactOpts(options.metadata);
  const compacted = compactSchema(canonical, co);
  const deduped = dedupeStructures(compacted);

  let delta: DeltaPatch | null = null;
  if (options.base !== undefined) {
    const baseNorm = normalizeTypes(options.base);
    const baseCan = canonicalize(baseNorm);
    const baseCompact = compactSchema(baseCan, co);
    delta = diffPackets(baseCompact, compacted);
    if (Object.keys(delta).length === 0) delta = null;
  }

  const hashedBody = hashingEnvelope({
    root: deduped.value,
    refs: deduped.refs,
    delta,
  });

  const packet_hash = hashPacket(hashedBody);
  const packet_id = packet_hash.slice(0, 16);
  const innerUtf8 = canonicalStringify(hashedBody);
  if (utf8ByteLength(innerUtf8) > MAX_PACKET_BYTES) {
    throw intelPacketError("inner envelope exceeds maximum UTF-8 size");
  }
  const compressed = compressPacket(innerUtf8, {
    preferZlib: options.preferZlib,
    disable: options.disableCompression,
  });

  const createdAt = options.createdAt ?? new Date().toISOString();

  const result: IntelPacket = {
    ip_version: IP_VERSION,
    spec_version: INTELPACKET_SPEC_VERSION,
    packet_id,
    packet_hash,
    created_at: createdAt,
    encoding: IP_ENCODING,
    compression: compressed.metadata,
    payload: compressed.base64,
    refs: deduped.refs,
    delta,
    metadata: options.metadata ?? {},
  };
  intelPacketSchema.parse(result);
  return result;
}

/**
 * Verify `packet_hash` matches the canonical inner envelope after decompression.
 */
export function verifyIntelPacket(packet: IntelPacket): boolean {
  const outer = intelPacketSchema.safeParse(packet);
  if (!outer.success) return false;
  let utf8: string;
  try {
    utf8 = decompressPacket(outer.data.payload, outer.data.compression);
  } catch {
    return false;
  }
  let inner: ReturnType<typeof innerEnvelopeSchema.parse>;
  try {
    inner = innerEnvelopeSchema.parse(JSON.parse(utf8));
  } catch {
    return false;
  }
  try {
    validatePacketInput(inner.root);
    for (const rk of Object.keys(inner.refs)) {
      validatePacketInput(inner.refs[rk]);
    }
    if (inner.delta !== null) {
      validatePacketInput(inner.delta);
    }
  } catch {
    return false;
  }
  const body = canonicalize({
    ip_version: inner.ip_version,
    encoding: inner.encoding,
    root: inner.root,
    refs: inner.refs,
    delta: inner.delta,
  });
  return hashPacket(body) === outer.data.packet_hash;
}
