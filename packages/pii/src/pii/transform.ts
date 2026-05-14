import {
  MAX_ARRAY_LENGTH,
  MAX_KEYS_PER_OBJECT,
  MAX_STRING_BYTES,
  isPlainObject,
  utf8ByteLength,
} from "@intelpacket/core";
import { IntelPacketPIIError } from "./errors.js";
import { INTELPACKET_PII_SPEC_VERSION } from "./spec.js";
import { detectPII } from "./detect.js";
import { hmacField } from "./hmac.js";
import { inferMaskKindFromFieldName, maskStringByKind } from "./mask.js";
import {
  findAllowMatch,
  formatPath,
  parsePolicyPath,
  pathMatches,
  type PolicyPathSegment,
  validatePrivacyPolicy,
} from "./policy.js";
import { redactValue } from "./redact.js";
import { tokenizeField } from "./tokenize.js";
import type {
  PIIDetectedField,
  PrivacyPolicyV1,
  PrivacyReport,
  ProtectPIIOptions,
  ProtectPIIResult,
} from "./types.js";

type RuleAction = "redact" | "mask" | "tokenize" | "hmac" | "remove" | "deny";

type Rule = { pattern: PolicyPathSegment[]; action: RuleAction };

function structuredCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertPrivacyStructure(value: unknown, path: string, stack: Set<object>): void {
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return;
  }
  if (typeof value === "string") {
    if (utf8ByteLength(value) > MAX_STRING_BYTES) {
      throw new IntelPacketPIIError("INVALID_POLICY", "String exceeds maximum size", [path]);
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) {
      throw new IntelPacketPIIError("INVALID_POLICY", "Array exceeds maximum length", [path]);
    }
    if (stack.has(value)) {
      throw new IntelPacketPIIError("CIRCULAR_INPUT", "Circular reference in input", [path]);
    }
    stack.add(value);
    try {
      for (let i = 0; i < value.length; i++) {
        assertPrivacyStructure(value[i], path ? `${path}[${i}]` : `[${i}]`, stack);
      }
    } finally {
      stack.delete(value);
    }
    return;
  }
  if (typeof value === "object") {
    if (!isPlainObject(value)) {
      throw new IntelPacketPIIError("NON_PLAIN_OBJECT", "Only plain objects are supported", [path || "."]);
    }
    const obj = value as Record<string, unknown>;
    if (stack.has(obj)) {
      throw new IntelPacketPIIError("CIRCULAR_INPUT", "Circular reference in input", [path]);
    }
    const keys = Object.keys(obj);
    if (keys.length > MAX_KEYS_PER_OBJECT) {
      throw new IntelPacketPIIError("INVALID_POLICY", "Object exceeds maximum key count", [path]);
    }
    stack.add(obj);
    try {
      for (const k of keys) {
        if (k === "__proto__" || k === "constructor" || k === "prototype") {
          throw new IntelPacketPIIError("DANGEROUS_KEY", "Forbidden object key in input", [
            path ? `${path}.${k}` : k,
          ]);
        }
        const next = path ? `${path}.${k}` : k;
        assertPrivacyStructure(obj[k], next, stack);
      }
    } finally {
      stack.delete(obj);
    }
  }
}

function buildRules(policy: PrivacyPolicyV1): Rule[] {
  const rules: Rule[] = [];
  const add = (paths: string[] | undefined, action: RuleAction) => {
    for (const raw of paths ?? []) {
      rules.push({ pattern: parsePolicyPath(raw.trim()), action });
    }
  };
  add(policy.redact, "redact");
  add(policy.mask, "mask");
  add(policy.tokenize, "tokenize");
  add(policy.hmac, "hmac");
  add(policy.remove, "remove");
  add(policy.deny, "deny");
  return rules;
}

function findRule(rules: Rule[], path: string): Rule | undefined {
  for (const r of rules) {
    if (pathMatches(path, r.pattern)) return r;
  }
  return undefined;
}

type MutableReport = PrivacyReport;

function emptyReport(policy: PrivacyPolicyV1): MutableReport {
  return {
    policy_version: "v1",
    mode: policy.mode ?? "fail-closed",
    pii_spec_version: INTELPACKET_PII_SPEC_VERSION,
    raw_pii_present: false,
    fields_detected: [],
    fields_redacted: [],
    fields_masked: [],
    fields_tokenized: [],
    fields_hmac: [],
    fields_removed: [],
    unhandled_sensitive_fields: [],
    denied_fields: [],
    allowed_fields: [...(policy.allow ?? [])],
    transform_count: 0,
    safe_for_packetization: false,
  };
}

function setParent(parent: Record<string, unknown> | unknown[], key: string | number, v: unknown): void {
  if (Array.isArray(parent)) {
    parent[key as number] = v;
  } else {
    parent[key as string] = v;
  }
}

function collectUnhandledPaths(
  fields: PIIDetectedField[],
  pol: PrivacyPolicyV1,
  rules: Rule[],
  transformedPaths: Set<string>,
): string[] {
  const un: string[] = [];
  const allowList = pol.allow ?? [];
  for (const f of fields) {
    const r = findRule(rules, f.path);
    const allowed = allowList.length > 0 && findAllowMatch(pol, f.path);
    const transformed = transformedPaths.has(f.path);
    const handled =
      transformed ||
      allowed ||
      (r &&
        (r.action === "redact" ||
          r.action === "mask" ||
          r.action === "tokenize" ||
          r.action === "hmac" ||
          r.action === "remove" ||
          r.action === "deny"));
    if (!handled) {
      un.push(f.path);
    }
  }
  return un;
}

function applyLeafRules(
  parent: Record<string, unknown> | unknown[],
  key: string | number,
  parts: Array<string | number>,
  pathStr: string,
  rep: MutableReport,
  tf: Set<string>,
  rls: Rule[],
  opt: ProtectPIIOptions,
  bump: () => void,
): void {
  let value: unknown;
  if (Array.isArray(parent)) {
    value = parent[key as number];
  } else {
    value = parent[key as string];
  }
  if (value === undefined) return;

  const rule = findRule(rls, pathStr);
  if (rule?.action === "remove") {
    if (Array.isArray(parent)) {
      parent.splice(key as number, 1);
    } else {
      delete parent[key as string];
    }
    rep.fields_removed.push(pathStr);
    tf.add(pathStr);
    bump();
    return;
  }
  if (rule?.action === "deny") {
    if (Array.isArray(parent)) {
      parent.splice(key as number, 1);
    } else {
      delete parent[key as string];
    }
    rep.denied_fields.push(pathStr);
    tf.add(pathStr);
    bump();
    return;
  }

  if (rule?.action === "redact") {
    setParent(parent, key, redactValue(value));
    rep.fields_redacted.push(pathStr);
    tf.add(pathStr);
    bump();
    return;
  }
  if (rule?.action === "mask") {
    const field = String(parts[parts.length - 1] ?? "");
    const kind = inferMaskKindFromFieldName(field);
    const masked =
      typeof value === "string" ? maskStringByKind(value, kind) : maskStringByKind(String(value), kind);
    setParent(parent, key, masked);
    rep.fields_masked.push(pathStr);
    tf.add(pathStr);
    bump();
    return;
  }
  if (rule?.action === "tokenize") {
    if (!opt.tokenSecret) {
      throw new IntelPacketPIIError("MISSING_TOKEN_SECRET", "tokenSecret is required for tokenization", [
        pathStr,
      ]);
    }
    setParent(parent, key, tokenizeField(pathStr, value, opt.tokenSecret));
    rep.fields_tokenized.push(pathStr);
    tf.add(pathStr);
    bump();
    return;
  }
  if (rule?.action === "hmac") {
    if (!opt.hmacSecret) {
      throw new IntelPacketPIIError("MISSING_HMAC_SECRET", "hmacSecret is required for HMAC fields", [pathStr]);
    }
    setParent(parent, key, hmacField(pathStr, value, opt.hmacSecret));
    rep.fields_hmac.push(pathStr);
    tf.add(pathStr);
    bump();
    return;
  }
}

function visitNode(
  node: unknown,
  parts: Array<string | number>,
  rep: MutableReport,
  tf: Set<string>,
  rls: Rule[],
  pol: PrivacyPolicyV1,
  opt: ProtectPIIOptions,
  bump: () => void,
): void {
  if (node === null || typeof node === "number" || typeof node === "boolean" || typeof node === "string") {
    return;
  }
  if (Array.isArray(node)) {
    for (let i = node.length - 1; i >= 0; i--) {
      const pathStrI = formatPath([...parts, i]);
      const el = node[i];
      applyLeafRules(node, i, [...parts, i], pathStrI, rep, tf, rls, opt, bump);
      const still = node[i];
      if (still !== undefined && still !== null && typeof still === "object") {
        visitNode(still, [...parts, i], rep, tf, rls, pol, opt, bump);
      }
      void el;
    }
    return;
  }
  if (!isPlainObject(node)) return;
  const obj = node as Record<string, unknown>;
  const keys = Object.keys(obj);
  for (const k of keys) {
    const childPathStr = formatPath([...parts, k]);
    const v = obj[k];
    if (v === undefined) continue;
    applyLeafRules(obj, k, [...parts, k], childPathStr, rep, tf, rls, opt, bump);
    const v2 = obj[k];
    if (v2 !== undefined && v2 !== null && typeof v2 === "object") {
      visitNode(v2, [...parts, k], rep, tf, rls, pol, opt, bump);
    }
  }
}

function pruneDisallowed(
  node: unknown,
  parts: Array<string | number>,
  pol: PrivacyPolicyV1,
  tf: Set<string>,
): void {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      pruneDisallowed(node[i], [...parts, i], pol, tf);
    }
    return;
  }
  if (!isPlainObject(node)) return;
  const obj = node as Record<string, unknown>;
  const keys = Object.keys(obj);
  for (const k of keys) {
    const pth = formatPath([...parts, k]);
    const child = obj[k];
    const allowed = findAllowMatch(pol, pth);
    const willTransform = tf.has(pth);
    if (child !== null && typeof child === "object") {
      pruneDisallowed(child, [...parts, k], pol, tf);
      const after = obj[k];
      const childPlain =
        after !== null &&
        typeof after === "object" &&
        !Array.isArray(after) &&
        isPlainObject(after) &&
        Object.keys(after as Record<string, unknown>).length === 0;
      if (childPlain && !allowed && !willTransform) {
        delete obj[k];
        continue;
      }
      if (Array.isArray(after) && after.length === 0 && !allowed && !willTransform) {
        delete obj[k];
      }
      continue;
    }
    if (!allowed && !willTransform) {
      delete obj[k];
    }
  }
}

export function assertNoUnhandledPII(input: unknown, policyInput: unknown): void {
  const p = validatePrivacyPolicy(policyInput);
  const mode = p.mode ?? "fail-closed";
  if (mode !== "fail-closed") {
    return;
  }
  const detected = detectPII(input);
  const rules = buildRules(p);
  const allowList = p.allow ?? [];
  const unhandled: string[] = [];
  for (const f of detected.fields) {
    const r = findRule(rules, f.path);
    const allowed = allowList.length > 0 && findAllowMatch(p, f.path);
    if (r || allowed) continue;
    unhandled.push(f.path);
  }
  if (unhandled.length > 0) {
    throw new IntelPacketPIIError(
      "UNHANDLED_PII_FIELD",
      "Sensitive fields are not covered by the privacy policy",
      unhandled,
    );
  }
}

export function protectPII(
  input: unknown,
  policyInput: unknown,
  options: ProtectPIIOptions = {},
): ProtectPIIResult {
  const policy = validatePrivacyPolicy(policyInput);
  const mode = policy.mode ?? "fail-closed";
  assertPrivacyStructure(input, "", new Set());

  const rules = buildRules(policy);
  if ((policy.tokenize?.length ?? 0) > 0 && !options.tokenSecret) {
    throw new IntelPacketPIIError("MISSING_TOKEN_SECRET", "tokenSecret is required for tokenization", []);
  }
  if ((policy.hmac?.length ?? 0) > 0 && !options.hmacSecret) {
    throw new IntelPacketPIIError("MISSING_HMAC_SECRET", "hmacSecret is required for HMAC fields", []);
  }

  const data = structuredCloneJson(input);
  const report = emptyReport(policy);
  const transformedPaths = new Set<string>();
  let transformCount = 0;
  const bump = () => {
    transformCount++;
  };

  if (data !== null && typeof data === "object") {
    visitNode(data, [], report, transformedPaths, rules, policy, options, bump);
  }

  if (policy.allow && policy.allow.length > 0) {
    pruneDisallowed(data, [], policy, transformedPaths);
  }

  const detectedBefore = detectPII(input, options.detectOptions);
  report.fields_detected = detectedBefore.fields;

  let unhandled = collectUnhandledPaths(detectedBefore.fields, policy, rules, transformedPaths);
  const postDetect = detectPII(data, options.detectOptions);
  for (const pf of postDetect.fields) {
    const allowed = (policy.allow?.length ?? 0) > 0 && findAllowMatch(policy, pf.path);
    if (allowed) continue;
    if (!unhandled.includes(pf.path)) {
      unhandled.push(pf.path);
    }
  }

  report.unhandled_sensitive_fields = [...new Set(unhandled)];
  report.transform_count = transformCount;

  const postUnresolved = postDetect.fields.filter(
    (f) => !((policy.allow?.length ?? 0) > 0 && findAllowMatch(policy, f.path)),
  );

  report.raw_pii_present = postUnresolved.length > 0 || report.unhandled_sensitive_fields.length > 0;
  report.safe_for_packetization =
    postUnresolved.length === 0 && report.unhandled_sensitive_fields.length === 0;

  if (options.includePrivacyMetadata && isPlainObject(data)) {
    const o = data as Record<string, unknown>;
    o["__intelpacket_pii_meta"] = {
      policy_version: "v1",
      transform_count: transformCount,
      mode,
    };
    transformedPaths.add("__intelpacket_pii_meta");
  }

  const forceFail = options.failOnUnhandledPII === true || mode === "fail-closed";
  if (forceFail && report.unhandled_sensitive_fields.length > 0) {
    throw new IntelPacketPIIError(
      "UNHANDLED_PII_FIELD",
      "Sensitive fields are not covered by the privacy policy",
      report.unhandled_sensitive_fields,
    );
  }
  if (forceFail && postUnresolved.length > 0) {
    throw new IntelPacketPIIError(
      "RAW_PII_REMAINS",
      "Transformed data still contains detectable sensitive values",
      postUnresolved.map((f) => f.path),
    );
  }

  return { data, report };
}
