import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type PIIPublicRealDataset = {
  readonly name: string;
  readonly category: "api" | "audit" | "webhook";
  readonly users: Record<string, unknown>[];
  readonly bannedLiterals: string[];
};

const here = dirname(fileURLToPath(import.meta.url));
const datasetDir = join(here, "..", "datasets", "public-real");

const definitions: readonly { file: string; name: string; category: PIIPublicRealDataset["category"] }[] = [
  { file: "sanitized-user-records.json", name: "sanitized-user-records", category: "api" },
  { file: "public-webhook-users.json", name: "public-webhook-users", category: "webhook" },
  { file: "fake-support-tickets.json", name: "fake-support-tickets", category: "api" },
  { file: "synthetic-audit-users.json", name: "synthetic-audit-users", category: "audit" },
];

function loadSeed(file: string): readonly Record<string, unknown>[] {
  const parsed = JSON.parse(readFileSync(join(datasetDir, file), "utf8")) as { users?: Record<string, unknown>[] };
  if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
    throw new Error(`PII public-real dataset ${file} must contain users[]`);
  }
  return parsed.users;
}

function materialize(seed: readonly Record<string, unknown>[], count: number, dataset: string): Record<string, unknown>[] {
  const users: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const base = seed[i % seed.length]!;
    users.push({
      ...base,
      idx: i,
      benchmark_dataset: dataset,
      benchmark_repeat: Math.floor(i / seed.length),
      email: `${dataset}.${i}@example.invalid`,
      phone: `555-${String(100 + (i % 800)).padStart(3, "0")}-${String(i % 10000).padStart(4, "0")}`,
      national_id: `SYN-${dataset.toUpperCase().replace(/[^A-Z0-9]/g, "-")}-${String(i).padStart(6, "0")}`,
      legal_name: `${dataset} Fake User ${i}`,
      addr_line: `${i % 1000} ${dataset} Example Way`,
    });
  }
  return users;
}

export function buildPIIPublicRealDatasets(recordCount: number): PIIPublicRealDataset[] {
  return definitions.map((d) => {
    const users = materialize(loadSeed(d.file), recordCount, d.name);
    const banned = new Set<string>();
    for (const u of users) {
      for (const k of ["email", "phone", "national_id", "legal_name"] as const) {
        const v = u[k];
        if (typeof v === "string" && v.length >= 4) banned.add(v);
      }
    }
    return { name: d.name, category: d.category, users, bannedLiterals: [...banned] };
  });
}
