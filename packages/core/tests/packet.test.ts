import { describe, expect, it } from "vitest";
import { createPacket, verifyIntelPacket } from "../src/index.js";

describe("createPacket", () => {
  it("uses packet_id as hash prefix", () => {
    const p = createPacket({ x: 1 }, { disableCompression: true });
    expect(p.packet_id).toBe(p.packet_hash.slice(0, 16));
    expect(verifyIntelPacket(p)).toBe(true);
  });

  it("is deterministic across key orderings (same hash)", () => {
    const opts = { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" };
    const p1 = createPacket(
      { m: 1, z: 2, nested: { b: 1, a: 2 } },
      opts,
    );
    const p2 = createPacket(
      { z: 2, m: 1, nested: { a: 2, b: 1 } },
      opts,
    );
    expect(p1.packet_hash).toBe(p2.packet_hash);
  });

  it("records delta when base is provided", () => {
    const p = createPacket(
      { cpu: 51 },
      { base: { cpu: 50 }, disableCompression: true },
    );
    expect(p.delta).not.toBeNull();
    expect(verifyIntelPacket(p)).toBe(true);
  });
});
