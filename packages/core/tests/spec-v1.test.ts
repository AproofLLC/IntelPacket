import { describe, expect, it } from "vitest";
import {
  assertSupportedIntelPacketVersion,
  canonicalize,
  createPacket,
  dedupeStructures,
  expandRefs,
  hashPacket,
  intelPacketSchema,
  normalizeTypes,
  replayPacket,
  verifyIntelPacket,
} from "../src/index.js";
import { INTELPACKET_SPEC_VERSION } from "../src/constants.js";
import type { IntelPacket } from "../src/types.js";

describe("IntelPacket Spec v1", () => {
  it("created packet includes spec_version and ip_version", () => {
    const p = createPacket({ a: 1 }, { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" });
    expect(p.ip_version).toBe("1");
    expect(p.spec_version).toBe(INTELPACKET_SPEC_VERSION);
  });

  it("same logical object with different key order produces same packet_hash", () => {
    const a = createPacket({ z: 1, a: 2 }, { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" });
    const b = createPacket({ a: 2, z: 1 }, { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" });
    expect(a.packet_hash).toBe(b.packet_hash);
    expect(a.packet_id).toBe(b.packet_id);
  });

  it("array order changes produce different packet_hash", () => {
    const a = createPacket({ k: [1, 2] }, { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" });
    const b = createPacket({ k: [2, 1] }, { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" });
    expect(a.packet_hash).not.toBe(b.packet_hash);
  });

  it("replay restores canonical logical value", () => {
    const input = { b: 2, a: 1 };
    const p = createPacket(input, { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" });
    const st = replayPacket(p);
    expect(st.canonical).toEqual(canonicalize(normalizeTypes(input)));
  });

  it("tampered compressed payload fails verification and replay", () => {
    const p = createPacket({ x: 1 }, { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" });
    const forged: IntelPacket = { ...p, payload: "!" };
    expect(verifyIntelPacket(forged)).toBe(false);
    expect(() => replayPacket(forged)).toThrow();
  });

  it("tampered hash fails verification and replay", () => {
    const p = createPacket({ x: 1 }, { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" });
    const forged: IntelPacket = {
      ...p,
      packet_hash: "0".repeat(64) as IntelPacket["packet_hash"],
      packet_id: "0".repeat(16) as IntelPacket["packet_id"],
    };
    expect(verifyIntelPacket(forged)).toBe(false);
    expect(() => replayPacket(forged)).toThrow(/hash verification failed/i);
  });

  it("unsupported ip_version is rejected on replay", () => {
    const p = createPacket({ x: 1 }, { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" });
    const forged = { ...p, ip_version: "2" } as IntelPacket;
    expect(() => replayPacket(forged)).toThrow();
  });

  it("unsafe prototype pollution keys are rejected on create", () => {
    expect(() => createPacket(JSON.parse('{"__proto__":{"x":1}}'))).toThrow();
  });

  it("circular input is rejected", () => {
    const o: Record<string, unknown> = { a: 1 };
    o.self = o;
    expect(() => createPacket(o)).toThrow();
  });

  it("compression metadata is present and internally consistent", () => {
    const p = createPacket({ n: 1 }, { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" });
    expect(p.compression.method).toBe("none");
    expect(p.compression.raw_bytes).toBe(p.compression.compressed_bytes);
    expect(p.compression.reduction_ratio).toBe(0);
  });

  it("dedupe refs replay correctly for repeated objects", () => {
    const input = { k: [{ a: 1 }, { a: 1 }] };
    const p = createPacket(input, { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" });
    expect(Object.keys(p.refs).length).toBeGreaterThan(0);
    const st = replayPacket(p);
    expect(st.canonical).toEqual(canonicalize(normalizeTypes(input)));
  });

  it("malformed dedupe refs fail replay", () => {
    expect(() => expandRefs({ __ip_ref: "r0" }, {})).toThrow(/missing dedupe ref/i);
  });

  it("delta metadata, if present, is deterministic for same base/next", () => {
    const base = { n: 1 };
    const next = { n: 2 };
    const a = createPacket(next, { base, disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" });
    const b = createPacket(next, { base, disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" });
    expect(JSON.stringify(a.delta)).toBe(JSON.stringify(b.delta));
  });

  it("created packet validates against intelPacketSchema", () => {
    const p = createPacket({ z: 9 }, { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" });
    expect(() => intelPacketSchema.parse(p)).not.toThrow();
  });

  it("assertSupportedIntelPacketVersion accepts valid packet", () => {
    const p = createPacket({}, { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" });
    expect(() => assertSupportedIntelPacketVersion(p)).not.toThrow();
  });

  it("assertSupportedIntelPacketVersion rejects malformed packet", () => {
    expect(() => assertSupportedIntelPacketVersion({})).toThrow(/unsupported or malformed/i);
  });

  it("assertSupportedIntelPacketVersion rejects wrong spec_version when present", () => {
    const p = createPacket({ a: 1 }, { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" });
    const bad = { ...p, spec_version: "99" as unknown as "1" };
    expect(() => assertSupportedIntelPacketVersion(bad)).toThrow(/unsupported or malformed/i);
  });

  it("dedupeStructures fingerprint is stable for identical subtrees", () => {
    const input = canonicalize({ k: [{ x: 1 }, { x: 1 }] });
    const d1 = dedupeStructures(input);
    const d2 = dedupeStructures(input);
    expect(JSON.stringify(d1)).toBe(JSON.stringify(d2));
  });

  it("hashPacket is deterministic for same canonical body", () => {
    const body = canonicalize({ a: 1 });
    expect(hashPacket(body)).toBe(hashPacket(body));
  });
});
