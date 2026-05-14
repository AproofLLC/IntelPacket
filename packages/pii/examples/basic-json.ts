import {
  canonicalStringify,
  createPacket,
  hashPacket,
  replayPacket,
  verifyIntelPacket,
} from "@intelpacket/pii";

const record = {
  event_type: "order.created",
  user_id: "usr_42",
  amount: "99.50",
  currency: "USD",
  timestamp: "2026-05-13 12:00:00.000Z",
};

const packet = createPacket(record, {
  disableCompression: true,
  createdAt: "2026-05-13T12:00:05.000Z",
  metadata: { title: "basic-json" },
});

console.log("packet_id", packet.packet_id);
console.log("packet_hash", packet.packet_hash);
console.log("verify", verifyIntelPacket(packet));
console.log("compression", packet.compression);

const state = replayPacket(packet);
console.log("canonical replay\n", canonicalStringify(state.canonical));

const preHash = hashPacket(state.canonical);
console.log("hash(replayed canonical)", preHash);
