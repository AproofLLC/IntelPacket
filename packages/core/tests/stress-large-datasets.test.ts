import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createPacket, replayPacket, verifyIntelPacket } from "../src/index.js";
import { assertReplayCanonical } from "./helpers.js";

const here = dirname(fileURLToPath(import.meta.url));
const datasets = join(here, "..", "benchmarks", "datasets");

const files = [
  "telemetry-large.json",
  "api-events.json",
  "repeated-transactions.json",
  "nested-state-snapshots.json",
  "repeated-logs.json",
] as const;

describe("stress datasets", () => {
  it.each(files)("round-trip %s", (name) => {
    const raw = readFileSync(join(datasets, name), "utf8");
    const data: unknown = JSON.parse(raw);
    const p = createPacket(data, { disableCompression: true, createdAt: "STRESS" });
    expect(verifyIntelPacket(p)).toBe(true);
    assertReplayCanonical(replayPacket(p).canonical, data);
  });
});

describe("stress synthetic", () => {
  it(
    "10k flat objects",
    () => {
      const data = Array.from({ length: 10_000 }, (_, i) => ({
        i,
        v: i % 97,
        timestamp: `2026-01-01T00:${String(i % 60).padStart(2, "0")}:00.000Z`,
      }));
      const p = createPacket(data, { disableCompression: true });
      expect(verifyIntelPacket(p)).toBe(true);
      assertReplayCanonical(replayPacket(p).canonical, data);
    },
    30_000,
  );
});
