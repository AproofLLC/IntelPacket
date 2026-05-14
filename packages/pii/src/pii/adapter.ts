import {
  assertSupportedIntelPacketVersion,
  createPacket,
} from "@intelpacket/core";
import type { CreatePacketOptions, IntelPacket } from "@intelpacket/core";
import type { PrivacyReport, ProtectPIIOptions } from "./types.js";
import { assertSupportedIntelPacketPIIVersion } from "./spec.js";
import { protectPII } from "./transform.js";

export type PIIPacketOptions = ProtectPIIOptions & {
  packetOptions?: CreatePacketOptions;
};

export function createPIIPacket(
  input: unknown,
  policy: unknown,
  options: PIIPacketOptions = {},
): { packet: IntelPacket; privacy: PrivacyReport } {
  const { packetOptions, ...piiOpts } = options;
  const protectedResult = protectPII(input, policy, piiOpts);
  assertSupportedIntelPacketPIIVersion(protectedResult.report);
  const packet = createPacket(protectedResult.data, packetOptions ?? {});
  assertSupportedIntelPacketVersion(packet);
  return { packet, privacy: protectedResult.report };
}
