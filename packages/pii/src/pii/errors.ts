export type IntelPacketPIIErrorCode =
  | "UNHANDLED_PII_FIELD"
  | "MISSING_TOKEN_SECRET"
  | "MISSING_HMAC_SECRET"
  | "POLICY_CONFLICT"
  | "UNSAFE_POLICY_PATH"
  | "RAW_PII_REMAINS"
  | "INVALID_POLICY"
  | "CIRCULAR_INPUT"
  | "NON_PLAIN_OBJECT"
  | "DANGEROUS_KEY"
  | "DENIED_FIELD_RAW";

export class IntelPacketPIIError extends Error {
  readonly code: IntelPacketPIIErrorCode;
  readonly fieldPaths: readonly string[];

  constructor(
    code: IntelPacketPIIErrorCode,
    message: string,
    fieldPaths: readonly string[] = [],
  ) {
    super(message);
    this.name = "IntelPacketPIIError";
    this.code = code;
    this.fieldPaths = fieldPaths;
  }
}
