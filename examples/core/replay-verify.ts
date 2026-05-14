/**
 * Run from repository root: pnpm exec tsx examples/core/replay-verify.ts
 */
import { createPacket, replayPacket, verifyIntelPacket } from "@intelpacket/core";

const packet = createPacket({ a: 1, nested: { b: [2, 3] } }, { disableCompression: true });

if (!verifyIntelPacket(packet)) {
  throw new Error("packet failed verification");
}

const { expanded, canonical } = replayPacket(packet);
console.log("expanded:", JSON.stringify(expanded));
console.log("canonical keys sorted:", JSON.stringify(canonical));
