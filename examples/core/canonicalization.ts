/**
 * Run from repository root: pnpm exec tsx examples/core/canonicalization.ts
 */
import { canonicalize, canonicalStringify } from "@intelpacket/core";

const messy = { z: 1, a: { m: 2, b: 3 } };
const once = canonicalize(messy);
const twice = canonicalize(once);

console.log("idempotent:", JSON.stringify(once) === JSON.stringify(twice));
console.log("stringify:", canonicalStringify(once));
