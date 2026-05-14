import { describe, expect, it } from "vitest";
import {
  canonicalStringify,
  compressPacket,
  createPacket,
  decompressPacket,
  hashPacket,
  IP_REF_KEY,
  replayPacket,
  verifyIntelPacket,
  type IntelPacket,
} from "../../src/index.js";

function expectCorruptionRejected(packet: IntelPacket): void {
  const verified = verifyIntelPacket(packet);
  let replayed = true;
  try {
    replayPacket(packet);
  } catch {
    replayed = false;
  }
  expect(verified && replayed).toBe(false);
}

function withInner(packet: IntelPacket, mutate: (inner: Record<string, unknown>) => void): IntelPacket {
  const inner = JSON.parse(decompressPacket(packet.payload, packet.compression)) as Record<string, unknown>;
  mutate(inner);
  const compressed = compressPacket(canonicalStringify(inner), { disable: true });
  return { ...packet, payload: compressed.base64, compression: compressed.metadata };
}

describe("integrity tamper matrix", () => {
  const input = {
    rows: [
      { id: 1, status: "active", metadata: { region: "test" } },
      { id: 1, status: "active", metadata: { region: "test" } },
    ],
  };
  const packet = createPacket(input, { createdAt: "2026-01-01T00:00:00.000Z", disableCompression: true });

  it.each([
    ["payload changed", () => ({ ...packet, payload: packet.payload.slice(0, -4) + "AAAA" })],
    ["payload truncated", () => ({ ...packet, payload: packet.payload.slice(0, 8) })],
    ["packet_hash changed", () => ({ ...packet, packet_hash: `0${packet.packet_hash.slice(1)}` })],
    ["spec_version changed to unsupported", () => ({ ...packet, spec_version: "99" as "1" })],
    ["ip_version changed to unsupported", () => ({ ...packet, ip_version: "99" })],
    ["compression method changed", () => ({ ...packet, compression: { ...packet.compression, method: "zlib" as const } })],
    ["compression raw bytes changed", () => ({ ...packet, compression: { ...packet.compression, raw_bytes: packet.compression.raw_bytes + 1 } })],
    [
      "compression compressed bytes changed",
      () => ({ ...packet, compression: { ...packet.compression, compressed_bytes: packet.compression.compressed_bytes + 1 } }),
    ],
    ["inner refs table changed", () => withInner(packet, (inner) => { inner.refs = { injected: { ok: false } }; })],
    ["ref target changed out of range", () => withInner(packet, (inner) => { inner.root = { [IP_REF_KEY]: "r9999" }; })],
    ["delta metadata mutated", () => withInner(packet, (inner) => { inner.delta = { changed: true }; })],
  ])("rejects %s", (_name, mutate) => {
    expectCorruptionRejected(mutate() as IntelPacket);
  });

  it("rejects a payload mutation even when packet_hash is recomputed by an attacker-shaped shell", () => {
    const forged = withInner(packet, (inner) => {
      inner.root = { forged: true };
    });
    const inner = JSON.parse(decompressPacket(forged.payload, forged.compression)) as Record<string, unknown>;
    const packet_hash = hashPacket(inner);
    const rehashed = { ...forged, packet_hash, packet_id: packet_hash.slice(0, 16) };
    expect(replayPacket(rehashed).canonical).toEqual({ forged: true });
    expect(verifyIntelPacket(rehashed)).toBe(true);
    expect(rehashed.packet_hash).not.toBe(packet.packet_hash);
  });

  it("documents outer refs mirror as intentionally outside the hash", () => {
    const changed = { ...packet, refs: { r0: { forged: true } } };
    expect(verifyIntelPacket(changed)).toBe(true);
    expect(replayPacket(changed).canonical).toEqual(replayPacket(packet).canonical);
  });

  it("documents created_at and metadata as provenance fields outside the hash", () => {
    const changed = {
      ...packet,
      created_at: "2099-01-01T00:00:00.000Z",
      metadata: { title: "tampered display metadata" },
    };
    expect(changed.packet_hash).toBe(packet.packet_hash);
    expect(verifyIntelPacket(changed)).toBe(true);
    expect(replayPacket(changed).canonical).toEqual(replayPacket(packet).canonical);
  });
});
