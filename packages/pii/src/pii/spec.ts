import { IntelPacketPIIError } from "./errors.js";

export const INTELPACKET_PII_SPEC_NAME = "IntelPacket PII Specification" as const;

export const INTELPACKET_PII_SPEC_VERSION = "1" as const;

export const INTELPACKET_PII_SUPPORTED_MAJOR_VERSION = "1" as const;

export const INTELPACKET_PII_SPEC_DOC_PATH = "packages/pii/docs/intelpacket-pii-spec-v1.md" as const;

/**
 * Asserts that `value` is a {@link PrivacyReport}-shaped object supported for PII Spec v1.
 * When `policy_version` is `"v1"`, `pii_spec_version` must be present and equal to {@link INTELPACKET_PII_SPEC_VERSION}.
 */
export function assertSupportedIntelPacketPIIVersion(value: unknown): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new IntelPacketPIIError("INVALID_POLICY", "Expected privacy report object", []);
  }
  const r = value as Record<string, unknown>;
  if (r.policy_version === "v1") {
    if (r.pii_spec_version !== INTELPACKET_PII_SPEC_VERSION) {
      throw new IntelPacketPIIError(
        "INVALID_POLICY",
        `Unsupported or missing IntelPacket PII spec version (expected ${INTELPACKET_PII_SPEC_VERSION})`,
        [],
      );
    }
  }
}
