import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  canonicalStringify,
  compressPacket,
  createPacket,
  decompressPacket,
  replayPacket,
  verifyIntelPacket,
} from "../src/index.js";
import type { IntelPacket } from "../src/types.js";
import { assertReplayCanonical } from "./helpers.js";
import { mulberry32, shuffleKeyOrderSeeded } from "./prng.js";

const ITER = 50;
const here = dirname(fileURLToPath(import.meta.url));
const datasetsDir = join(here, "..", "benchmarks", "datasets");

function cloneJson<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function loadJson(name: string): unknown {
  return JSON.parse(readFileSync(join(datasetsDir, name), "utf8"));
}

describe("replay 50×", () => {
  const opts = { disableCompression: true, createdAt: "REP50" } as const;

  function runReplaySuite(name: string, getInput: (run: number) => unknown): void {
    for (let run = 0; run < ITER; run++) {
      const input = getInput(run);
      const packet = createPacket(input, opts);
      const frozen = JSON.stringify(packet);
      expect(verifyIntelPacket(packet)).toBe(true);
      const replayed = replayPacket(packet);
      assertReplayCanonical(replayed.canonical, input);
      expect(JSON.stringify(packet)).toBe(frozen);
      const packet2 = createPacket(replayed.canonical, opts);
      expect(packet2.packet_hash).toBe(packet.packet_hash);
      expect(replayPacket(packet, { verifyHash: true }).canonical).toEqual(replayed.canonical);
    }
    void name;
  }

  it("inline telemetry-shaped rows", () => {
    runReplaySuite("tel", () =>
      Array.from({ length: 20 }, (_, i) => ({
        event_type: i % 2 ? "b" : "a",
        n: i,
      })),
    );
  });

  it("nested document", () => {
    runReplaySuite("nest", () => ({ a: { b: { c: [1, 2, 3] } }, z: true }));
  });

  it("repeated-logs.json", () => {
    const data = loadJson("repeated-logs.json");
    runReplaySuite("logs", () => cloneJson(data));
  });

  it("api-events.json", () => {
    const data = loadJson("api-events.json");
    runReplaySuite("api", () => cloneJson(data));
  });

  it("key-order permutations still replay to same canonical", () => {
    const base = { q: 1, m: { y: 2, x: 3 }, arr: [9, 8] };
    runReplaySuite("perm", (run) =>
      shuffleKeyOrderSeeded(cloneJson(base) as Record<string, unknown>, mulberry32(11_000 + run)),
    );
  });

  it("tampered inner payload fails closed with verifyHash true", () => {
    const packet = createPacket({ ok: true }, opts);
    const inner = JSON.parse(decompressPacket(packet.payload, packet.compression)) as Record<
      string,
      unknown
    >;
    inner.root = { ok: false };
    const { base64, metadata } = compressPacket(canonicalStringify(inner), { disable: true });
    const forged: IntelPacket = { ...packet, payload: base64, compression: metadata };
    for (let i = 0; i < ITER; i++) {
      void i;
      expect(() => replayPacket(forged)).toThrow(/hash verification failed/i);
    }
  });

  it("verifyHash false bypasses hash but schema/decompress still enforce structure", () => {
    const packet = createPacket({ ok: true }, opts);
    const inner = JSON.parse(decompressPacket(packet.payload, packet.compression)) as Record<
      string,
      unknown
    >;
    inner.root = { ok: 9 };
    const { base64, metadata } = compressPacket(canonicalStringify(inner), { disable: true });
    const forged: IntelPacket = { ...packet, payload: base64, compression: metadata };
    for (let i = 0; i < ITER; i++) {
      void i;
      expect(() => replayPacket(forged, { verifyHash: false })).not.toThrow();
    }
  });
});
