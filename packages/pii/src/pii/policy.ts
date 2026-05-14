import { IntelPacketPIIError } from "./errors.js";
import { privacyPolicyV1Schema } from "./schemas.js";
import type { PrivacyPolicyV1 } from "./types.js";

const DANGEROUS = new Set(["__proto__", "constructor", "prototype"]);

export type PolicyPathSegment = string | "[]";

/** Parse policy path like `patients[].ssn` or `encounters[].provider.email`. */
export function parsePolicyPath(pathStr: string): PolicyPathSegment[] {
  const trimmed = pathStr.trim();
  if (!trimmed) {
    throw new IntelPacketPIIError("UNSAFE_POLICY_PATH", "Empty policy path", []);
  }
  const segments: PolicyPathSegment[] = [];
  let i = 0;
  while (i < trimmed.length) {
    if (trimmed[i] === ".") {
      i++;
      continue;
    }
    if (trimmed[i] === "[") {
      if (trimmed.slice(i, i + 2) === "[]") {
        segments.push("[]");
        i += 2;
        if (trimmed[i] === ".") i++;
        continue;
      }
      throw new IntelPacketPIIError("INVALID_POLICY", "Policy path may only use [] as a wildcard segment", [
        pathStr,
      ]);
    }
    let j = i;
    while (j < trimmed.length && trimmed[j] !== "." && trimmed[j] !== "[") {
      j++;
    }
    const part = trimmed.slice(i, j);
    if (!part) {
      throw new IntelPacketPIIError("UNSAFE_POLICY_PATH", "Malformed policy path segment", [pathStr]);
    }
    assertSafeSegment(part, pathStr);
    segments.push(part);
    i = j;
  }
  if (segments.length === 0) {
    throw new IntelPacketPIIError("UNSAFE_POLICY_PATH", "Policy path has no segments", [pathStr]);
  }
  return segments;
}

function assertSafeSegment(segment: string, fullPath: string): void {
  if (DANGEROUS.has(segment)) {
    throw new IntelPacketPIIError("UNSAFE_POLICY_PATH", "Policy path contains forbidden segment", [
      fullPath,
    ]);
  }
}

function normalizePathString(pathStr: string): string {
  return pathStr.trim();
}

/**
 * Returns canonical map path → original policy entry (first wins validated via no-conflict).
 */
export function validatePrivacyPolicy(input: unknown): PrivacyPolicyV1 {
  const parsed = privacyPolicyV1Schema.safeParse(input);
  if (!parsed.success) {
    throw new IntelPacketPIIError("INVALID_POLICY", "Privacy policy failed schema validation", []);
  }
  const policy = parsed.data;
  const mode = policy.mode ?? "fail-closed";
  const resolved: PrivacyPolicyV1 = { ...policy, mode };

  const buckets: Record<string, readonly string[]> = {
    redact: policy.redact ?? [],
    mask: policy.mask ?? [],
    tokenize: policy.tokenize ?? [],
    hmac: policy.hmac ?? [],
    remove: policy.remove ?? [],
    deny: policy.deny ?? [],
  };

  const seen = new Map<string, string>();

  for (const [action, paths] of Object.entries(buckets)) {
    for (const p of paths) {
      const norm = normalizePathString(p);
      parsePolicyPath(norm);
      if (seen.has(norm)) {
        throw new IntelPacketPIIError(
          "POLICY_CONFLICT",
          "Policy path appears in more than one action list",
          [norm],
        );
      }
      seen.set(norm, action);
    }
  }

  const allow = policy.allow?.map(normalizePathString) ?? [];
  for (const p of allow) {
    parsePolicyPath(p);
  }

  // allow paths may overlap action paths — permitted
  return resolved;
}

export function formatPath(parts: Array<string | number>): string {
  let out = "";
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    if (typeof p === "number") {
      out += `[${p}]`;
    } else if (i === 0) {
      out = p;
    } else {
      out += `.${p}`;
    }
  }
  return out;
}

function segmentsFromFormattedPath(pathStr: string): string[] {
  const segments: string[] = [];
  let i = 0;
  while (i < pathStr.length) {
    if (pathStr[i] === ".") {
      i++;
      continue;
    }
    if (pathStr[i] === "[") {
      const close = pathStr.indexOf("]", i);
      if (close < 0) break;
      segments.push(pathStr.slice(i + 1, close));
      i = close + 1;
      continue;
    }
    let j = i;
    while (j < pathStr.length && pathStr[j] !== "." && pathStr[j] !== "[") {
      j++;
    }
    segments.push(pathStr.slice(i, j));
    i = j;
  }
  return segments;
}

export function pathMatches(actualPath: string, pattern: PolicyPathSegment[]): boolean {
  const actual = segmentsFromFormattedPath(actualPath);
  if (actual.length !== pattern.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i]!;
    const a = actual[i]!;
    if (p === "[]") {
      if (!/^\d+$/.test(a)) return false;
    } else if (p !== a) {
      return false;
    }
  }
  return true;
}

export function findAllowMatch(policy: PrivacyPolicyV1, path: string): boolean {
  const allows = policy.allow ?? [];
  for (const a of allows) {
    const pat = parsePolicyPath(a.trim());
    if (pathMatches(path, pat)) return true;
  }
  return false;
}
