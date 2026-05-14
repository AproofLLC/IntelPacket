import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type DatasetCategory =
  | "api"
  | "telemetry"
  | "audit"
  | "config"
  | "webhook"
  | "transaction"
  | "trace";

export type PublicRealDataset = {
  readonly name: string;
  readonly category: DatasetCategory;
  readonly data: unknown;
};

const here = dirname(fileURLToPath(import.meta.url));
const datasetDir = join(here, "..", "datasets", "public-real");

const definitions: readonly { file: string; name: string; category: DatasetCategory; entropy: string }[] = [
  { file: "github-api.json", name: "github-api", category: "api", entropy: "medium" },
  { file: "kubernetes-events.json", name: "kubernetes-events", category: "telemetry", entropy: "low" },
  { file: "otel-public-traces.json", name: "otel-public-traces", category: "trace", entropy: "nested-high" },
  { file: "cloud-audit-samples.json", name: "cloud-audit-samples", category: "audit", entropy: "medium" },
  { file: "webhook-events.json", name: "webhook-events", category: "webhook", entropy: "medium" },
  { file: "blockchain-transactions.json", name: "blockchain-transactions", category: "transaction", entropy: "high" },
  { file: "config-snapshots-public.json", name: "config-snapshots-public", category: "config", entropy: "nested-low" },
];

function loadSeed(file: string): readonly Record<string, unknown>[] {
  const parsed = JSON.parse(readFileSync(join(datasetDir, file), "utf8")) as { records?: Record<string, unknown>[] };
  if (!Array.isArray(parsed.records) || parsed.records.length === 0) {
    throw new Error(`public-real dataset ${file} must contain records[]`);
  }
  return parsed.records;
}

function compactPublicRealRecord(
  base: Record<string, unknown>,
  index: number,
  dataset: string,
  category: DatasetCategory,
): Record<string, unknown> {
  switch (category) {
    case "api":
      return {
        i: index,
        kind: dataset,
        id: base.id,
        state: base.state,
        title: base.title,
        actor: (base.user as Record<string, unknown> | undefined)?.login,
        labels: base.labels,
      };
    case "telemetry":
      return {
        i: index,
        kind: dataset,
        reason: base.reason,
        type: base.type,
        action: base.action,
        object: (base.regarding as Record<string, unknown> | undefined)?.kind,
      };
    case "trace":
      return {
        i: index,
        kind: dataset,
        traceId: `trace-${index}`,
        span: base.name,
        service: (base.resource as Record<string, unknown> | undefined)?.["service.name"],
        status: (base.status as Record<string, unknown> | undefined)?.code,
      };
    case "audit":
      return {
        i: index,
        kind: dataset,
        severity: base.severity,
        method: (base.protoPayload as Record<string, unknown> | undefined)?.methodName,
        resourceType: (base.resource as Record<string, unknown> | undefined)?.type,
      };
    case "webhook":
      return {
        i: index,
        kind: dataset,
        type: base.type,
        eventId: base.id,
        created: base.created,
        object: (base.data as { object?: Record<string, unknown> } | undefined)?.object?.id,
      };
    case "transaction":
      return {
        i: index,
        kind: dataset,
        hash: `0x${index.toString(16).padStart(16, "0")}`,
        blockNumber: base.blockNumber,
        value: base.value,
        gas: base.gas,
        status: base.status,
      };
    case "config":
      return {
        i: index,
        kind: dataset,
        service: base.service,
        version: base.version,
        environment: base.environment,
        features: base.features,
        limits: base.limits,
      };
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

function materialize(
  seed: readonly Record<string, unknown>[],
  count: number,
  dataset: string,
  category: DatasetCategory,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const base = seed[i % seed.length]!;
    out.push(compactPublicRealRecord(base, i, dataset, category));
  }
  return out;
}

export function buildPublicRealCoreDatasets(recordCount: number): PublicRealDataset[] {
  return definitions.map((d) => ({
    name: d.name,
    category: d.category,
    data: {
      dataset: d.name,
      source: "public-real",
      entropy_hint: d.entropy,
      records: materialize(loadSeed(d.file), recordCount, d.name, d.category),
    },
  }));
}
