/**
 * Run from repository root: pnpm exec tsx examples/core/dedupe.ts
 */
import { dedupeStructures, expandRefs } from "@intelpacket/core";

const shared = { k: 1, j: 2 };
const input = { a: shared, b: shared };
const deduped = dedupeStructures(input);

console.log("deduped.value:", JSON.stringify(deduped.value));
console.log("roundtrip:", JSON.stringify(expandRefs(deduped.value, deduped.refs)));
