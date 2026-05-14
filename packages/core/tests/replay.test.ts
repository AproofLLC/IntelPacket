import { describe, expect, it } from "vitest";
import {
  canonicalize,
  canonicalStringify,
  createPacket,
  replayPacket,
  verifyIntelPacket,
} from "../src/index.js";

describe("replayPacket", () => {
  it("reconstructs verbose expanded trees from compact + refs", () => {
    const input = {
      timestamp: "2026-01-01T00:00:00.000Z",
      user_id: "u1",
      nested: { b: 1, a: true },
    };
    const p = createPacket(input, {
      createdAt: "2026-05-13T00:00:00.000Z",
      disableCompression: true,
    });
    expect(verifyIntelPacket(p)).toBe(true);
    const state = replayPacket(p);
    expect(state.expanded).toEqual(
      canonicalize({
        timestamp: "2026-01-01T00:00:00.000Z",
        user_id: "u1",
        nested: { a: true, b: 1 },
      }),
    );
    expect(canonicalStringify(state.canonical)).toBe(
      canonicalStringify(state.expanded),
    );
  });
});
