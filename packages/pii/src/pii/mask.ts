import { VALUE_PATTERNS } from "./constants.js";

export type MaskFieldKind = "phone" | "email" | "ssn" | "generic";

export function inferMaskKindFromFieldName(fieldName: string): MaskFieldKind {
  const k = fieldName.toLowerCase();
  if (k.includes("email")) return "email";
  if (k.includes("phone") || k.includes("mobile") || k === "fax") return "phone";
  if (k.includes("ssn") || k.includes("social")) return "ssn";
  return "generic";
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const last4 = digits.slice(-4).padStart(4, "0");
  return `***-***-${last4.slice(-4)}`;
}

export function maskEmail(value: string): string {
  const at = value.indexOf("@");
  if (at <= 0) return "****";
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const first = local[0] ?? "*";
  return `${first}***@${domain}`;
}

export function maskSsn(value: string): string {
  const m = value.replace(/\D/g, "");
  const last4 = m.slice(-4).padStart(4, "0");
  return `***-**-${last4.slice(-4)}`;
}

export function maskGeneric(_value: string): string {
  return "****";
}

export function maskStringByKind(value: string, kind: MaskFieldKind): string {
  if (kind === "email" && VALUE_PATTERNS.email.test(value)) return maskEmail(value);
  if (kind === "phone" && /\d/.test(value)) return maskPhone(value);
  if (kind === "ssn" && /\d/.test(value)) return maskSsn(value);
  if (kind === "ssn") return maskGeneric(value);
  if (kind === "email") return maskGeneric(value);
  if (kind === "phone") return maskGeneric(value);
  return maskGeneric(value);
}
