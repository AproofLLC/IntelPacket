import { describe, expect, it } from "vitest";
import {
  IP_REF_KEY,
  canonicalStringify,
  compressPacket,
  createPacket,
  decompressPacket,
  replayPacket,
  verifyIntelPacket,
} from "../src/index.js";
import type { IntelPacket } from "../src/types.js";
import { expectedReplayCanonical } from "./helpers.js";

describe("enterprise inner refs authority", () => {
  it("tamper outer refs only: verify may pass; replay matches inner only", () => {
    const input = { k: [{ a: 1 }, { a: 1 }] };
    const p = createPacket(input, { disableCompression: true });
    expect(Object.keys(p.refs).length).toBeGreaterThan(0);
    const honest = replayPacket(p).canonical;
    const forged: IntelPacket = {
      ...p,
      refs: { ...p.refs, r999: { evil: true } },
    };
    for (const id of Object.keys(p.refs)) {
      (forged as { refs: Record<string, unknown> }).refs[id] = { replaced: true };
    }
    expect(verifyIntelPacket(forged)).toBe(true);
    expect(replayPacket(forged).canonical).toEqual(honest);
  });

  it("inner compressed refs tamper fails verify and replay with verifyHash", () => {
    const input = { k: [[1], [1]] };
    const p = createPacket(input, { disableCompression: true });
    const inner = JSON.parse(decompressPacket(p.payload, p.compression)) as Record<
      string,
      unknown
    >;
    const rid = Object.keys(inner.refs as object)[0]!;
    (inner.refs as Record<string, unknown>)[rid] = { not: "original" };
    const { base64, metadata } = compressPacket(canonicalStringify(inner), { disable: true });
    const forged: IntelPacket = { ...p, payload: base64, compression: metadata };
    expect(verifyIntelPacket(forged)).toBe(false);
    expect(() => replayPacket(forged)).toThrow(/hash verification failed/i);
  });

  it("outer refs do not override missing inner refs", () => {
    const p = createPacket({ a: [[9], [9]] }, { disableCompression: true });
    const inner = JSON.parse(decompressPacket(p.payload, p.compression)) as Record<
      string,
      unknown
    >;
    const rid = Object.keys(inner.refs as object)[0]!;
    const poisoned = {
      ...inner,
      refs: {},
      root: { [IP_REF_KEY]: rid },
    };
    const { base64, metadata } = compressPacket(canonicalStringify(poisoned), { disable: true });
    const forged = { ...p, payload: base64, compression: metadata };
    const withOuter = { ...forged, refs: { ...p.refs } };
    expect(() => replayPacket(withOuter, { verifyHash: false })).toThrow(/missing dedupe ref/i);
  });

  it("outer refs cannot change replay result when inner is honest", () => {
    const input = { a: [1, 1] };
    const p = createPacket(input, { disableCompression: true });
    const baseline = canonicalStringify(replayPacket(p).canonical);
    const alt: IntelPacket = {
      ...p,
      refs: { r0: { fabricate: true } },
    };
    expect(verifyIntelPacket(alt)).toBe(true);
    expect(canonicalStringify(replayPacket(alt).canonical)).toBe(baseline);
  });

  it("with base, replay still yields full next state and delta metadata is present", () => {
    const base = { n: 1, k: "keep" };
    const next = { n: 2, k: "keep" };
    const p = createPacket(next, { base, disableCompression: true });
    expect(p.delta).not.toBeNull();
    const st = replayPacket(p);
    expect(canonicalStringify(st.canonical)).toBe(
      canonicalStringify(expectedReplayCanonical(next)),
    );
  });
});
