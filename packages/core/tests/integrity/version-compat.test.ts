import { describe, expect, it } from "vitest";
import { createPacket, replayPacket, verifyIntelPacket, type IntelPacket } from "../../src/index.js";

describe("integrity version compatibility", () => {
  const packet = createPacket({ ok: true }, { createdAt: "2026-01-01T00:00:00.000Z", disableCompression: true });

  it("replays current Spec v1 packets", () => {
    expect(packet.spec_version).toBe("1");
    expect(verifyIntelPacket(packet)).toBe(true);
    expect(replayPacket(packet).normalized).toEqual({ ok: true });
  });

  it("preserves intentional legacy support for omitted spec_version", () => {
    const legacy = { ...packet };
    delete (legacy as Partial<IntelPacket>).spec_version;
    expect(verifyIntelPacket(legacy)).toBe(true);
    expect(replayPacket(legacy).normalized).toEqual({ ok: true });
  });

  it.each([
    ["unsupported spec_version", { spec_version: "99" }],
    ["unsupported ip_version", { ip_version: "99" }],
    ["numeric spec_version", { spec_version: 1 }],
    ["numeric ip_version", { ip_version: 1 }],
    ["empty ip_version", { ip_version: "" }],
  ])("fails for %s", (_name, patch) => {
    const mutated = { ...packet, ...patch } as IntelPacket;
    expect(verifyIntelPacket(mutated)).toBe(false);
    expect(() => replayPacket(mutated)).toThrow();
  });
});
