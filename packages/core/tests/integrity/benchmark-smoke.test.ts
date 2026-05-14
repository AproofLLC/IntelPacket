import { describe, expect, it } from "vitest";
import { createPacket, replayPacket, verifyIntelPacket } from "../../src/index.js";

describe("integrity benchmark smoke gate", () => {
  it("runs a tiny deterministic create/replay/verify benchmark sample", () => {
    const records = Array.from({ length: 100 }, (_, i) => ({
      event_type: i % 2 === 0 ? "metric" : "audit",
      user_id: `user-${i % 10}`,
      amount: i * 1.25,
      metadata: { region: `r${i % 3}`, flags: [i % 2 === 0, i % 5 === 0] },
    }));
    const options = { createdAt: "2026-01-01T00:00:00.000Z", disableCompression: true };
    const hashes: string[] = [];
    let replaySuccess = true;
    let verifySuccess = true;

    for (let i = 0; i < 3; i++) {
      const packet = createPacket(records, options);
      hashes.push(packet.packet_hash);
      verifySuccess = verifySuccess && verifyIntelPacket(packet);
      const replay = replayPacket(packet);
      replaySuccess = replaySuccess && createPacket(replay.normalized, options).packet_hash === packet.packet_hash;
    }

    expect(new Set(hashes).size).toBe(1);
    expect(replaySuccess).toBe(true);
    expect(verifySuccess).toBe(true);
  });
});
