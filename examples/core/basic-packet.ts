/**
 * Run from repository root: pnpm exec tsx examples/core/basic-packet.ts
 */
import { createPacket, verifyIntelPacket } from "@intelpacket/core";

const packet = createPacket(
  { order_id: "ord-100", amount: "42.00", currency: "USD" },
  { metadata: { title: "order-snapshot" }, disableCompression: true },
);

console.log("packet_id:", packet.packet_id);
console.log("verify:", verifyIntelPacket(packet));
