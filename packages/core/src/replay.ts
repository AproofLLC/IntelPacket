import {
  IP_REF_KEY,
  MAX_REF_EXPANSION_DEPTH,
} from "./constants.js";
import { canonicalize } from "./canonicalize.js";
import { expandSchema } from "./compact.js";
import { decompressPacket } from "./compress.js";
import { hashPacket } from "./hash.js";
import { normalizeTypes } from "./normalize.js";
import { innerEnvelopeSchema, intelPacketSchema } from "./schemas.js";
import type { IntelPacket, ReplayPacketOptions, ReplayState } from "./types.js";
import { intelPacketError, isPlainObject, validatePacketInput } from "./utils.js";
import { assertSupportedIntelPacketVersion } from "./spec.js";

/**
 * Replace structural references with materialized subtrees (deterministic, depth-first).
 * Optional `refChain` tracks rN ids along a ref-dereference path to detect cycles.
 */
export function expandRefs(
  value: unknown,
  refs: Readonly<Record<string, unknown>>,
  depth = 0,
  refChain?: Set<string>,
): unknown {
  const chain = refChain ?? new Set<string>();
  if (depth > MAX_REF_EXPANSION_DEPTH) {
    throw intelPacketError("max ref expansion depth exceeded");
  }
  if (isPlainObject(value)) {
    if (Object.hasOwn(value, IP_REF_KEY) && typeof value[IP_REF_KEY] === "string") {
      const id = value[IP_REF_KEY]!;
      if (chain.has(id)) {
        throw intelPacketError(`cyclic dedupe ref "${id}"`);
      }
      const target = refs[id];
      if (target === undefined) {
        throw intelPacketError(`missing dedupe ref "${id}"`);
      }
      chain.add(id);
      try {
        return expandRefs(target, refs, depth + 1, chain);
      } finally {
        chain.delete(id);
      }
    }
    const keys = Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const out: Record<string, unknown> = {};
    const branchChain = new Set(chain);
    for (const k of keys) {
      out[k] = expandRefs(value[k], refs, depth + 1, branchChain);
    }
    return out;
  }
  if (Array.isArray(value)) {
    const branchChain = new Set(chain);
    return value.map((item) => expandRefs(item, refs, depth + 1, branchChain));
  }
  return value;
}

function hashInnerMatches(packet: IntelPacket, inner: ReturnType<typeof innerEnvelopeSchema.parse>): boolean {
  const body = canonicalize({
    ip_version: inner.ip_version,
    encoding: inner.encoding,
    root: inner.root,
    refs: inner.refs,
    delta: inner.delta,
  });
  return hashPacket(body) === packet.packet_hash;
}

/**
 * Reconstruct canonical structured state from a persisted packet (lossless for full payloads).
 *
 * Replay trusts only the **hashed inner envelope** after decompression. `packet.refs` on the
 * outer shell is a non-authoritative mirror for transport/debug; it MUST NOT affect expansion.
 *
 * @param options.verifyHash When true (default), rejects tampered envelopes before expansion.
 */
export function replayPacket(
  packet: IntelPacket,
  options: ReplayPacketOptions = {},
): ReplayState {
  const verifyHash = options.verifyHash !== false;
  assertSupportedIntelPacketVersion(packet);
  intelPacketSchema.parse(packet);
  const utf8 = decompressPacket(packet.payload, packet.compression);
  const parsed: unknown = JSON.parse(utf8);
  const inner = innerEnvelopeSchema.parse(parsed);
  if (verifyHash && !hashInnerMatches(packet, inner)) {
    throw intelPacketError("packet hash verification failed");
  }
  validatePacketInput(inner.root);
  for (const k of Object.keys(inner.refs)) {
    validatePacketInput(inner.refs[k]);
  }
  if (inner.delta !== null) {
    validatePacketInput(inner.delta);
  }
  const refs = inner.refs;
  const deduped = expandRefs(inner.root, refs);
  const expanded = expandSchema(deduped, {
    dictionary: packet.metadata.compaction_dictionary,
  });
  const canonical = canonicalize(expanded);
  validatePacketInput(expanded);
  const normalized = normalizeTypes(expanded);
  const compacted = canonicalize(deduped);

  return {
    normalized,
    canonical,
    compacted,
    deduped,
    expanded,
  };
}