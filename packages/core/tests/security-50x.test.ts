import { describe, expect, it } from "vitest";
import {
  INTELPACKET_ERROR_PREFIX,
  IP_REF_KEY,
  MAX_ARRAY_LENGTH,
  MAX_DEPTH,
  MAX_STRING_BYTES,
  applyDelta,
  canonicalStringify,
  compressPacket,
  createPacket,
  decompressPacket,
  expandRefs,
  normalizeTypes,
  replayPacket,
  verifyIntelPacket,
} from "../src/index.js";
import type { IntelPacket } from "../src/types.js";

const ROUNDS = 50;

function protoClean(): void {
  expect(
    Object.prototype.hasOwnProperty.call(Object.prototype, "__intelpacket_sec50__"),
  ).toBe(false);
}

describe("security 50×", () => {
  it("prototype pollution own keys fail closed", () => {
    for (let i = 0; i < ROUNDS; i++) {
      for (const key of ["__proto__", "constructor", "prototype"] as const) {
        const o = Object.create(null) as Record<string, unknown>;
        o[key] = { x: i };
        expect(() => normalizeTypes(o)).toThrow(/unsafe object key/i);
      }
    }
    protoClean();
  });

  it("tampered packet_hash rejected by verifyIntelPacket", () => {
    const p = createPacket({ v: 1 }, { disableCompression: true });
    for (let i = 0; i < ROUNDS; i++) {
      const forged = {
        ...p,
        packet_hash: "b".repeat(64) as IntelPacket["packet_hash"],
        packet_id: "b".repeat(16) as IntelPacket["packet_id"],
      };
      expect(verifyIntelPacket(forged)).toBe(false);
    }
    protoClean();
  });

  it("tampered payload fails replay deterministically", () => {
    const p = createPacket({ a: 1 }, { disableCompression: true });
    const forged: IntelPacket = { ...p, payload: "!" };
    for (let i = 0; i < ROUNDS; i++) {
      void i;
      expect(() => replayPacket(forged)).toThrow(INTELPACKET_ERROR_PREFIX);
    }
    protoClean();
  });

  it("tampered outer refs does not bypass hash", () => {
    const p = createPacket({ x: 1 }, { disableCompression: true });
    const forged = {
      ...p,
      refs: { ...p.refs, r999: { bad: true } },
    } as IntelPacket;
    for (let i = 0; i < ROUNDS; i++) {
      void i;
      expect(verifyIntelPacket(forged)).toBe(true);
      expect(replayPacket(forged).canonical).toEqual(replayPacket(p).canonical);
    }
    protoClean();
  });

  it("corrupted compressed buffer fails decompress", () => {
    const p = createPacket({ z: 1 }, { disableCompression: false });
    const buf = Buffer.from(p.payload, "base64");
    buf[0] ^= 0xff;
    const badPayload = buf.toString("base64");
    const forged: IntelPacket = { ...p, payload: badPayload };
    for (let i = 0; i < ROUNDS; i++) {
      void i;
      expect(() => decompressPacket(forged.payload, forged.compression)).toThrow(
        INTELPACKET_ERROR_PREFIX,
      );
    }
    protoClean();
  });

  it("invalid base64 rejected", () => {
    for (let i = 0; i < ROUNDS; i++) {
      void i;
      expect(() =>
        decompressPacket("@@@", {
          method: "none",
          raw_bytes: 0,
          compressed_bytes: 0,
          reduction_ratio: 0,
        }),
      ).toThrow(/payload is not valid base64|invalid base64/i);
    }
    protoClean();
  });

  it("cyclic dedupe ref throws", () => {
    for (let i = 0; i < ROUNDS; i++) {
      const id = `r${i % 7}`;
      const refs: Record<string, unknown> = {
        [id]: { [IP_REF_KEY]: id, tag: i },
      };
      expect(() => expandRefs({ [IP_REF_KEY]: id }, refs)).toThrow(/cyclic dedupe ref/i);
    }
    protoClean();
  });

  it("missing ref throws", () => {
    for (let i = 0; i < ROUNDS; i++) {
      void i;
      expect(() => expandRefs({ [IP_REF_KEY]: "r0" }, {})).toThrow(/missing dedupe ref/i);
    }
    protoClean();
  });

  it("oversized strings rejected", () => {
    for (let i = 0; i < ROUNDS; i++) {
      void i;
      const s = "p".repeat(MAX_STRING_BYTES + 1);
      expect(() => createPacket({ s }, { disableCompression: true })).toThrow(
        /string exceeds max UTF-8/i,
      );
    }
    protoClean();
  });

  it("deep nesting rejected", () => {
    for (let i = 0; i < ROUNDS; i++) {
      let v: Record<string, unknown> = { k: i };
      for (let d = 0; d <= MAX_DEPTH; d++) {
        v = { nest: v };
      }
      expect(() => createPacket(v, { disableCompression: true })).toThrow(/max nesting depth/i);
    }
    protoClean();
  });

  it("huge arrays rejected", () => {
    for (let i = 0; i < ROUNDS; i++) {
      void i;
      const a = new Array(MAX_ARRAY_LENGTH + 1).fill(0);
      expect(() => createPacket(a, { disableCompression: true })).toThrow(/array exceeds max length/i);
    }
    protoClean();
  });

  it("circular structures rejected", () => {
    for (let i = 0; i < ROUNDS; i++) {
      const a: Record<string, unknown> = { i };
      a.self = a;
      expect(() => createPacket(a, { disableCompression: true })).toThrow(/circular structure/i);
    }
    protoClean();
  });

  it("unsupported values rejected at normalize", () => {
    for (let i = 0; i < ROUNDS; i++) {
      void i;
      expect(() => normalizeTypes(() => i)).toThrow(/unsupported value type/i);
      expect(() => normalizeTypes(Symbol("s"))).toThrow(/unsupported value type/i);
    }
    protoClean();
  });

  it("malicious delta keys rejected", () => {
    for (let i = 0; i < ROUNDS; i++) {
      const poison = Object.create(null) as Record<string, unknown>;
      poison.constructor = { n: i };
      expect(() => applyDelta({ x: 1 }, poison)).toThrow(/unsafe object key/i);
    }
    protoClean();
  });

  it("decompress refuses inconsistent none-method size", () => {
    const utf8 = `{"ok":${ROUNDS}}`;
    const { base64 } = compressPacket(utf8, { disable: true });
    for (let i = 0; i < ROUNDS; i++) {
      void i;
      expect(() =>
        decompressPacket(base64, {
          method: "none",
          raw_bytes: utf8.length + 4,
          compressed_bytes: utf8.length + 4,
          reduction_ratio: 0,
        }),
      ).toThrow(INTELPACKET_ERROR_PREFIX);
    }
    protoClean();
  });

  it("tampered replay still fails when verifyHash true (50×)", () => {
    const p = createPacket({ gate: 1 }, { disableCompression: true });
    const inner = JSON.parse(decompressPacket(p.payload, p.compression)) as Record<
      string,
      unknown
    >;
    inner.root = { gate: 2 };
    const { base64, metadata } = compressPacket(canonicalStringify(inner), { disable: true });
    const forged: IntelPacket = { ...p, payload: base64, compression: metadata };
    for (let i = 0; i < ROUNDS; i++) {
      void i;
      expect(() => replayPacket(forged)).toThrow(/hash verification failed/i);
    }
    protoClean();
  });
});
