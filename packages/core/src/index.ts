export {
  IP_DELETE_SENTINEL,
  IP_ENCODING,
  IP_NUM_ADD_KEY,
  IP_REF_KEY,
  IP_VERSION,
  DEFAULT_COMPACTION_DICTIONARY,
  DEFAULT_COMPACTION_REVERSE,
  INTELPACKET_ERROR_PREFIX,
  INTELPACKET_SPEC_VERSION,
  MAX_ARRAY_LENGTH,
  MAX_BASE64_PAYLOAD_CHARS,
  MAX_COMPRESSED_BUFFER_BYTES,
  MAX_DECOMPRESSED_BYTES,
  MAX_DEPTH,
  MAX_KEYS_PER_OBJECT,
  MAX_PACKET_BYTES,
  MAX_REF_EXPANSION_DEPTH,
  MAX_STRING_BYTES,
} from "./constants.js";

export type {
  CompressionMetadata,
  CreatePacketOptions,
  DedupeReference,
  DedupeResult,
  DeltaPatch,
  DeltaPatchValue,
  DeleteSentinel,
  IntelPacket,
  InnerEnvelope,
  NumericAddPatch,
  PacketMetadata,
  RefPointer,
  ReplayPacketOptions,
  ReplayState,
} from "./types.js";

export { normalizeTypes } from "./normalize.js";
export { canonicalize, canonicalStringify } from "./canonicalize.js";
export {
  compactSchema,
  expandSchema,
  validateCompactionMerge,
  type CompactOptions,
} from "./compact.js";
export { dedupeStructures } from "./dedupe.js";
export { diffPackets, applyDelta } from "./delta.js";
export {
  compressPacket,
  decompressPacket,
  type CompressResult,
} from "./compress.js";
export { hashPacket } from "./hash.js";
export { createPacket, verifyIntelPacket } from "./packet.js";
export { replayPacket, expandRefs } from "./replay.js";
export {
  innerEnvelopeSchema,
  intelPacketSchema,
  metadataSchema,
  replayStateSchema,
  type ParsedIntelPacket,
} from "./schemas.js";
export {
  assertJsonCompatible,
  assertSafeKey,
  assertTraversalLimits,
  byteSize,
  deepEqual,
  intelPacketError,
  isPlainObject,
  reductionRatio,
  safeDeepClone,
  safeEntries,
  sortRecordKeys,
  stableDeepClone,
  stableSortKeys,
  stableSortStrings,
  utf8ByteLength,
  validatePacketInput,
} from "./utils.js";

export {
  INTELPACKET_SPEC_NAME,
  INTELPACKET_PROTOCOL_VERSION,
  INTELPACKET_SUPPORTED_MAJOR_VERSION,
  INTELPACKET_CANONICAL_ENCODING,
  INTELPACKET_HASH_ALGORITHM,
  INTELPACKET_PAYLOAD_ENCODING,
  INTELPACKET_SPEC_URL_OR_DOC_PATH,
  assertSupportedIntelPacketVersion,
} from "./spec.js";
