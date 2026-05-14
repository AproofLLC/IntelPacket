import { describe, expect, it } from "vitest";
import {
  INTELPACKET_ERROR_PREFIX,
  IP_REF_KEY,
  MAX_ARRAY_LENGTH,
  MAX_DEPTH,
  MAX_KEYS_PER_OBJECT,
  MAX_STRING_BYTES,
  compressPacket,
  createPacket,
  decompressPacket,
  expandRefs,
} from "../src/index.js";

describe("resource limits and abuse resistance", () => {
  it("rejects very deep nesting", () => {
    let v: Record<string, unknown> = { k: 0 };
    for (let i = 0; i <= MAX_DEPTH; i++) {
      v = { nest: v };
    }
    expect(() => createPacket(v, { disableCompression: true })).toThrow(/max nesting depth/i);
    expect(() => createPacket(v, { disableCompression: true })).toThrow(
      INTELPACKET_ERROR_PREFIX,
    );
  });

  it("rejects arrays over max length", () => {
    const a = new Array(MAX_ARRAY_LENGTH + 1).fill(0);
    expect(() => createPacket(a, { disableCompression: true })).toThrow(/array exceeds max length/i);
  });

  it("rejects oversized strings", () => {
    const s = "x".repeat(MAX_STRING_BYTES + 1);
    expect(() => createPacket({ s }, { disableCompression: true })).toThrow(
      /string exceeds max UTF-8/i,
    );
  });

  it("rejects objects with too many keys", () => {
    const o: Record<string, number> = {};
    for (let i = 0; i < MAX_KEYS_PER_OBJECT + 1; i++) {
      o[`k${i}`] = i;
    }
    expect(() => createPacket(o, { disableCompression: true })).toThrow(/max key count/i);
  });

  it("rejects circular references deterministically", () => {
    const a: Record<string, unknown> = { x: 1 };
    a.self = a;
    expect(() => createPacket(a, { disableCompression: true })).toThrow(/circular structure/i);
  });

  it("treats sparse arrays by length bound", () => {
    const sparse: unknown[] = [];
    sparse[MAX_ARRAY_LENGTH] = 1;
    expect(sparse.length).toBe(MAX_ARRAY_LENGTH + 1);
    expect(() => createPacket(sparse, { disableCompression: true })).toThrow(/array exceeds max length/i);
  });

  it("rejects ref expansion beyond max depth", () => {
    const refs: Record<string, unknown> = { r0: { ok: true } };
    let prevId = "r0";
    for (let i = 1; i <= 502; i++) {
      const id = `r${i}`;
      refs[id] = { [IP_REF_KEY]: prevId };
      prevId = id;
    }
    const root = { [IP_REF_KEY]: prevId };
    expect(() => expandRefs(root, refs)).toThrow(/max ref expansion depth/i);
  });

  it("rejects invalid base64 for decompression deterministically", () => {
    expect(() =>
      decompressPacket("!!!", {
        method: "none",
        raw_bytes: 0,
        compressed_bytes: 0,
        reduction_ratio: 0,
      }),
    ).toThrow(/payload is not valid base64/);
  });

  it("compression path rejects inconsistent none-method byte length", () => {
    const utf8 = '{"a":1}';
    const { base64 } = compressPacket(utf8, { disable: true });
    expect(() =>
      decompressPacket(base64, {
        method: "none",
        raw_bytes: utf8.length + 3,
        compressed_bytes: utf8.length + 3,
        reduction_ratio: 0,
      }),
    ).toThrow(INTELPACKET_ERROR_PREFIX);
  });
});
