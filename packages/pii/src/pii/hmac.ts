import { createHmac } from "node:crypto";
import { buildFieldScopedKey, safeFieldLabel, stableValueRepr } from "./tokenize.js";

export function hmacField(fullPath: string, value: unknown, hmacSecret: string): string {
  const h = createHmac("sha256", hmacSecret);
  const fieldKey = buildFieldScopedKey(fullPath);
  h.update(fieldKey, "utf8");
  h.update("\u0000", "utf8");
  h.update(stableValueRepr(value), "utf8");
  const digest = h.digest("hex").slice(0, 16);
  const label = safeFieldLabel(fullPath);
  return `hmac_${label}_${digest}`;
}
