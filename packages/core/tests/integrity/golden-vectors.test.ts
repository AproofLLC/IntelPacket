import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canonicalStringify,
  canonicalize,
  createPacket,
  IP_VERSION,
  INTELPACKET_SPEC_VERSION,
  normalizeTypes,
  replayPacket,
  verifyIntelPacket,
} from "../../src/index.js";

type GoldenVector = {
  name: string;
  input: unknown;
  options: { createdAt: string; disableCompression: boolean };
  expectedCanonicalString: string;
  expectedPacketHash: string;
  expectedSpecVersion: string;
  expectedIpVersion: string;
  expectedReplayCanonical: string;
};

const vectors = JSON.parse(
  readFileSync(new URL("../fixtures/golden/core-golden-vectors.json", import.meta.url), "utf8"),
) as GoldenVector[];

describe("integrity golden vectors", () => {
  it("contains the required locked vector set", () => {
    expect(vectors.map((v) => v.name)).toEqual([
      "flat object with shuffled keys",
      "nested object",
      "repeated structures for dedupe",
      "array order sensitivity",
      "numeric string date normalization case",
    ]);
  });

  for (const vector of vectors) {
    it(`locks deterministic output for ${vector.name}`, () => {
      const packet = createPacket(vector.input, vector.options);
      expect(packet.spec_version).toBe(INTELPACKET_SPEC_VERSION);
      expect(packet.spec_version).toBe(vector.expectedSpecVersion);
      expect(packet.ip_version).toBe(IP_VERSION);
      expect(packet.ip_version).toBe(vector.expectedIpVersion);
      expect(packet.packet_hash).toBe(vector.expectedPacketHash);

      const canonical = canonicalStringify(canonicalize(normalizeTypes(vector.input)));
      expect(canonical).toBe(vector.expectedCanonicalString);

      const replay = replayPacket(packet);
      expect(canonicalStringify(replay.canonical)).toBe(vector.expectedReplayCanonical);
      expect(verifyIntelPacket(packet)).toBe(true);
    });
  }
});
