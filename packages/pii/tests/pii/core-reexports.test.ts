import { describe, expect, it } from "vitest";
import {
  canonicalize,
  createPacket,
  createPIIPacket,
  normalizeTypes,
  replayPacket,
  verifyIntelPacket,
} from "../../src/index.js";

describe("@intelpacket/pii barrel vs @intelpacket/core", () => {
  it("re-exports core packet pipeline (smoke)", () => {
    const input = { a: 1, z: 2 };
    const packet = createPacket(input, {
      disableCompression: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(verifyIntelPacket(packet)).toBe(true);
    const st = replayPacket(packet, { disableCompression: true });
    expect(st.canonical).toEqual(canonicalize(normalizeTypes(input)));
  });

  it("createPIIPacket still builds a verified core packet", () => {
    const { packet } = createPIIPacket(
      { id: "x", email: "a@b.c" },
      {
        version: "v1",
        mode: "fail-closed",
        mask: ["email"],
        allow: ["id", "email"],
      },
      {
        packetOptions: {
          disableCompression: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      },
    );
    expect(verifyIntelPacket(packet)).toBe(true);
  });
});
