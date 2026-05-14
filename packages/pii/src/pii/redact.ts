import { REDACT_LITERAL } from "./constants.js";

export function redactValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return REDACT_LITERAL;
  }
  return REDACT_LITERAL;
}
