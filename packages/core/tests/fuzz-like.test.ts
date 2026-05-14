import { describe, expect, it } from "vitest";
import { createPacket, replayPacket, verifyIntelPacket } from "../src/index.js";
import { assertReplayCanonical } from "./helpers.js";
import { genRandJson, mulberry32 } from "./prng.js";

function fuzzIterations(): number {
  return process.env.INTELPACKET_DEEP_FUZZ === "1" ? 5000 : 500;
}

describe("deterministic fuzz-like JSON generation", () => {
  it("many seeded random structures round-trip without crash", () => {
    const iterations = fuzzIterations();
    for (let seed = 0; seed < iterations; seed++) {
      const rnd = mulberry32(seed);
      const input = genRandJson(rnd, 7);
      const p = createPacket(input, {
        disableCompression: true,
        createdAt: `f-${seed}`,
      });
      expect(verifyIntelPacket(p)).toBe(true);
      const p2 = createPacket(input, {
        disableCompression: true,
        createdAt: `f-${seed}`,
      });
      expect(p2.packet_hash).toBe(p.packet_hash);
      assertReplayCanonical(replayPacket(p).canonical, input);
    }
  });

  it("injected unsafe keys fail closed", () => {
    const rnd = mulberry32(4242);
    const input = genRandJson(rnd, 4) as Record<string, unknown>;
    const bad = Object.create(null) as Record<string, unknown>;
    for (const k of Object.keys(input)) {
      bad[k] = input[k];
    }
    bad["__proto__"] = { injected: true };
    expect(() => createPacket(bad, { disableCompression: true })).toThrow(/unsafe object key/i);
  });
});
