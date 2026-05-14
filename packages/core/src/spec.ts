import { INTELPACKET_SPEC_VERSION, IP_VERSION } from "./constants.js";
import { intelPacketError } from "./utils.js";
import { intelPacketSchema } from "./schemas.js";

/** Human-readable name of the formal specification document. */
export const INTELPACKET_SPEC_NAME = "IntelPacket Specification" as const;
export const INTELPACKET_PROTOCOL_VERSION = IP_VERSION;

/** Major protocol version accepted by this engine (`ip_version` / inner envelope). */
export const INTELPACKET_SUPPORTED_MAJOR_VERSION = "1" as const;

export const INTELPACKET_CANONICAL_ENCODING = "utf8" as const;

export const INTELPACKET_HASH_ALGORITHM = "sha256" as const;

export const INTELPACKET_PAYLOAD_ENCODING = "base64" as const;

/** Repository path to the Spec v1 markdown (for tooling and error messages). */
export const INTELPACKET_SPEC_URL_OR_DOC_PATH =
  "packages/core/docs/intelpacket-spec-v1.md" as const;

/**
 * Asserts that `packet` matches the outer IntelPacket shell and is supported for Spec v1.
 * Reuses `intelPacketSchema` (Zod); throws `intelPacketError` on failure.
 *
 * If `spec_version` is present on the packet, it must equal {@link INTELPACKET_SPEC_VERSION}.
 * Packets without `spec_version` are still accepted (pre-spec field omission).
 */
export function assertSupportedIntelPacketVersion(packet: unknown): void {
  const r = intelPacketSchema.safeParse(packet);
  if (!r.success) {
    throw intelPacketError(`unsupported or malformed IntelPacket: ${r.error.message}`);
  }
  const p = r.data as { spec_version?: string };
  if (p.spec_version !== undefined && p.spec_version !== INTELPACKET_SPEC_VERSION) {
    throw intelPacketError(
      `unsupported IntelPacket spec_version: ${String(p.spec_version)} (supported: ${INTELPACKET_SPEC_VERSION})`,
    );
  }
}
