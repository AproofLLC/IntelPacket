import { z } from "zod";
import {
  INTELPACKET_SPEC_VERSION,
  IP_ENCODING,
  IP_VERSION,
  MAX_BASE64_PAYLOAD_CHARS,
  MAX_KEYS_PER_OBJECT,
} from "./constants.js";

const SAFE_KEY = z
  .string()
  .refine(
    (k) =>
      k !== "__proto__" && k !== "constructor" && k !== "prototype",
    "unsafe object key",
  );

export const compressionSchema = z
  .object({
    method: z.enum(["brotli", "zlib", "none"]),
    raw_bytes: z.number().int().nonnegative(),
    compressed_bytes: z.number().int().nonnegative(),
    reduction_ratio: z.number().finite().min(0).max(1),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.method === "none") {
      if (c.raw_bytes !== c.compressed_bytes) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "none compression requires raw_bytes === compressed_bytes",
        });
      }
      if (c.reduction_ratio !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "none compression requires reduction_ratio === 0",
          path: ["reduction_ratio"],
        });
      }
      return;
    }
    if (c.raw_bytes > 0) {
      const expected = Math.max(0, 1 - c.compressed_bytes / c.raw_bytes);
      if (Math.abs(c.reduction_ratio - expected) > 1e-6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "reduction_ratio inconsistent with raw_bytes and compressed_bytes",
          path: ["reduction_ratio"],
        });
      }
    }
  });

export const metadataSchema = z
  .object({
    title: z.string().max(65536).optional(),
    labels: z.array(z.string().max(1024)).max(10000).optional(),
    compaction_dictionary: z
      .record(SAFE_KEY, z.string().max(256))
      .refine(
        (r) => Object.keys(r).length <= 5000,
        { message: "compaction_dictionary exceeds maximum keys" },
      )
      .optional(),
  })
  .strict();

const refIdSchema = z.string().regex(/^r\d+$/);

export const innerEnvelopeSchema = z
  .object({
    ip_version: z.literal(IP_VERSION),
    encoding: z.literal(IP_ENCODING),
    root: z.unknown(),
    refs: z.record(refIdSchema, z.unknown()),
    delta: z.record(SAFE_KEY, z.unknown()).nullable(),
  })
  .strict()
  .superRefine((e, ctx) => {
    if (Object.keys(e.refs).length > MAX_KEYS_PER_OBJECT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "refs exceed maximum key count",
        path: ["refs"],
      });
    }
    if (e.delta !== null && Object.keys(e.delta).length > MAX_KEYS_PER_OBJECT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "delta exceeds maximum key count",
        path: ["delta"],
      });
    }
  });

export const intelPacketSchema = z
  .object({
    ip_version: z.literal(IP_VERSION),
    spec_version: z.literal(INTELPACKET_SPEC_VERSION).optional(),
    packet_id: z.string().regex(/^[a-f0-9]{16}$/),
    packet_hash: z.string().regex(/^[a-f0-9]{64}$/),
    created_at: z.string().max(128),
    encoding: z.literal(IP_ENCODING),
    compression: compressionSchema,
    payload: z.string().max(MAX_BASE64_PAYLOAD_CHARS),
    refs: z.record(refIdSchema, z.unknown()),
    delta: z.record(SAFE_KEY, z.unknown()).nullable(),
    metadata: metadataSchema,
  })
  .strict()
  .superRefine((p, ctx) => {
    if (Object.keys(p.refs).length > MAX_KEYS_PER_OBJECT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "refs exceed maximum key count",
        path: ["refs"],
      });
    }
    if (p.delta !== null && Object.keys(p.delta).length > MAX_KEYS_PER_OBJECT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "delta exceeds maximum key count",
        path: ["delta"],
      });
    }
  })
  .refine((p) => p.packet_id === p.packet_hash.slice(0, 16), {
    message: "packet_id must equal first 16 hex chars of packet_hash",
  });

export const replayStateSchema = z.object({
  normalized: z.unknown(),
  canonical: z.unknown(),
  compacted: z.unknown(),
  deduped: z.unknown(),
  expanded: z.unknown(),
});

export type ParsedIntelPacket = z.infer<typeof intelPacketSchema>;
