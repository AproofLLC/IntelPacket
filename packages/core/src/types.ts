import type { IP_DELETE_SENTINEL, IP_NUM_ADD_KEY, IP_REF_KEY } from "./constants.js";

export type DeleteSentinel = typeof IP_DELETE_SENTINEL;

export type RefPointer = {
  [K in typeof IP_REF_KEY]: string;
};

export type NumericAddPatch = {
  [K in typeof IP_NUM_ADD_KEY]: number;
};

/** Scalar patch value or nested patch object. */
export type DeltaPatchValue =
  | unknown
  | DeleteSentinel
  | NumericAddPatch
  | DeltaPatch;

export type DeltaPatch = {
  readonly [key: string]: DeltaPatchValue;
};

export type CompressionMetadata = {
  readonly method: "brotli" | "zlib" | "none";
  readonly raw_bytes: number;
  readonly compressed_bytes: number;
  readonly reduction_ratio: number;
};

export type PacketMetadata = {
  readonly title?: string;
  readonly labels?: readonly string[];
  /** Custom compaction dictionary: verbose → compact (merged with defaults). */
  readonly compaction_dictionary?: Readonly<Record<string, string>>;
};

export type DedupeReference = {
  readonly id: string;
  readonly fingerprint: string;
};

export type IntelPacket = {
  readonly ip_version: string;
  /**
   * IntelPacket Specification document revision on the outer shell (Spec v1 uses `"1"`).
   * Omitted on legacy packets; when present must match the supported spec revision.
   */
  readonly spec_version?: "1";
  readonly packet_id: string;
  readonly packet_hash: string;
  /** ISO-8601; display/provenance only — excluded from `packet_hash` by default. */
  readonly created_at: string;
  readonly encoding: string;
  readonly compression: CompressionMetadata;
  /** Base64-encoded compressed canonical inner envelope. */
  readonly payload: string;
  /**
   * Mirror of inner dedupe refs for transport/debug. Integrity and replay use the hashed inner
   * envelope only; tampering this field alone must not change replay output.
   */
  readonly refs: Readonly<Record<string, unknown>>;
  readonly delta: DeltaPatch | null;
  readonly metadata: PacketMetadata;
};

export type ReplayState = {
  readonly normalized: unknown;
  readonly canonical: unknown;
  readonly compacted: unknown;
  readonly deduped: unknown;
  readonly expanded: unknown;
};

export type DedupeResult = {
  readonly value: unknown;
  readonly refs: Record<string, unknown>;
  readonly references: readonly DedupeReference[];
};

export type CreatePacketOptions = {
  readonly base?: unknown;
  readonly metadata?: PacketMetadata;
  /** When set, used instead of `new Date().toISOString()` for `created_at`. */
  readonly createdAt?: string;
  /** Override compression: default tries Brotli then falls back to zlib. */
  readonly preferZlib?: boolean;
  readonly disableCompression?: boolean;
};

/** Options for `replayPacket`. */
export type ReplayPacketOptions = {
  /**
   * When true (default), verify `packet_hash` against the decompressed inner envelope
   * before expansion. Set false only for trusted offline inspection (unsafe).
   */
  readonly verifyHash?: boolean;
};

export type InnerEnvelope = {
  readonly root: unknown;
  readonly refs: Readonly<Record<string, unknown>>;
  readonly delta: DeltaPatch | null;
};
