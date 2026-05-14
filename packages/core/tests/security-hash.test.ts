import { describe, expect, it } from "vitest";
import {
  canonicalStringify,
  compressPacket,
  createPacket,
  decompressPacket,
  hashPacket,
  intelPacketSchema,
  replayPacket,
  verifyIntelPacket,
} from "../src/index.js";
import type { IntelPacket } from "../src/types.js";

describe("hash tampering and verification", () => {
  it("tampered inner envelope UTF-8 fails verifyIntelPacket", () => {
    const p = createPacket({ n: 1 }, { disableCompression: true, createdAt: "t0" });
    const inner = JSON.parse(decompressPacket(p.payload, p.compression)) as Record<
      string,
      unknown
    >;
    inner.root = { n: 2 };
    const { base64, metadata } = compressPacket(canonicalStringify(inner), {
      disable: true,
    });
    const forged: IntelPacket = { ...p, payload: base64, compression: metadata };
    expect(verifyIntelPacket(forged)).toBe(false);
  });

  it("tampered inner refs fail verifyIntelPacket", () => {
    const shared = { k: 1 };
    const p = createPacket({ a: shared, b: shared }, { disableCompression: true });
    expect(verifyIntelPacket(p)).toBe(true);
    const inner = JSON.parse(decompressPacket(p.payload, p.compression)) as Record<
      string,
      unknown
    >;
    inner.refs = { r0: { k: 999 } };
    const { base64, metadata } = compressPacket(canonicalStringify(inner), {
      disable: true,
    });
    const forged: IntelPacket = { ...p, payload: base64, compression: metadata };
    expect(verifyIntelPacket(forged)).toBe(false);
  });

  it("tampered inner delta fails verifyIntelPacket when delta non-null", () => {
    const base = { x: 1 };
    const next = { x: 2 };
    const p = createPacket(next, {
      base,
      disableCompression: true,
      createdAt: "d0",
    });
    expect(p.delta).not.toBeNull();
    expect(verifyIntelPacket(p)).toBe(true);
    const inner = JSON.parse(decompressPacket(p.payload, p.compression)) as Record<
      string,
      unknown
    >;
    inner.delta = null;
    const { base64, metadata } = compressPacket(canonicalStringify(inner), {
      disable: true,
    });
    const forged: IntelPacket = { ...p, payload: base64, compression: metadata };
    expect(verifyIntelPacket(forged)).toBe(false);
  });

  it("tampered compression byte counts fail closed (verifyIntelPacket)", () => {
    const p = createPacket({ ok: true }, { disableCompression: true });
    const forged: IntelPacket = {
      ...p,
      compression: {
        ...p.compression,
        raw_bytes: p.compression.raw_bytes + 7,
        compressed_bytes: p.compression.compressed_bytes + 7,
      },
    };
    expect(intelPacketSchema.safeParse(forged).success).toBe(true);
    expect(verifyIntelPacket(forged)).toBe(false);
  });

  it("outer packet_hash tampering fails verifyIntelPacket", () => {
    const p = createPacket({ v: 1 }, { disableCompression: true });
    const forged: IntelPacket = {
      ...p,
      packet_hash: "a".repeat(64),
      packet_id: "a".repeat(16),
    };
    expect(intelPacketSchema.safeParse(forged).success).toBe(true);
    expect(verifyIntelPacket(forged)).toBe(false);
  });

  it("created_at changes do not affect packet_hash for same payload", () => {
    const input = { k: "stable" };
    const a = createPacket(input, {
      disableCompression: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const b = createPacket(input, {
      disableCompression: true,
      createdAt: "2099-12-31T23:59:59.999Z",
    });
    expect(a.packet_hash).toBe(b.packet_hash);
    expect(a.packet_id).toBe(b.packet_id);
  });

  it("packet metadata omits legacy non_hashed_fields (strict shape)", () => {
    const p = createPacket({ n: 1 }, { disableCompression: true });
    expect(Object.keys(p.metadata)).not.toContain("non_hashed_fields");
    expect(canonicalStringify(p.metadata)).not.toContain("non_hashed_fields");
  });

  it("packet_id must equal first 16 hex chars of packet_hash", () => {
    const p = createPacket({ z: 1 }, { disableCompression: true });
    expect(p.packet_id).toBe(p.packet_hash.slice(0, 16));
    const badId: IntelPacket = { ...p, packet_id: "f".repeat(16) };
    expect(intelPacketSchema.safeParse(badId).success).toBe(false);
  });

  it("verifyIntelPacket returns false for malformed packet_hash format", () => {
    const p = createPacket({ q: 1 }, { disableCompression: true });
    const forged = {
      ...p,
      packet_hash: `${"c".repeat(63)}X` as IntelPacket["packet_hash"],
    };
    expect(verifyIntelPacket(forged as IntelPacket)).toBe(false);
  });

  it("replayPacket fails closed on hash mismatch by default", () => {
    const p = createPacket({ n: 3 }, { disableCompression: true });
    const inner = JSON.parse(decompressPacket(p.payload, p.compression)) as Record<
      string,
      unknown
    >;
    inner.root = { n: 4 };
    const { base64, metadata } = compressPacket(canonicalStringify(inner), {
      disable: true,
    });
    const forged: IntelPacket = {
      ...p,
      payload: base64,
      compression: metadata,
    };
    expect(() => replayPacket(forged)).toThrow(/hash verification failed/i);
  });

  it("replayPacket may skip hash verification when explicitly opted out", () => {
    const p = createPacket({ n: 3 }, { disableCompression: true });
    const inner = JSON.parse(decompressPacket(p.payload, p.compression)) as Record<
      string,
      unknown
    >;
    inner.root = { n: 9 };
    const { base64, metadata } = compressPacket(canonicalStringify(inner), {
      disable: true,
    });
    const forged: IntelPacket = {
      ...p,
      payload: base64,
      compression: metadata,
    };
    expect(() => replayPacket(forged, { verifyHash: false })).not.toThrow();
  });

  it("inner hash matches hashPacket of canonical hashing body", () => {
    const p = createPacket({ a: [1, { b: 2 }] }, { disableCompression: true });
    const inner = JSON.parse(decompressPacket(p.payload, p.compression)) as {
      ip_version: string;
      encoding: string;
      root: unknown;
      refs: Record<string, unknown>;
      delta: unknown;
    };
    const body = {
      ip_version: inner.ip_version,
      encoding: inner.encoding,
      root: inner.root,
      refs: inner.refs,
      delta: inner.delta,
    };
    expect(hashPacket(body)).toBe(p.packet_hash);
  });
});
