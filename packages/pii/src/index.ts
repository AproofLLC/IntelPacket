/**
 * @intelpacket/pii — privacy preprocessing + deliberate re-exports from @intelpacket/core
 * for a single-import convenience surface. Core implementations live only in @intelpacket/core.
 */
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
} from "@intelpacket/core";

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
} from "@intelpacket/core";

export { normalizeTypes } from "@intelpacket/core";
export { canonicalize, canonicalStringify } from "@intelpacket/core";
export {
  compactSchema,
  expandSchema,
  validateCompactionMerge,
  type CompactOptions,
} from "@intelpacket/core";
export { dedupeStructures } from "@intelpacket/core";
export { diffPackets, applyDelta } from "@intelpacket/core";
export {
  compressPacket,
  decompressPacket,
  type CompressResult,
} from "@intelpacket/core";
export { hashPacket } from "@intelpacket/core";
export { createPacket, verifyIntelPacket } from "@intelpacket/core";
export { replayPacket, expandRefs } from "@intelpacket/core";
export { assertSupportedIntelPacketVersion } from "@intelpacket/core";
export {
  innerEnvelopeSchema,
  intelPacketSchema,
  metadataSchema,
  replayStateSchema,
  type ParsedIntelPacket,
} from "@intelpacket/core";
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
} from "@intelpacket/core";

export {
  IntelPacketPIIError,
  validatePrivacyPolicy,
  parsePolicyPath,
  formatPath,
  pathMatches,
  findAllowMatch,
  detectPII,
  buildMergedCategoryMap,
  categoryFromFieldName,
  protectPII,
  assertNoUnhandledPII,
  createPrivacyReport,
  verifyPrivacyResult,
  residualPatternScan,
  createPIIPacket,
  INTELPACKET_PII_SPEC_NAME,
  INTELPACKET_PII_SPEC_VERSION,
  INTELPACKET_PII_SUPPORTED_MAJOR_VERSION,
  INTELPACKET_PII_SPEC_DOC_PATH,
  assertSupportedIntelPacketPIIVersion,
  redactValue,
  maskStringByKind,
  inferMaskKindFromFieldName,
  tokenizeField,
  hmacField,
  stableValueRepr,
  buildFieldScopedKey,
  safeFieldLabel,
  type IntelPacketPIIErrorCode,
  type DetectPIIOptions,
  type PolicyPathSegment,
  type PrivacyPolicyV1,
  type PrivacyPolicyMode,
  type ProtectPIIOptions,
  type PIIPacketOptions,
  type PIIDetectResult,
  type PIIDetectedField,
  type PrivacyReport,
  type ProtectPIIResult,
  type PrivacyVerificationResult,
  type MaskFieldKind,
} from "./pii/index.js";
