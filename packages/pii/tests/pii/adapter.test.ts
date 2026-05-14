import { describe, expect, it } from "vitest";
import {
  createPIIPacket,
  IntelPacketPIIError,
  replayPacket,
  verifyIntelPacket,
  verifyPrivacyResult,
} from "../../src/index.js";

const POL = {
  version: "v1" as const,
  mode: "fail-closed" as const,
  redact: ["ssn", "patients[].ssn"],
  allow: ["encounter_id", "patients", "patients[].name", "patients[].ssn"],
};

describe("createPIIPacket adapter", () => {
  it("returns { packet, privacy }", () => {
    const raw = {
      encounter_id: "e1",
      patients: [{ name: "A", ssn: "123-45-6789" }],
    };
    const { packet, privacy } = createPIIPacket(raw, POL, {
      packetOptions: { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" },
    });
    expect(packet.packet_hash.length).toBeGreaterThan(10);
    expect(privacy.policy_version).toBe("v1");
  });

  it("protectPII semantics apply before createPacket (no raw ssn in replay)", () => {
    const raw = {
      encounter_id: "e1",
      patients: [{ name: "A", ssn: "123-45-6789" }],
    };
    const { packet } = createPIIPacket(raw, POL, {
      packetOptions: { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" },
    });
    const replayed = replayPacket(packet, { disableCompression: true });
    expect(JSON.stringify(replayed.expanded).includes("123-45-6789")).toBe(false);
  });

  it("privacy report attached and paths-only", () => {
    const raw = { encounter_id: "e1", patients: [{ name: "A", ssn: "123-45-6789" }] };
    const { privacy } = createPIIPacket(raw, POL, {
      packetOptions: { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" },
    });
    expect(JSON.stringify(privacy).includes("123-45")).toBe(false);
  });

  it("verifyPrivacyResult passes for replayed packet payload", () => {
    const raw = { id: "1", email: "nobody@example.com" };
    const policy = {
      version: "v1" as const,
      mode: "fail-closed" as const,
      mask: ["email"],
      allow: ["id", "email"],
    };
    const { packet, privacy } = createPIIPacket(raw, policy, {
      packetOptions: { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" },
    });
    const st = replayPacket(packet, { disableCompression: true });
    const check = verifyPrivacyResult({ data: st.expanded, report: privacy });
    expect(check.ok).toBe(true);
  });

  it("createPIIPacket respects packetOptions (deterministic createdAt)", () => {
    const raw = { id: "1" };
    const a = createPIIPacket(raw, { version: "v1", allow: ["id"] }, {
      packetOptions: { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" },
    });
    const b = createPIIPacket(raw, { version: "v1", allow: ["id"] }, {
      packetOptions: { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" },
    });
    expect(a.packet.packet_id).toBe(b.packet.packet_id);
  });

  it("tampering fails verifyIntelPacket (core responsibility)", () => {
    const raw = { id: "1" };
    const { packet } = createPIIPacket(raw, { version: "v1", allow: ["id"] }, {
      packetOptions: { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" },
    });
    const corrupt = structuredClone(packet);
    corrupt.packet_hash =
      corrupt.packet_hash === "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        ? "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        : "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(verifyIntelPacket(corrupt)).toBe(false);
  });

  it("missing secrets fail before packet creation when tokenize required", () => {
    expect(() =>
      createPIIPacket(
        { mrn: "M1" },
        { version: "v1", mode: "fail-closed", tokenize: ["mrn"], allow: ["mrn"] },
        { packetOptions: { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" } },
      ),
    ).toThrow(IntelPacketPIIError);
  });

  it("createPIIPacket does not mutate input", () => {
    const raw = { id: "1", email: "e@example.com" };
    const copy = structuredClone(raw);
    createPIIPacket(raw, { version: "v1", mode: "fail-closed", mask: ["email"], allow: ["id", "email"] }, {
      packetOptions: { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" },
    });
    expect(raw).toEqual(copy);
  });
});
