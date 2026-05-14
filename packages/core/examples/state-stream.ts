import {
  applyDelta,
  canonicalStringify,
  createPacket,
  diffPackets,
  replayPacket,
} from "@intelpacket/core";

const snap1 = {
  service: "api",
  counters: { in_flight: 2, errors: 0 },
  schema_ref: "state_v2",
};

const snap2 = {
  service: "api",
  counters: { in_flight: 3, errors: 0 },
  schema_ref: "state_v2",
};

const p1 = createPacket(snap1, { disableCompression: true });
const p2 = createPacket(snap2, {
  base: snap1,
  disableCompression: true,
});

console.log("snapshot 1 hash", p1.packet_hash);
console.log("snapshot 2 hash", p2.packet_hash);
console.log("delta keys", p2.delta ? Object.keys(p2.delta) : []);

const inlineDelta = diffPackets(snap1, snap2);
console.log("inline diff", canonicalStringify(inlineDelta));
console.log("applyDelta", canonicalStringify(applyDelta(snap1, inlineDelta)));

const r2 = replayPacket(p2);
console.log("replay snap2 canonical", canonicalStringify(r2.canonical));
