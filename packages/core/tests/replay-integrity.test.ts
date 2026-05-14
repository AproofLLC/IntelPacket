import { describe, expect, it } from "vitest";
import {
  IP_REF_KEY,
  applyDelta,
  canonicalStringify,
  compressPacket,
  createPacket,
  decompressPacket,
  dedupeStructures,
  diffPackets,
  expandRefs,
  replayPacket,
  verifyIntelPacket,
} from "../src/index.js";
import { assertReplayCanonical, expectedReplayCanonical } from "./helpers.js";

function deepBuild(depth: number, acc: Record<string, unknown> = { v: 0 }): unknown {
  if (depth <= 0) return acc;
  return { layer: depth, child: deepBuild(depth - 1, acc) };
}

describe("replay integrity", () => {
  it("replay(packet).canonical === canonical(normalize(raw)) for telemetry-like rows", () => {
    const rows = Array.from({ length: 80 }, (_, i) => ({
      event_type: i % 2 === 0 ? "a" : "b",
      device_id: `d-${i % 8}`,
      temperature: 10 + (i % 5),
      metadata: { host: "h1", region: "r1" },
    }));
    const p = createPacket(rows, { disableCompression: true, createdAt: "FROZEN" });
    expect(verifyIntelPacket(p)).toBe(true);
    assertReplayCanonical(replayPacket(p).canonical, rows);
  });

  it("deep nesting round-trips", () => {
    const input = deepBuild(40) as Record<string, unknown>;
    const p = createPacket(input, { disableCompression: true });
    assertReplayCanonical(replayPacket(p).canonical, input);
  });

  it("large array round-trips", () => {
    const input = Array.from({ length: 500 }, (_, i) => ({ n: i, v: i % 17 }));
    const p = createPacket(input, { disableCompression: true });
    assertReplayCanonical(replayPacket(p).canonical, input);
  });

  it("repeated shared subtree restores via expandRefs + expandSchema", () => {
    const shared = { k: 1, j: 2 };
    const input = { items: [shared, shared, { k: 1, j: 2 }] };
    const p = createPacket(input, { disableCompression: true });
    const state = replayPacket(p);
    assertReplayCanonical(state.canonical, input);
    expect(canonicalStringify(state.expanded)).toBe(
      canonicalStringify(expectedReplayCanonical(input)),
    );
  });

  it("outer refs mirror does not change replay; inner refs are authoritative", () => {
    const input = { x: 1 };
    const p = createPacket(input, { disableCompression: true });
    const honest = replayPacket(p).canonical;
    const p2 = {
      ...p,
      refs: { ...p.refs },
    };
    (p2 as { refs: Record<string, unknown> }).refs["r999"] = { injected: true };
    for (const id of Object.keys(p.refs)) {
      (p2 as { refs: Record<string, unknown> }).refs[id] = { tampered: true };
    }
    expect(verifyIntelPacket(p2)).toBe(true);
    expect(replayPacket(p2).canonical).toEqual(honest);
  });

  it("outer refs cannot replace stripped inner ref table", () => {
    const p = createPacket({ a: [[1], [1]] }, { disableCompression: true });
    expect(Object.keys(p.refs).length).toBeGreaterThan(0);
    const inner = JSON.parse(decompressPacket(p.payload, p.compression)) as Record<
      string,
      unknown
    >;
    const refId = Object.keys(inner.refs as Record<string, unknown>)[0]!;
    const poisoned = {
      ...inner,
      refs: {},
      root: { [IP_REF_KEY]: refId },
    };
    const { base64, metadata } = compressPacket(canonicalStringify(poisoned), {
      disable: true,
    });
    const forged = { ...p, payload: base64, compression: metadata };
    const withOuter = { ...forged, refs: { ...p.refs } };
    expect(() => replayPacket(withOuter, { verifyHash: false })).toThrow(/missing dedupe ref/i);
  });

  it("delta round-trip identity applyDelta(base, diff(base,next)) === canonical(next)", () => {
    const base = { nested: { a: 1, b: 2 }, arr: [1, 2], n: 10 };
    const next = { nested: { a: 2, b: 2 }, arr: [1, 2, 3], n: 12 };
    const d = diffPackets(base, next);
    const rebuilt = applyDelta(base, d);
    expect(canonicalStringify(rebuilt)).toBe(
      canonicalStringify(applyDelta(base, diffPackets(base, next))),
    );
    expect(canonicalStringify(rebuilt)).toBe(canonicalStringify(next));
  });

  it("dedupe ref ordering is stable for nested duplicates", () => {
    const row = { id: 1, v: "x" };
    const input = { a: [row, row], b: { c: [row, row] } };
    const d = dedupeStructures(input);
    expect(d.references.map((r) => r.id)).toEqual(["r0", "r1"]);
    const material = expandRefs(d.value, d.refs);
    expect(JSON.stringify(material).includes("__ip_ref")).toBe(false);
  });
});
