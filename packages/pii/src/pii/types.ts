import type { IntelPacketPIIErrorCode } from "./errors.js";

export type PrivacyPolicyMode = "fail-closed" | "permissive";

export type PrivacyPolicyV1 = {
  version: "v1";
  mode?: PrivacyPolicyMode;
  redact?: string[];
  mask?: string[];
  tokenize?: string[];
  hmac?: string[];
  remove?: string[];
  allow?: string[];
  deny?: string[];
};

export type DetectPIIOptions = {
  /** When true, allow stricter DOB-from-timestamp behavior (reserved; default remains conservative) */
  strictTimestampDob?: boolean;
  /**
   * Extra field-name → category mappings merged after built-ins.
   * Keys are normalized like built-ins (e.g. `case_number`, `salary`).
   */
  sensitiveFieldNames?: Record<string, string>;
};

export type ProtectPIIOptions = {
  tokenSecret?: string;
  hmacSecret?: string;
  includePrivacyMetadata?: boolean;
  /** When true, throw on unhandled sensitive fields even if policy mode is permissive */
  failOnUnhandledPII?: boolean;
  /** Passed to `detectPII` for input/output scans during protection */
  detectOptions?: DetectPIIOptions;
};

export type PIIDetectionKind = "field_name" | "pattern";

export type PIIDetectedField = {
  path: string;
  field: string;
  category: string;
  detection: PIIDetectionKind;
  actionRequired: boolean;
};

export type PIIDetectResult = {
  detected: boolean;
  fields: PIIDetectedField[];
};

export type PrivacyReport = {
  policy_version: "v1";
  /** IntelPacket PII Specification document revision (Spec v1). */
  pii_spec_version: "1";
  mode: PrivacyPolicyMode;
  raw_pii_present: boolean;
  fields_detected: PIIDetectedField[];
  fields_redacted: string[];
  fields_masked: string[];
  fields_tokenized: string[];
  fields_hmac: string[];
  fields_removed: string[];
  unhandled_sensitive_fields: string[];
  denied_fields: string[];
  allowed_fields: string[];
  transform_count: number;
  safe_for_packetization: boolean;
};

export type ProtectPIIResult = {
  data: unknown;
  report: PrivacyReport;
};

export type PrivacyVerificationFailure = {
  ok: false;
  code: IntelPacketPIIErrorCode;
  message: string;
  fieldPaths: string[];
};

export type PrivacyVerificationSuccess = { ok: true };

export type PrivacyVerificationResult =
  | PrivacyVerificationSuccess
  | PrivacyVerificationFailure;
