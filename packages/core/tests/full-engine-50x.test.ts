import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  IP_ENCODING,
  IP_VERSION,
  canonicalize,
  canonicalStringify,
  compactSchema,
  createPacket,
  dedupeStructures,
  hashPacket,
  normalizeTypes,
  replayPacket,
  verifyIntelPacket,
} from "../src/index.js";
import { assertReplayCanonical } from "./helpers.js";
import { mulberry32, shuffleKeyOrderSeeded } from "./prng.js";

const ITER = 50;
const here = dirname(fileURLToPath(import.meta.url));
const datasetsDir = join(here, "..", "benchmarks", "datasets");

function clonePlain<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function assertNoPrototypePollution(): void {
  expect(
    Object.prototype.hasOwnProperty.call(Object.prototype, "__intelpacket_full50__"),
  ).toBe(false);
}

function loadJson(name: string): unknown {
  return JSON.parse(readFileSync(join(datasetsDir, name), "utf8"));
}

describe("full engine 50×", () => {
  const opts = { disableCompression: true, createdAt: "FULL50" } as const;

  function runFullPipeline(
    name: string,
    getInput: (run: number) => unknown,
  ): void {
    let lastHash = "";
    for (let run = 0; run < ITER; run++) {
      const raw = getInput(run);
      const before = canonicalStringify(raw);
      const n = normalizeTypes(raw);
      const c = canonicalize(n);
      const compacted = compactSchema(c);
      const deduped = dedupeStructures(compacted);
      const innerHashBody = canonicalize({
        ip_version: IP_VERSION,
        encoding: IP_ENCODING,
        root: deduped.value,
        refs: deduped.refs,
        delta: null,
      });
      const expectedHash = hashPacket(innerHashBody);
      const packet = createPacket(raw, opts);
      expect(canonicalStringify(raw)).toBe(before);
      expect(packet.packet_id).toBe(packet.packet_hash.slice(0, 16));
      expect(verifyIntelPacket(packet)).toBe(true);
      expect(hashPacket(innerHashBody)).toBe(packet.packet_hash);
      expect(packet.compression.method).toBe("none");
      expect(packet.compression.raw_bytes).toBe(packet.compression.compressed_bytes);
      expect(packet.compression.reduction_ratio).toBe(0);
      assertReplayCanonical(replayPacket(packet).canonical, raw);
      if (lastHash) {
        expect(packet.packet_hash).toBe(lastHash);
      }
      lastHash = packet.packet_hash;
    }
    assertNoPrototypePollution();
    void name;
  }

  it("simple transaction JSON", () => {
    runFullPipeline("txn", () => ({
      id: "t-1001",
      amount: "19.99",
      currency: "USD",
      posted_at: "2026-01-15T12:00:00.000Z",
    }));
  });

  it("repeated telemetry array", () => {
    runFullPipeline("telemetry", () =>
      Array.from({ length: 40 }, (_, i) => ({
        event_type: i % 2 === 0 ? "a" : "b",
        device_id: `d-${i % 6}`,
        temperature: 10 + (i % 5),
        metadata: { host: "h1", region: "r1" },
      })),
    );
  });

  it("nested config object", () => {
    runFullPipeline("config", () => ({
      service: {
        timeouts: { connect: 5_000, read: 10_000 },
        retries: [1, 2, 4],
      },
      env: { name: "prod" },
    }));
  });

  it("repeated logs (fixture)", () => {
    const data = loadJson("repeated-logs.json") as unknown;
    runFullPipeline("repeated-logs", () => clonePlain(data));
  });

  it("state snapshots (fixture)", () => {
    const data = loadJson("nested-state-snapshots.json") as unknown;
    runFullPipeline("snapshots", () => clonePlain(data));
  });

  it("randomized key order (seeded)", () => {
    const base = {
      zebra: 1,
      alpha: { m: 2, n: 3 },
      beta: [3, 2, 1],
    };
    runFullPipeline("shuffled", (run) =>
      shuffleKeyOrderSeeded(clonePlain(base) as Record<string, unknown>, mulberry32(9_001 + run)),
    );
  });

  it("unicode strings", () => {
    runFullPipeline("unicode", () => ({
      label: "e\u0301cole",
      pair: "\u00e9cole",
      mixed: ["résumé", "na\u00efve"],
    }));
  });

  it("timestamp-heavy object", () => {
    runFullPipeline("timestamps", () => ({
      a: "2026-03-01 10:30 AM",
      b: "2026-03-01T15:30:00.000Z",
      c: "2026-12-31 11:59:59 PM",
    }));
  });

  it("numeric edge cases", () => {
    runFullPipeline("numeric", () => ({
      fin: 1.25,
      big: 9_007_199_254_740_991,
      zero: 0,
      neg: -0,
    }));
  });

  it("mixed nested arrays", () => {
    runFullPipeline("nested", () => ({
      matrix: [
        [1, 2],
        [3, { deep: [true, null] }],
      ],
      rows: [{ id: 1 }, [{ id: 2 }]],
    }));
  });
});
