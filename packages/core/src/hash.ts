import { createHash } from "node:crypto";
import { canonicalStringify } from "./canonicalize.js";

/**
 * SHA-256 (hex) of the canonical JSON representation of `value`.
 */
export function hashPacket(value: unknown): string {
  return createHash("sha256").update(canonicalStringify(value)).digest("hex");
}
