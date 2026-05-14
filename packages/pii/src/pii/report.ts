import { isPlainObject } from "@intelpacket/core";
import { INTELPACKET_PII_SPEC_VERSION } from "./spec.js";
import { REDACT_LITERAL, VALUE_PATTERNS } from "./constants.js";
import { detectPII } from "./detect.js";
import { findAllowMatch, formatPath, validatePrivacyPolicy } from "./policy.js";
import type { DetectPIIOptions, PrivacyPolicyV1, PrivacyReport, PrivacyVerificationResult, ProtectPIIResult } from "./types.js";

function walkPatternStrings(
  value: unknown,
  fn: (s: string, path: string) => void,
  parts: Array<string | number> = [],
): void {
  if (value === null || typeof value === "number" || typeof value === "boolean") return;
  if (typeof value === "string") {
    fn(value, formatPath(parts));
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      walkPatternStrings(value[i], fn, [...parts, i]);
    }
    return;
  }
  if (isPlainObject(value)) {
    for (const k of Object.keys(value as Record<string, unknown>)) {
      walkPatternStrings((value as Record<string, unknown>)[k], fn, [...parts, k]);
    }
  }
}

export function residualPatternScan(data: unknown): string[] {
  const hits: string[] = [];
  walkPatternStrings(data, (s, pth) => {
    if (VALUE_PATTERNS.ssn.test(s)) {
      hits.push(pth);
    }
  });
  return hits;
}

function flattenLeaves(
  value: unknown,
  parts: Array<string | number> = [],
  out: Map<string, unknown> = new Map(),
): Map<string, unknown> {
  if (value === null || typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    if (parts.length > 0) {
      out.set(formatPath(parts), value);
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      flattenLeaves(value[i], [...parts, i], out);
    }
    return out;
  }
  if (isPlainObject(value)) {
    for (const k of Object.keys(value as Record<string, unknown>)) {
      flattenLeaves((value as Record<string, unknown>)[k], [...parts, k], out);
    }
    return out;
  }
  return out;
}

function inferTransforms(input: unknown, transformed: unknown): {
  redacted: string[];
  masked: string[];
  tokenized: string[];
  hmac: string[];
  removed: string[];
} {
  const redacted: string[] = [];
  const masked: string[] = [];
  const tokenized: string[] = [];
  const hmac: string[] = [];
  const removed: string[] = [];
  const inputPaths = flattenLeaves(input);
  const outPaths = flattenLeaves(transformed);
  for (const [path, inVal] of inputPaths) {
    if (!outPaths.has(path)) {
      removed.push(path);
      continue;
    }
    const outVal = outPaths.get(path);
    if (outVal === REDACT_LITERAL) {
      redacted.push(path);
    } else if (typeof outVal === "string" && outVal.startsWith("tok_")) {
      tokenized.push(path);
    } else if (typeof outVal === "string" && outVal.startsWith("hmac_")) {
      hmac.push(path);
    } else if (typeof inVal === "string" && typeof outVal === "string" && inVal !== outVal && outVal.includes("*")) {
      masked.push(path);
    }
  }
  return { redacted, masked, tokenized, hmac, removed };
}

export function createPrivacyReport(
  input: unknown,
  transformed: unknown,
  policyInput: unknown,
  detectOptions?: DetectPIIOptions,
): PrivacyReport {
  const policy = validatePrivacyPolicy(policyInput);
  const mode = policy.mode ?? "fail-closed";
  const pre = detectPII(input, detectOptions);
  const post = detectPII(transformed, detectOptions);
  const inferred = inferTransforms(input, transformed);
  const patternPaths = residualPatternScan(transformed);
  const postPaths = post.fields
    .filter((f) => !((policy.allow?.length ?? 0) > 0 && findAllowMatch(policy, f.path)))
    .map((f) => f.path);
  const unhandled = [...new Set([...postPaths, ...patternPaths])];
  const rawPresent = unhandled.length > 0;
  const transformCount =
    inferred.redacted.length +
    inferred.masked.length +
    inferred.tokenized.length +
    inferred.hmac.length +
    inferred.removed.length;
  return {
    policy_version: "v1",
    pii_spec_version: INTELPACKET_PII_SPEC_VERSION,
    mode,
    raw_pii_present: rawPresent,
    fields_detected: pre.fields,
    fields_redacted: inferred.redacted,
    fields_masked: inferred.masked,
    fields_tokenized: inferred.tokenized,
    fields_hmac: inferred.hmac,
    fields_removed: inferred.removed,
    unhandled_sensitive_fields: unhandled,
    denied_fields: [],
    allowed_fields: [...(policy.allow ?? [])],
    transform_count: transformCount,
    safe_for_packetization: !rawPresent,
  };
}

function syntheticPolicyFromReport(r: ProtectPIIResult["report"]): PrivacyPolicyV1 {
  return {
    version: "v1",
    mode: r.mode,
    allow: r.allowed_fields,
  };
}

export function verifyPrivacyResult(result: ProtectPIIResult): PrivacyVerificationResult {
  if (!result.report.safe_for_packetization) {
    return {
      ok: false,
      code: "RAW_PII_REMAINS",
      message: "Data is not safe for packetization",
      fieldPaths: [...result.report.unhandled_sensitive_fields],
    };
  }
  if (result.report.raw_pii_present) {
    return {
      ok: false,
      code: "RAW_PII_REMAINS",
      message: "Report flags raw PII metadata",
      fieldPaths: [],
    };
  }
  const residual = detectPII(result.data);
  const pol = syntheticPolicyFromReport(result.report);
  const unresolved = residual.fields.filter(
    (f) => !((pol.allow?.length ?? 0) > 0 && findAllowMatch(pol, f.path)),
  );
  if (unresolved.length > 0) {
    return {
      ok: false,
      code: "RAW_PII_REMAINS",
      message: "Residual sensitive structure detected",
      fieldPaths: unresolved.map((f) => f.path),
    };
  }
  const patterns = residualPatternScan(result.data);
  if (patterns.length > 0) {
    return {
      ok: false,
      code: "RAW_PII_REMAINS",
      message: "Possible raw sensitive pattern in output",
      fieldPaths: patterns,
    };
  }

  for (const f of result.report.fields_detected) {
    const handled =
      result.report.fields_redacted.includes(f.path) ||
      result.report.fields_masked.includes(f.path) ||
      result.report.fields_tokenized.includes(f.path) ||
      result.report.fields_hmac.includes(f.path) ||
      result.report.fields_removed.includes(f.path);
    const waived = result.report.allowed_fields.length > 0 && findAllowMatch(pol, f.path);
    if (!handled && !waived) {
      return {
        ok: false,
        code: "RAW_PII_REMAINS",
        message: "Detected sensitive field was not handled in report",
        fieldPaths: [f.path],
      };
    }
  }

  return { ok: true };
}
