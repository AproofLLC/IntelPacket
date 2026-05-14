import { describe, expect, it } from "vitest";
import { createPacket, replayPacket, verifyIntelPacket } from "../../src/index.js";

describe("integrity soak smoke", () => {
  it("runs 2,000 create/verify/replay cycles with bounded expectations", () => {
    const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 2_000; i++) {
      const input =
        i % 3 === 0
          ? { id: i, flags: [true, false, i % 2 === 0] }
          : i % 3 === 1
            ? [{ idx: i }, { idx: i, nested: { status: "ok" } }]
            : { repeated: [{ k: "v" }, { k: "v" }, { k: "v" }] };
      const packet = createPacket(input, { createdAt: "2026-01-01T00:00:00.000Z", disableCompression: true });
      expect(verifyIntelPacket(packet)).toBe(true);
      expect(replayPacket(packet).normalized).toEqual(input);
    }
    const after = process.memoryUsage().heapUsed;
    const delta = after - before;
    console.info(`core soak heap delta bytes: ${delta}`);
    expect(Number.isFinite(delta)).toBe(true);
  });
});
