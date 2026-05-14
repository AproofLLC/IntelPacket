import { describe, expect, it } from "vitest";
import { createPacket, replayPacket, verifyIntelPacket } from "../../src/index.js";

describe("integrity concurrency", () => {
  const datasets = Array.from({ length: 10 }, (_, i) => ({
    id: `record-${i % 3}`,
    metrics: Array.from({ length: 8 }, (_v, j) => ({ name: `m-${j}`, value: i * j })),
    nested: { parity: i % 2 === 0, tags: [`t${i % 4}`, `t${jSafe(i)}`] },
  }));
  const options = { createdAt: "2026-01-01T00:00:00.000Z", disableCompression: true };

  function jSafe(i: number): number {
    return (i * 7) % 5;
  }

  it("runs create, verify, and replay concurrently without shared-state drift", async () => {
    const packets = await Promise.all(
      Array.from({ length: 500 }, async (_v, i) => createPacket(datasets[i % datasets.length], options)),
    );

    const repeated = packets.filter((_p, i) => i % datasets.length === 0).map((p) => p.packet_hash);
    expect(new Set(repeated).size).toBe(1);

    const verifies = await Promise.all(packets.map(async (p) => verifyIntelPacket(p)));
    expect(verifies.every(Boolean)).toBe(true);

    const replays = await Promise.all(packets.map(async (p) => replayPacket(p)));
    expect(replays).toHaveLength(500);
    expect(replays.every((r) => r.normalized !== undefined)).toBe(true);
  });
});
