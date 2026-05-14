import { describe, expect, it } from "vitest";
import { compressPacket, decompressPacket } from "../src/index.js";

describe("compressPacket / decompressPacket", () => {
  it("round-trips losslessly with brotli or zlib", () => {
    const payload = JSON.stringify({ hello: "world", n: [1, 2, 3] });
    const c = compressPacket(payload);
    const back = decompressPacket(c.base64, c.metadata);
    expect(back).toBe(payload);
    expect(c.metadata.raw_bytes).toBeGreaterThan(0);
    expect(c.metadata.compressed_bytes).toBeGreaterThan(0);
  });

  it("supports disable (none) passthrough", () => {
    const payload = '{"a":1}';
    const c = compressPacket(payload, { disable: true });
    expect(c.metadata.method).toBe("none");
    expect(decompressPacket(c.base64, c.metadata)).toBe(payload);
  });
});
