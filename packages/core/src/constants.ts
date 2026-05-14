/** Maximum object nesting depth accepted on input / envelope validation. */
export const MAX_DEPTH = 100;

/** Maximum own keys per object (Object.keys). */
export const MAX_KEYS_PER_OBJECT = 10_000;

/** Maximum array length. */
export const MAX_ARRAY_LENGTH = 500_000;

/** Maximum UTF-8 byte length of any single string in validated input. */
export const MAX_STRING_BYTES = 16 * 1024 * 1024;

/** Maximum UTF-8 byte length of inner JSON accepted before compression. */
export const MAX_PACKET_BYTES = 32 * 1024 * 1024;

/** Maximum decompressed UTF-8 bytes returned by `decompressPacket`. */
export const MAX_DECOMPRESSED_BYTES = 32 * 1024 * 1024;

/** Maximum compressed binary size after base64 decode. */
export const MAX_COMPRESSED_BUFFER_BYTES = 48 * 1024 * 1024;

/** Maximum base64 character count for `payload`. */
export const MAX_BASE64_PAYLOAD_CHARS = 70 * 1024 * 1024;

/** Maximum recursion depth when expanding `{ "__ip_ref": "rN" }` trees. */
export const MAX_REF_EXPANSION_DEPTH = 500;

/** IntelPacket protocol version embedded in packets. */
export const IP_VERSION = "1" as const;

/** IntelPacket Specification v1 document revision (outer `spec_version` field when present). */
export const INTELPACKET_SPEC_VERSION = "1" as const;

export const IP_ENCODING = "canonical-json" as const;

/** Sentinel for keys removed via delta patches (JSON-serializable, stable). */
export const IP_DELETE_SENTINEL = "__intelpacket__:delete" as const;

/** Structural reference key used after deduplication. */
export const IP_REF_KEY = "__ip_ref" as const;

/** Delta operation: numeric relative add. */
export const IP_NUM_ADD_KEY = "__ip_num_add" as const;

/** Verbose key → compact key (stable, ASCII). */
export const DEFAULT_COMPACTION_DICTIONARY: Readonly<Record<string, string>> = {
  timestamp: "ts",
  user_id: "uid",
  amount: "amt",
  currency: "cur",
  temperature: "tmp",
  schema_ref: "sch",
  event_type: "et",
  device_id: "did",
  session_id: "sid",
  request_id: "rid",
  correlation_id: "cid",
  metadata: "meta",
  created_at: "c_at",
  updated_at: "u_at",
  description: "desc",
  latitude: "lat",
  longitude: "lon",
  altitude: "alt",
  hostname: "hname",
  port: "prt",
};

/** Compact key → verbose key (stable). */
export const DEFAULT_COMPACTION_REVERSE: Readonly<Record<string, string>> =
  Object.freeze(
    Object.fromEntries(
      Object.entries(DEFAULT_COMPACTION_DICTIONARY).map(([k, v]) => [v, k]),
    ),
  );

export const INTELPACKET_ERROR_PREFIX = "IntelPacket: " as const;
