import {
  MAX_ARRAY_LENGTH,
  MAX_DEPTH,
  MAX_KEYS_PER_OBJECT,
  MAX_STRING_BYTES,
  isPlainObject,
  utf8ByteLength,
} from "@intelpacket/core";
import { IntelPacketPIIError } from "./errors.js";
import { SENSITIVE_NAME_CATEGORIES, VALUE_PATTERNS } from "./constants.js";
import type { DetectPIIOptions, PIIDetectResult, PIIDetectedField } from "./types.js";

function normalizeKeyForLookup(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`)
    .replace(/__+/g, "_")
    .replace(/^_/, "");
}

/** Merges caller-supplied field categories with built-in industry-agnostic defaults. */
export function buildMergedCategoryMap(options?: DetectPIIOptions): Readonly<Record<string, string>> {
  const extra = options?.sensitiveFieldNames;
  if (!extra || Object.keys(extra).length === 0) {
    return SENSITIVE_NAME_CATEGORIES;
  }
  const norm: Record<string, string> = {};
  for (const [k, v] of Object.entries(extra)) {
    norm[normalizeKeyForLookup(k)] = v;
  }
  return { ...SENSITIVE_NAME_CATEGORIES, ...norm };
}

export function categoryFromFieldName(
  fieldKey: string,
  map: Readonly<Record<string, string>> = SENSITIVE_NAME_CATEGORIES,
): string | undefined {
  const k = normalizeKeyForLookup(fieldKey);
  if (map[k]) {
    return map[k];
  }
  for (const [name, cat] of Object.entries(map)) {
    if (k === name || k.endsWith(`_${name}`)) {
      return cat;
    }
  }
  return undefined;
}

function isLikelyOperationalTimestampField(fieldKey: string): boolean {
  const k = fieldKey.toLowerCase();
  return (
    k.includes("timestamp") ||
    k.endsWith("_at") ||
    k === "ts" ||
    k === "time" ||
    k.includes("created") ||
    k.includes("updated") ||
    k.includes("modified")
  );
}

function isDobLikeField(fieldKey: string, opts?: DetectPIIOptions): boolean {
  if (!opts?.strictTimestampDob && isLikelyOperationalTimestampField(fieldKey)) {
    return false;
  }
  const k = fieldKey.toLowerCase();
  return k.includes("dob") || k.includes("birth") || k.includes("date_of_birth") || k === "birthdate";
}

function isRoutingFieldName(fieldKey: string): boolean {
  const k = fieldKey.toLowerCase();
  return k.includes("routing") || k === "aba" || k.endsWith("_aba_number") || k.includes("routing_number");
}

function isIbanFieldName(fieldKey: string): boolean {
  return fieldKey.toLowerCase().includes("iban");
}

function isPaymentCardFieldName(fieldKey: string): boolean {
  const k = fieldKey.toLowerCase();
  return (
    k.includes("card_number") ||
    k.includes("credit_card") ||
    k.includes("debit_card") ||
    k === "pan" ||
    (k.includes("card") && k.includes("number"))
  );
}

function normalizePaymentCardProbe(value: string): string {
  return value.replace(/\s+/g, "");
}

function patternDetect(
  fieldKey: string,
  value: string,
  opts?: DetectPIIOptions,
): { category: string; detection: "pattern" } | undefined {
  if (VALUE_PATTERNS.ssn.test(value)) {
    return { category: "ssn", detection: "pattern" };
  }
  if (VALUE_PATTERNS.email.test(value)) {
    return { category: "email", detection: "pattern" };
  }
  if (VALUE_PATTERNS.phone.test(value)) {
    return { category: "phone", detection: "pattern" };
  }
  if (isDobLikeField(fieldKey, opts) && VALUE_PATTERNS.dobIso.test(value)) {
    return { category: "dob", detection: "pattern" };
  }
  const digitsOnly = value.replace(/\D/g, "");
  if (isRoutingFieldName(fieldKey) && VALUE_PATTERNS.routingDigits.test(digitsOnly)) {
    return { category: "routing", detection: "pattern" };
  }
  const compact = value.replace(/\s/g, "").toUpperCase();
  if (isIbanFieldName(fieldKey) && VALUE_PATTERNS.ibanLoose.test(compact)) {
    return { category: "iban", detection: "pattern" };
  }
  if (
    isPaymentCardFieldName(fieldKey) &&
    VALUE_PATTERNS.paymentCard.test(normalizePaymentCardProbe(value))
  ) {
    return { category: "payment_card", detection: "pattern" };
  }
  return undefined;
}

function formatPath(parts: Array<string | number>): string {
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

function walk(
  value: unknown,
  parts: Array<string | number>,
  depth: number,
  stack: Set<object>,
  out: PIIDetectedField[],
  map: Readonly<Record<string, string>>,
  detOptions?: DetectPIIOptions,
): void {
  if (depth > MAX_DEPTH) {
    throw new IntelPacketPIIError("INVALID_POLICY", "Structure exceeds maximum nesting depth", []);
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return;
  }
  if (typeof value === "string") {
    if (utf8ByteLength(value) > MAX_STRING_BYTES) {
      throw new IntelPacketPIIError("INVALID_POLICY", "String exceeds maximum size", []);
    }
    const fieldKey = typeof parts[parts.length - 1] === "string" ? String(parts[parts.length - 1]) : "";
    const pat = fieldKey ? patternDetect(fieldKey, value, detOptions) : patternDetect("", value, detOptions);
    if (pat) {
      out.push({
        path: formatPath(parts),
        field: fieldKey || "value",
        category: pat.category,
        detection: pat.detection,
        actionRequired: true,
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) {
      throw new IntelPacketPIIError("INVALID_POLICY", "Array exceeds maximum length", []);
    }
    if (stack.has(value)) {
      throw new IntelPacketPIIError("CIRCULAR_INPUT", "Circular reference in input", [formatPath(parts)]);
    }
    stack.add(value);
    try {
      for (let i = 0; i < value.length; i++) {
        walk(value[i], [...parts, i], depth + 1, stack, out, map, detOptions);
      }
    } finally {
      stack.delete(value);
    }
    return;
  }
  if (typeof value === "object") {
    if (!isPlainObject(value)) {
      throw new IntelPacketPIIError(
        "NON_PLAIN_OBJECT",
        "Only plain objects are supported for PII processing",
        [formatPath(parts)],
      );
    }
    const obj = value as Record<string, unknown>;
    if (stack.has(obj)) {
      throw new IntelPacketPIIError("CIRCULAR_INPUT", "Circular reference in input", [formatPath(parts)]);
    }
    const keys = Object.keys(obj);
    if (keys.length > MAX_KEYS_PER_OBJECT) {
      throw new IntelPacketPIIError("INVALID_POLICY", "Object exceeds maximum key count", []);
    }
    stack.add(obj);
    try {
      for (const k of keys) {
        if (k === "__proto__" || k === "constructor" || k === "prototype") {
          throw new IntelPacketPIIError("DANGEROUS_KEY", "Forbidden object key in input", [
            formatPath([...parts, k]),
          ]);
        }
        const childParts = [...parts, k];
        const cat = categoryFromFieldName(k, map);
        if (cat) {
          out.push({
            path: formatPath(childParts),
            field: k,
            category: cat,
            detection: "field_name",
            actionRequired: true,
          });
        }
        const v = obj[k];
        if (typeof v === "string") {
          const pat = patternDetect(k, v, detOptions);
          if (pat) {
            const already = out.some(
              (e) => e.path === formatPath(childParts) && e.detection === "pattern",
            );
            if (!already) {
              const nameHit = out.some(
                (e) => e.path === formatPath(childParts) && e.detection === "field_name",
              );
              if (!nameHit || pat.category !== categoryFromFieldName(k, map)) {
                out.push({
                  path: formatPath(childParts),
                  field: k,
                  category: pat.category,
                  detection: "pattern",
                  actionRequired: true,
                });
              }
            }
          }
        }
        if (v !== undefined && typeof v === "object" && v !== null) {
          walk(v, childParts, depth + 1, stack, out, map, detOptions);
        }
      }
    } finally {
      stack.delete(obj);
    }
  }
}

export function detectPII(input: unknown, options?: DetectPIIOptions): PIIDetectResult {
  const map = buildMergedCategoryMap(options);
  const fields: PIIDetectedField[] = [];
  if (input === null || typeof input !== "object") {
    return { detected: false, fields: [] };
  }
  walk(input, [], 0, new Set(), fields, map, options);
  const dedup = dedupeDetections(fields);
  return { detected: dedup.length > 0, fields: dedup };
}

function dedupeDetections(fields: PIIDetectedField[]): PIIDetectedField[] {
  const seen = new Set<string>();
  const out: PIIDetectedField[] = [];
  for (const f of fields) {
    const k = `${f.path}|${f.category}|${f.detection}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}
