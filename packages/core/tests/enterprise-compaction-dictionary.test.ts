import { describe, expect, it } from "vitest";
import {
  compactSchema,
  createPacket,
  expandSchema,
  replayPacket,
  validateCompactionMerge,
} from "../src/index.js";

describe("enterprise compaction dictionary validation", () => {
  it("rejects duplicate compact aliases in custom dictionary", () => {
    expect(() =>
      validateCompactionMerge({
        foo: "z",
        bar: "z",
      }),
    ).toThrow(/duplicate compact alias/i);
  });

  it("rejects dangerous and reserved tokens", () => {
    expect(() =>
      validateCompactionMerge({
        good: "__ip_ref",
      }),
    ).toThrow(/reserved IntelPacket token/i);
    expect(() =>
      validateCompactionMerge({
        __ip_ref: "x",
      }),
    ).toThrow(/reserved IntelPacket token/i);
    expect(() =>
      validateCompactionMerge({
        a: "__intelpacket__:x",
      }),
    ).toThrow(/reserved IntelPacket token/i);
  });

  it("rejects compact alias that equals another verbose key", () => {
    expect(() =>
      validateCompactionMerge({
        a: "y",
        y: "z",
      }),
    ).toThrow(/ambiguous expansion/);
  });

  it("rejects duplicate compact targets", () => {
    expect(() =>
      validateCompactionMerge({
        event_status: "x",
        queue_name: "x",
      }),
    ).toThrow(/duplicate compact alias/i);
  });

  it("safe custom dictionary round-trips via createPacket and replay", () => {
    const dict = { payment_id: "pid" };
    validateCompactionMerge(dict);
    const input = { payment_id: "p-99", other: 1 };
    const p = createPacket(input, {
      disableCompression: true,
      metadata: { compaction_dictionary: dict },
    });
    const st = replayPacket(p);
    expect(st.expanded).toEqual({ payment_id: "p-99", other: 1 });
  });

  it("compactSchema throws on invalid merged dictionary", () => {
    expect(() =>
      compactSchema({ x: 1 }, { dictionary: { a: "z", b: "z" } }),
    ).toThrow(/duplicate compact alias/i);
  });

  it("expandSchema rejects ambiguous dictionary same as compact", () => {
    expect(() =>
      expandSchema({ z: 1 }, { dictionary: { u: "z", v: "z" } }),
    ).toThrow(/duplicate compact alias/i);
  });
});
